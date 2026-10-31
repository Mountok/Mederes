"""Replay growing WAV snapshots through the actual local API; no microphone needed."""
import io
import json
import wave
from urllib.request import Request, urlopen
from pathlib import Path
import numpy as np
from recognition import decode_limited

if __name__ == "__main__":
    audio = decode_limited("../samples/Аль-Ихляс-5.mp3")
    records = []
    for seconds, final in [(6, False), (10, False), (len(audio)/16000, True)]:
        data = io.BytesIO()
        with wave.open(data, "wb") as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(16000)
            wav.writeframes((np.clip(audio[:int(seconds*16000)], -1, 1)*32767).astype("<i2").tobytes())
        request = Request("http://127.0.0.1:8001/ai-api/listen" + ("/final" if final else ""),
                          data=data.getvalue(), headers={"X-Al-Qalam-Test":"1", "Content-Type":"audio/wav"})
        with urlopen(request, timeout=90) as response:
            result = json.load(response)
        tracking = result["tracking"]
        assert tracking["final"] == final
        assert all(w["state"] == "pending" for w in tracking["words"][tracking["reached"]:])
        record = dict(seconds=seconds, final=final, transcript=result["transcript"], tracking=tracking)
        records.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
    output = Path("results/live-replay")
    output.mkdir(parents=True, exist_ok=True)
    (output / "report.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
