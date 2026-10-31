"""Compare Tarteel's Quran Whisper checkpoint on the local recordings.

This is an ASR smoke test, not a tajweed score. Distance to the canonical text
mixes recognizer errors with actual differences in a person's reading.
"""
import argparse
import json
import time
from pathlib import Path

import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor

from analysis import compare
from recognition import decode_limited

MODEL_ID = "tarteel-ai/whisper-base-ar-quran"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", default="../samples")
    parser.add_argument("--output", default="results/tarteel-base/report.json")
    args = parser.parse_args()

    processor = AutoProcessor.from_pretrained(MODEL_ID, local_files_only=True)
    model = AutoModelForSpeechSeq2Seq.from_pretrained(MODEL_ID, local_files_only=True)
    model.eval()
    rows = []
    for path in sorted(Path(args.samples).glob("*.mp3")):
        audio = decode_limited(str(path))
        inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
        started = time.perf_counter()
        with torch.inference_mode():
            predicted = model.generate(inputs.input_features)
        transcript = processor.batch_decode(predicted, skip_special_tokens=True)[0].strip()
        analysis = compare(transcript)
        rows.append({
            "file": path.name,
            "transcript": transcript,
            "word_distance": analysis["word_distance"],
            "reference_word_count": analysis["reference_word_count"],
            "elapsed_seconds": round(time.perf_counter() - started, 2),
        })
        print(path.name, transcript, analysis["word_distance"], sep="\t", flush=True)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "model": MODEL_ID,
        "reference_provided_to_asr": False,
        "warning": "Distance to canonical text is not measured ASR accuracy or a tajweed score.",
        "records": rows,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
