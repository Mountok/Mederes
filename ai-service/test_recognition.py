import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np
from recognition import Recognizer


class RecognitionTests(unittest.TestCase):
    def recognizer(self, text):
        obj = Recognizer.__new__(Recognizer)
        obj.name, obj.beam_size, obj.vad, obj.threads = "test", 5, False, 4
        obj.model = Mock()
        obj.model.transcribe.return_value = (iter([SimpleNamespace(
            start=0.0, end=1.2, text=text, avg_logprob=-1, no_speech_prob=.1)]), None)
        return obj

    @patch("recognition.decode_limited", return_value=np.ones(32000, dtype=np.float32))
    def test_raw_text_is_not_corrected(self, _decode):
        obj = self.recognizer("  اختبار مختلف  ")
        raw = obj.transcribe("unused")
        self.assertEqual(raw["transcript"], "اختبار مختلف")
        self.assertNotIn("differences", raw)
        self.assertEqual(raw["segments"][0]["start"], 0)
        kwargs = obj.model.transcribe.call_args.kwargs
        self.assertNotIn("initial_prompt", kwargs)
        self.assertNotIn("hotwords", kwargs)
        self.assertFalse(kwargs["word_timestamps"])

    @patch("recognition.decode_limited", return_value=np.ones(32000, dtype=np.float32))
    def test_live_beam_can_be_faster_than_final_beam(self, _decode):
        obj = self.recognizer("اختبار")
        result = obj.transcribe("unused", beam_size=1)
        self.assertEqual(result["recognition_settings"]["beam_size"], 1)
        self.assertEqual(obj.model.transcribe.call_args.kwargs["beam_size"], 1)

    @patch("recognition.decode_limited", return_value=np.ones(32000, dtype=np.float32))
    def test_empty_transcript_rejected(self, _decode):
        with self.assertRaisesRegex(ValueError, "Речь не распознана"):
            self.recognizer("  ").transcribe("unused")

    @patch("recognition.decode_limited", return_value=np.ones(32000, dtype=np.float32))
    def test_comparison_preserves_raw_text(self, _decode):
        result = self.recognizer("اختبار مختلف")("unused")
        self.assertEqual(result["transcript"], "اختبار مختلف")
        self.assertTrue(result["requires_teacher_review"])

    def test_pcm16_microphone_resamples_without_reference_text(self):
        obj = self.recognizer("قُلْ هُوَ اللَّهُ أَحَدٌ")
        source = np.full(48000, 16384, dtype="<i2")
        result = obj.transcribe_pcm16(source.tobytes(), 48000, beam_size=1)
        self.assertEqual(result["duration_seconds"], 1)
        self.assertEqual(result["recognition_settings"]["beam_size"], 1)
        audio = obj.model.transcribe.call_args.args[0]
        self.assertEqual(len(audio), 16000)
        self.assertAlmostEqual(float(audio.mean()), .5, places=3)


if __name__ == "__main__":
    unittest.main()
