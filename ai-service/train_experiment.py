"""Small, explicitly provisional LoRA experiment. Never changes website weights."""
import argparse
import hashlib
import html
import importlib.metadata
import json
import random
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
from peft import LoraConfig, get_peft_model_state_dict, inject_adapter_in_model, set_peft_model_state_dict
from safetensors.torch import load_file, save_file
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from transformers.modeling_outputs import BaseModelOutput

from analysis import compare
from recognition import decode_limited

ROOT = Path(__file__).resolve().parent
MODEL = "openai/whisper-small"
TRAIN_NAMES = {f"Аль-Ихляс-{i}.mp3" for i in (1, 2, 3)}
TRAIN_TEXT = "بسم الله الرحمن الرحيم قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد"


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=int, default=24)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--device", choices=["auto", "cpu", "mps"], default="auto")
    parser.add_argument("--allow-download", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not 1 <= args.steps <= 100 or not 0 < args.lr <= 1e-3:
        parser.error("Use 1–100 steps and 0 < lr <= 0.001 for this tiny experiment")
    out = args.output or ROOT / "training-runs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    out.mkdir(parents=True, exist_ok=False)
    print(f"Experiment directory: {out}", flush=True)
    random.seed(42)
    np.random.seed(42)
    torch.manual_seed(42)
    torch.set_num_threads(4)
    device = ("mps" if torch.backends.mps.is_available() else "cpu") if args.device == "auto" else args.device
    options = dict(cache_dir=str(ROOT / "models" / "training-hf"), local_files_only=not args.allow_download)
    print(f"Loading {MODEL} on {device}; website unchanged", flush=True)
    processor = WhisperProcessor.from_pretrained(MODEL, language="arabic", task="transcribe", **options)
    model = WhisperForConditionalGeneration.from_pretrained(MODEL, use_safetensors=True,
        attn_implementation="eager", **options).to(device)
    model.generation_config.forced_decoder_ids = None
    model.config.forced_decoder_ids = None
    model.eval()
    samples, manifest = [], []
    paths = sorted((ROOT.parent / "samples").glob("*.mp3"))
    if not TRAIN_NAMES.issubset({p.name for p in paths}):
        raise ValueError("Missing required training recordings 1–3")
    for path in paths:
        audio = decode_limited(str(path))
        if len(audio) > 30 * 16000:
            raise ValueError("This controlled experiment supports recordings <= 30 seconds")
        role = "train" if path.name in TRAIN_NAMES else "held_out_unlabelled"
        item = dict(file=path.name, role=role, seconds=len(audio)/16000,
                    source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                    transcript=TRAIN_TEXT if role == "train" else None,
                    label_status="user_reports_correct_not_teacher_verified" if role == "train" else "no_ground_truth")
        manifest.append(item)
        features = processor.feature_extractor(audio, sampling_rate=16000, return_tensors="pt", return_attention_mask=True)
        samples.append(dict(**item, features=features.input_features, attention_mask=features.attention_mask))
    silence = processor.feature_extractor(np.zeros(160000, dtype=np.float32), sampling_rate=16000,
                                         return_tensors="pt", return_attention_mask=True)
    samples.append(dict(file="CONTROL_silence_10s", role="negative_control", seconds=10,
                        features=silence.input_features, attention_mask=silence.attention_mask))
    write_json(out / "manifest.json", manifest)
    # Encoder is frozen and never trained. Cache its outputs to reduce Mac RAM/compute use.
    with torch.no_grad():
        for sample in samples:
            sample["encoded"] = model.model.encoder(sample["features"].to(device)).last_hidden_state.detach().cpu()
    def predict_all():
        model.eval()
        records = []
        for sample in samples:
            started = time.perf_counter()
            with torch.no_grad():
                tokens = model.generate(input_features=sample["features"].to(device),
                    attention_mask=sample["attention_mask"].to(device),
                    encoder_outputs=BaseModelOutput(last_hidden_state=sample["encoded"].to(device)),
                    language="ar", task="transcribe", num_beams=5, do_sample=False,
                    max_new_tokens=160, return_timestamps=False)
            text = processor.batch_decode(tokens, skip_special_tokens=True)[0].strip()
            record = dict(file=sample["file"], role=sample["role"], transcript=text,
                          elapsed_seconds=round(time.perf_counter()-started, 2))
            if sample["role"] == "train":
                record["canonical_word_distance_not_asr_accuracy"] = compare(text)["word_distance"]
            records.append(record)
            print(json.dumps(record, ensure_ascii=False), flush=True)
        return records

    print("BEFORE (same PyTorch engine and decoding as AFTER)", flush=True)
    before = predict_all()
    write_json(out / "before.json", before)
    config = LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, bias="none",
        target_modules=r"model\.decoder\.layers\.\d+\.(self_attn|encoder_attn)\.(q_proj|v_proj)")
    model = inject_adapter_in_model(config, model)
    model.to(device)
    trainable = [p for p in model.parameters() if p.requires_grad]
    if not trainable:
        raise RuntimeError("No trainable parameters")
    trainable_count = sum(p.numel() for p in trainable)
    print(f"Trainable LoRA parameters: {trainable_count}", flush=True)
    train = [s for s in samples if s["role"] == "train"]
    assert all(s["file"] in TRAIN_NAMES for s in train)
    labels = processor.tokenizer(TRAIN_TEXT, return_tensors="pt").input_ids[:, 1:].to(device)
    optimizer = torch.optim.AdamW(trainable, lr=args.lr, weight_decay=0.01)
    model.train()
    model.model.encoder.eval()
    losses, schedule = [], []
    while len(schedule) < args.steps:
        order = list(range(len(train)))
        random.shuffle(order)
        schedule.extend(order)
    for step, index in enumerate(schedule[:args.steps], 1):
        optimizer.zero_grad(set_to_none=True)
        loss = model(encoder_outputs=BaseModelOutput(last_hidden_state=train[index]["encoded"].to(device)),
                     labels=labels, use_cache=False).loss
        if not torch.isfinite(loss):
            raise RuntimeError("Non-finite loss; experiment stopped")
        loss.backward()
        torch.nn.utils.clip_grad_norm_(trainable, 1.0)
        optimizer.step()
        losses.append(dict(step=step, file=train[index]["file"], loss=float(loss.detach().cpu())))
        print(f"Step {step}/{args.steps}: loss={losses[-1]['loss']:.4f}", flush=True)
        write_json(out / "losses.json", losses)
    adapter = out / "adapter"
    adapter.mkdir()
    config.save_pretrained(adapter)
    state = {k: v.detach().cpu().contiguous() for k,v in get_peft_model_state_dict(model).items()}
    save_file(state, str(adapter / "adapter_model.safetensors"))
    restored = load_file(str(adapter / "adapter_model.safetensors"))
    assert all(torch.equal(value, restored[key]) for key, value in state.items())
    set_peft_model_state_dict(model, restored)
    print("AFTER (fixed final step, no checkpoint selection using recording 5)", flush=True)
    after = predict_all()
    report = dict(base_model=MODEL, base_revision=getattr(model.config, "_commit_hash", None),
        device=device, steps=args.steps, learning_rate=args.lr, seed=42,
        trainable_parameters=trainable_count, training_seconds=sum(s["seconds"] for s in train),
        versions={p:importlib.metadata.version(p) for p in ("torch","transformers","peft","numpy")},
        method="decoder q/v LoRA rank8; frozen encoder; cached features; float32",
        decoding="Arabic transcription; beam5; no reference prompt; max_new_tokens160",
        held_out_has_verified_transcript=False, site_model_changed=False,
        before=before, after=after, losses=losses)
    write_json(out / "comparison.json", report)
    cards=[]
    for old, new in zip(before, after):
        cards.append(f'<section><h2>{html.escape(old["file"])}</h2><p>{html.escape(old["role"])}</p>'
            f'<h3>До</h3><p dir="rtl" lang="ar">{html.escape(old["transcript"])}</p>'
            f'<h3>После</h3><p dir="rtl" lang="ar">{html.escape(new["transcript"])}</p></section>')
    (out / "comparison.html").write_text('<!doctype html><html lang="ru"><meta charset="utf-8">'
        '<title>Al-Qalam: эксперимент дообучения</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:20px;background:#f3f7f5;color:#193c38}section{background:white;padding:24px;margin:20px 0;border-radius:12px}p[dir]{font:28px/1.8 serif}</style>'
        '<h1>Эксперимент: до и после LoRA</h1><p>Обучение: только записи №1–3, около 56 секунд. '
        '№4 и №5 не использованы для обучения. Разметка №1–3 предварительная; для №5 истинная расшифровка отсутствует. '
        'Совпадение с сурой не доказывает качество распознавания ошибок. Контроль тишиной — без фильтрации отсутствия речи. '
        'Рабочая модель сайта не заменена. Оба прогона выполнены одним движком PyTorch; это не сравнение скорости с сайтом.</p>'
        + ''.join(cards) + '</html>', encoding="utf-8")
    print(f"FINISHED: {out / 'comparison.html'}", flush=True)


if __name__ == "__main__":
    main()
