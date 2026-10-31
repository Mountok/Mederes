import http.client
import json
import os
import tempfile
import threading
import unittest
import wave
from http.server import ThreadingHTTPServer

from server import MAX_BYTES, decode_limited, handler_for, merge_live_text


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.paths = []
        self.live_paths = []
        self.live_transcripts = []
        self.selections = []
        def recognize(path):
            self.paths.append(path)
            self.assertTrue(os.path.exists(path))
            return {"transcript": "test", "differences": []}
        def resolve_ayahs(surah, ayah_from, ayah_to):
            self.selections.append((surah, ayah_from, ayah_to))
            if not (1 <= surah <= 114 and 1 <= ayah_from <= ayah_to <= 20):
                raise ValueError("Некорректный диапазон.")
            return ["test"] * (ayah_to - ayah_from + 1)
        def recognize_live(path):
            self.live_paths.append(path)
            return {"transcript": self.live_transcripts.pop(0) if self.live_transcripts else "test", "differences": []}
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(recognize, resolve_ayahs, recognize_live=recognize_live))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method="POST", path="/ai-api/analyze", body=b"audio", headers=None):
        conn = http.client.HTTPConnection(*self.server.server_address, timeout=3)
        conn.request(method, path, body=body, headers=headers if headers is not None else {"X-Al-Qalam-Test": "1"})
        response = conn.getresponse()
        status, data = response.status, json.loads(response.read())
        conn.close()
        return status, data

    def test_upload_and_cleanup(self):
        status, data = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(data["transcript"], "test")
        self.assertFalse(os.path.exists(self.paths[0]))

    def test_reject_foreign_origin(self):
        self.assertEqual(self.request(headers={"X-Al-Qalam-Test": "1", "Origin": "https://example.org"})[0], 403)

    def test_permits_configured_origin(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            handler_for(
                lambda _: {"transcript": "test", "differences": []},
                allowed_origins={"https://al-qalam.ru"},
            ),
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.assertEqual(
            self.request(headers={"X-Al-Qalam-Test": "1", "Origin": "https://al-qalam.ru"})[0],
            200,
        )

    def test_require_custom_header(self):
        self.assertEqual(self.request(headers={})[0], 403)

    def test_empty(self):
        self.assertEqual(self.request(body=b"")[0], 413)

    def test_oversize(self):
        self.assertEqual(self.request(body=b"", headers={"X-Al-Qalam-Test": "1", "Content-Length": str(MAX_BYTES + 1)})[0], 413)

    def test_health(self):
        self.assertEqual(self.request(method="GET", path="/ai-api/health", body=None)[0], 200)

    def test_live_snapshot(self):
        status, data = self.request(path="/ai-api/listen")
        self.assertEqual(status, 200)
        self.assertFalse(data["tracking"]["final"])
        self.assertEqual(len(self.live_paths), 1)
        self.assertEqual(len(self.paths), 0)

    def test_live_session_joins_overlapping_windows(self):
        self.live_transcripts = ["قل هو الله أحد", "الله أحد الله الصمد"]
        path = "/ai-api/listen?surah=112&ayah_from=1&ayah_to=4&session=test-session"
        self.assertEqual(self.request(path=f"{path}&seq=1")[0], 200)
        status, data = self.request(path=f"{path}&seq=2")
        self.assertEqual(status, 200)
        self.assertEqual(data["transcript"], "قل هو الله أحد الله الصمد")

    def test_live_final(self):
        status, data = self.request(path="/ai-api/listen/final")
        self.assertEqual(status, 200)
        self.assertTrue(data["tracking"]["final"])

    def test_selected_surah_and_range(self):
        status, data = self.request(path="/ai-api/listen/final?surah=2&ayah_from=5&ayah_to=7")
        self.assertEqual(status, 200)
        self.assertEqual(self.selections[-1], (2, 5, 7))
        self.assertEqual(data["selection"], {"surah": 2, "ayah_from": 5, "ayah_to": 7})

    def test_reject_invalid_selection(self):
        status, _ = self.request(path="/ai-api/listen?surah=0&ayah_from=1&ayah_to=2")
        self.assertEqual(status, 400)


class DecodeTests(unittest.TestCase):
    def wav(self, seconds):
        temp = tempfile.NamedTemporaryFile(suffix=".wav")
        with wave.open(temp.name, "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(16000)
            out.writeframes(b"\x00\x00" * int(16000 * seconds))
        return temp

    def test_silence(self):
        with self.wav(2) as temp:
            with self.assertRaisesRegex(ValueError, "не обнаружен звук"):
                decode_limited(temp.name)

    def test_duration_limit(self):
        with self.wav(61) as temp:
            with self.assertRaisesRegex(ValueError, "не длиннее"):
                decode_limited(temp.name)

    def test_short(self):
        with self.wav(0.5) as temp:
            with self.assertRaisesRegex(ValueError, "не короче"):
                decode_limited(temp.name)


class LiveMergeTests(unittest.TestCase):
    def test_overlap_is_not_repeated(self):
        self.assertEqual(
            merge_live_text("قل هو الله أحد الله الصمد", "الله الصمد لم يلد ولم يولد"),
            "قل هو الله أحد الله الصمد لم يلد ولم يولد",
        )

    def test_corrected_window_replaces_unstable_tail(self):
        self.assertEqual(
            merge_live_text(
                "بسم الله الرحمن الرحيم قل هو الله أحد أالله الشر",
                "قل هو الله أحد الله الصمد لم يلد ولم يولد",
            ),
            "بسم الله الرحمن الرحيم قل هو الله أحد الله الصمد لم يلد ولم يولد",
        )


if __name__ == "__main__":
    unittest.main()
