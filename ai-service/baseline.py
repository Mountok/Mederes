"""Local-only ASR experiment using cached weights; never uploads recordings."""
import argparse
import html
import importlib.metadata
import json
from pathlib import Path
from recognition import Recognizer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("../samples"))
    parser.add_argument("--output", type=Path, default=Path("results/current"))
    parser.add_argument("--model", default="small")
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--vad", action="store_true")
    parser.add_argument("--threads", type=int, default=4)
    args = parser.parse_args()
    files = sorted(p for p in args.input.iterdir() if p.suffix.lower() in {".mp3", ".wav", ".m4a", ".webm", ".ogg"})
    if not files:
        parser.error("No audio files found")
    args.output.mkdir(parents=True, exist_ok=True)
    print(f"Loading {args.model} on CPU/int8", flush=True)
    model = Recognizer(args.model, threads=args.threads, beam_size=args.beam_size, vad=args.vad)
    records, seen = [], {}
    for path in files:
        try:
            record = dict(file=path.name, **model(path))
            digest = record["decoded_audio_sha256"]
            duplicate = seen.get(digest)
            seen.setdefault(digest, path.name)
            record["duplicate_of"] = duplicate
        except Exception as exc:
            record = dict(file=path.name,error=str(exc))
        records.append(record)
        (args.output / (path.stem + ".json")).write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps(record,ensure_ascii=False),flush=True)
    report = dict(model=args.model,engine=importlib.metadata.version("faster-whisper"),
                  device="cpu",compute_type="int8",threads=args.threads,
                  reference_provided_to_asr=False,training_performed=False,records=records)
    (args.output/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    cards=[]
    for r in records:
        payload=html.escape(json.dumps(r,ensure_ascii=False,indent=2))
        labels = {"substitution": "Замена", "omission": "Пропуск",
                  "insertion": "Вставка", "possible_repetition": "Возможный повтор"}
        rows = ''.join('<tr><td>'+html.escape(labels[d['type']])+'</td><td>'+str(d['ayah'])+
                       '</td><td dir="rtl">'+html.escape(d['expected'] or '—')+
                       '</td><td dir="rtl">'+html.escape(d['observed'] or '—')+'</td></tr>'
                       for d in r.get('differences', []))
        summary = (f"Запись: {r.get('duration_seconds', '—')} с · Обработка: {r.get('elapsed_seconds', '—')} с · "
                   f"Расхождения текста: {r.get('word_distance', '—')} (не ошибки ученика)")
        cards.append(f'<section><h2>{html.escape(r["file"])}</h2><p>{summary}</p><p dir="rtl">{html.escape(r.get("transcript",""))}</p>'
                     '<table cellpadding="8"><tr><th>Расхождение</th><th>Аят</th><th>Эталон</th><th>Распознано</th></tr>'+
                     rows+f'</table><details><summary>Технические данные</summary><pre>{payload}</pre></details></section>')
    (args.output/"report.html").write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Al-Qalam: первый ASR-тест</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;background:#f5f7fa;color:#17324d}section{background:white;padding:24px;margin:20px 0;border-radius:12px}pre{white-space:pre-wrap;font-size:13px}p[dir]{font-size:28px}</style><h1>Al-Qalam: первый ASR-тест</h1><p>Модель '+html.escape(args.model)+'; локальная обработка CPU/int8. Расхождения текста не доказывают ошибку чтения. Нужна проверка преподавателя. Обучение не выполнялось.</p>'+''.join(cards)+'</html>',encoding="utf-8")


if __name__ == "__main__":
    main()
