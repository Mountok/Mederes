"""Shared local ASR pipeline; never supplies the expected text to Whisper."""
import hashlib
import os
import time
from pathlib import Path

MAX_SECONDS = 60


def decode_limited(path):
    import av
    import numpy as np
    chunks, count = [], 0
    with av.open(path) as container:
        resampler = av.AudioResampler(format="fltp", layout="mono", rate=16000)
        def append(frame):
            nonlocal count
            for output in resampler.resample(frame):
                array = output.to_ndarray().reshape(-1)
                count += len(array)
                if count > MAX_SECONDS * 16000:
                    raise ValueError("Запись должна быть не длиннее 60 секунд.")
                chunks.append(array)
        for frame in container.decode(audio=0):
            append(frame)
        append(None)
    if count < 16000:
        raise ValueError("Запись должна быть не короче одной секунды.")
    audio = np.concatenate(chunks)
    if not np.isfinite(audio).all():
        raise ValueError("Не удалось прочитать аудио.")
    if np.max(np.abs(audio)) < 0.0001:
        raise ValueError("В записи не обнаружен звук. Выберите другую запись.")
    return audio


class Recognizer:
    def __init__(self, model="small", threads=None, beam_size=5, vad=False):
        from faster_whisper import WhisperModel
        threads = min(8, os.cpu_count() or 4) if threads is None else threads
        if not 1 <= beam_size <= 10 or not 1 <= threads <= 16:
            raise ValueError("beam_size must be 1–10; threads must be 1–16")
        model_path = Path(model)
        self.name = (
            "tarteel-ai/whisper-base-ar-quran-ct2-int8"
            if model_path.name == "tarteel-faster-whisper-base"
            else "tarteel-ai/whisper-tiny-ar-quran-ct2-int8"
            if model_path.name == "tarteel-faster-whisper-tiny"
            else model
        )
        self.beam_size, self.vad, self.threads = beam_size, vad, threads
        self.model = WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=threads,
                                  download_root=str(Path(__file__).parent / "models"),
                                  local_files_only=True)

    def transcribe(self, path, beam_size=None):
        return self.transcribe_audio(decode_limited(path), beam_size=beam_size)

    def transcribe_pcm16(self, pcm, sample_rate, beam_size=None):
        import numpy as np
        if sample_rate < 8000 or sample_rate > 96000 or len(pcm) % 2:
            raise ValueError("Некорректный поток микрофона.")
        source = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768
        if len(source) > sample_rate * MAX_SECONDS:
            raise ValueError("Запись должна быть не длиннее 60 секунд.")
        if sample_rate == 16000:
            audio = source
        elif sample_rate % 16000 == 0:
            factor = sample_rate // 16000
            audio = source[:len(source) // factor * factor].reshape(-1, factor).mean(axis=1)
        else:
            count = round(len(source) * 16000 / sample_rate)
            audio = np.interp(np.arange(count) * sample_rate / 16000,
                              np.arange(len(source)), source).astype(np.float32)
        return self.transcribe_audio(audio, beam_size=beam_size)

    def transcribe_audio(self, audio, beam_size=None):
        import numpy as np
        started = time.perf_counter()
        beam_size = self.beam_size if beam_size is None else beam_size
        if not 1 <= beam_size <= 10:
            raise ValueError("beam_size must be 1–10")
        if len(audio) < 16000 or len(audio) > MAX_SECONDS * 16000 or not np.isfinite(audio).all():
            raise ValueError("Запись должна длиться от 1 до 60 секунд.")
        if np.max(np.abs(audio)) < 0.0001:
            raise ValueError("В записи не обнаружен звук. Попробуйте другую запись.")
        segments, _ = self.model.transcribe(audio, language="ar", task="transcribe",
            beam_size=beam_size, temperature=0, condition_on_previous_text=False,
            vad_filter=self.vad, word_timestamps=False)
        segments = [dict(start=round(s.start, 2), end=round(s.end, 2), text=s.text.strip(),
                         avg_logprob=s.avg_logprob, no_speech_prob=s.no_speech_prob) for s in segments]
        transcript = " ".join(s["text"] for s in segments)
        if not transcript.strip():
            raise ValueError("Речь не распознана. Попробуйте другую запись.")
        return dict(transcript=transcript, segments=segments, model=self.name,
                    duration_seconds=round(len(audio) / 16000, 2),
                    elapsed_seconds=round(time.perf_counter() - started, 2),
                    decoded_audio_sha256=hashlib.sha256(audio.tobytes()).hexdigest(),
                    recognition_settings=dict(pipeline="float32-v2", beam_size=beam_size,
                        vad_filter=self.vad, word_timestamps=False, threads=self.threads,
                        reference_provided_to_asr=False, training_performed=False))

    def __call__(self, path):
        # Comparison is downstream and cannot influence the raw transcript.
        from analysis import compare
        result = self.transcribe(path)
        return dict(result, **compare(result["transcript"]))
