"""Replay overlapping microphone windows on a local recording for diagnosis."""
import argparse
import tempfile
import wave

import numpy as np

from recognition import Recognizer, decode_limited
from pathlib import Path

from server import DEFAULT_MODEL, merge_live_text
from tracking import track


def transcribe_window(recognizer, audio, start, end, beam_size):
    with tempfile.NamedTemporaryFile(suffix=".wav") as temp:
        with wave.open(temp.name, "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(16000)
            out.writeframes((np.clip(audio[int(start * 16000):int(end * 16000)], -1, 1) * 32767).astype("<i2").tobytes())
        return recognizer.transcribe(temp.name, beam_size=beam_size)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    args = parser.parse_args()
    audio = decode_limited(args.audio)
    duration = len(audio) / 16000
    base = Recognizer(DEFAULT_MODEL)
    tiny_path = Path(__file__).parent / "models/tarteel-faster-whisper-tiny"
    preview = Recognizer(str(tiny_path), beam_size=1) if tiny_path.exists() else base
    merged = ""
    for end in range(4, int(duration) + 1, 4):
        result = transcribe_window(preview, audio, max(0, end - 12), end, 1)
        merged = merge_live_text(merged, result["transcript"])
        state = track(merged)
        print(f"{end}s preview: {result['transcript']!r}; aligned={state['aligned']}, matched={state['matched']}; elapsed={result['elapsed_seconds']}s", flush=True)
        if end % 8 == 0:
            confirmed = transcribe_window(base, audio, max(0, end - 12), end, 5)
            state = track(confirmed["transcript"])
            print(f"{end}s confirm: {confirmed['transcript']!r}; aligned={state['aligned']}, matched={state['matched']}; elapsed={confirmed['elapsed_seconds']}s", flush=True)
    result = transcribe_window(base, audio, 0, duration, 5)
    state = track(result["transcript"], final=True)
    print(f"final: {result['transcript']!r}; aligned={state['aligned']}, matched={state['matched']}; elapsed={result['elapsed_seconds']}s", flush=True)
