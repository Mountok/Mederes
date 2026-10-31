"""Loopback-only development API. Do not expose directly to the internet."""
import argparse
from difflib import SequenceMatcher
import json
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from analysis import AYAHS, compare, normalize
from quran_catalog import QuranCatalogError, get_ayah_range
from recognition import Recognizer, decode_limited
from tracking import track

MAX_BYTES = 20 * 1024 * 1024
TARTEEL_MODEL = Path(__file__).parent / "models/tarteel-faster-whisper-base"
DEFAULT_MODEL = (
    str(TARTEEL_MODEL)
    if all((TARTEEL_MODEL / name).exists() for name in ("model.bin", "tokenizer.json"))
    else "small"
)


LOCAL_ORIGINS = {
    "http://localhost",
    "https://localhost",
    "http://127.0.0.1",
    "https://127.0.0.1",
}


def is_loopback_origin(origin):
    try:
        parsed = urlsplit(origin)
        return (parsed.scheme in {"http", "https"}
                and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
                and parsed.port != 0
                and not (parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment))
    except ValueError:
        return False


def merge_live_text(previous, current):
    """Replace the unstable tail where adjacent ASR windows share a phrase."""
    old, new = previous.split(), current.split()
    if not old:
        return current
    old_keys = normalize(previous).split()
    new_keys = normalize(current).split()
    matcher = SequenceMatcher(None, old_keys[-24:], new_keys[:24], autojunk=False)
    match = matcher.find_longest_match(0, min(24, len(old_keys)), 0, min(24, len(new_keys)))
    if match.size >= 2:
        start = len(old_keys) - min(24, len(old_keys)) + match.a
        return " ".join(old[:start] + new[match.b:])
    if old_keys[-1:] == new_keys[:1]:
        return " ".join(old + new[1:])
    return " ".join(old + new)


def handler_for(
    recognize,
    resolve_ayahs=get_ayah_range,
    model_name=None,
    recognize_live=None,
    recognize_confirm=None,
    preview_model_name=None,
    allowed_origins=None,
):
    lock = threading.Lock()
    preview_lock = threading.Lock()
    sessions = {}
    sessions_lock = threading.Lock()
    final_waiting = threading.Event()
    permitted_origins = set(allowed_origins or LOCAL_ORIGINS)

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(30)

        def reply(self, status, data):
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/ai-api/health":
                self.reply(200, {"status": "ok", "mode": "local-test", "model": model_name,
                                 "preview_model": preview_model_name or model_name})
            else:
                self.reply(404, {"error": "Не найдено."})

        def do_POST(self):
            url = urlsplit(self.path)
            if url.path not in {"/ai-api/analyze", "/ai-api/listen", "/ai-api/confirm", "/ai-api/listen/final"}:
                self.reply(404, {"error": "Не найдено."})
                return
            origin = self.headers.get("Origin")
            if (origin and origin not in permitted_origins and not is_loopback_origin(origin)) or self.headers.get("X-Al-Qalam-Test") != "1":
                self.reply(403, {"error": "Доступ запрещён для этого источника."})
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                size = 0
            if self.headers.get("Transfer-Encoding") or not 0 < size <= MAX_BYTES:
                self.reply(413, {"error": "Выберите непустой файл размером до 20 МБ."})
                return
            try:
                query = parse_qs(url.query)
                surah = int(query.get("surah", [112])[0])
                ayah_from = int(query.get("ayah_from", [1])[0])
                ayah_to = int(query.get("ayah_to", [len(AYAHS)])[0])
                ayahs = resolve_ayahs(surah, ayah_from, ayah_to)
            except (TypeError, ValueError, QuranCatalogError) as exc:
                self.reply(400, {"error": str(exc) or "Некорректный выбор суры."})
                return
            final = url.path == "/ai-api/listen/final"
            preview = url.path == "/ai-api/listen"
            if final:
                final_waiting.set()
                acquired = lock.acquire(timeout=45)
            else:
                acquired = not final_waiting.is_set() and (preview_lock if preview else lock).acquire(blocking=False)
            if not acquired:
                self.reply(429, {"error": "Сервис занят. Повторите чуть позже."})
                if final:
                    final_waiting.clear()
                return
            try:
                session_id = query.get("session", [""])[0]
                sequence = int(query.get("seq", [0])[0])
                if session_id and (len(session_id) > 80 or sequence < 0):
                    raise ValueError("Некорректная сессия чтения.")
                with tempfile.NamedTemporaryFile(suffix=".audio") as upload:
                    remaining = size
                    while remaining:
                        chunk = self.rfile.read(min(65536, remaining))
                        if not chunk:
                            raise ValueError("Загрузка файла прервалась.")
                        upload.write(chunk)
                        remaining -= len(chunk)
                    upload.flush()
                    recognizer_for_request = (
                        recognize_live if preview and recognize_live else
                        recognize_confirm if url.path == "/ai-api/confirm" and recognize_confirm else recognize
                    )
                    result = recognizer_for_request(upload.name)
                    if session_id and url.path in {"/ai-api/listen", "/ai-api/confirm"}:
                        with sessions_lock:
                            now = time.monotonic()
                            for key, value in list(sessions.items()):
                                if now - value["updated"] > 180:
                                    del sessions[key]
                            state = sessions.setdefault((session_id, url.path), {"seq": -1, "text": "", "updated": now})
                            if sequence > state["seq"]:
                                state["text"] = merge_live_text(state["text"], result["transcript"])
                                state["seq"] = sequence
                            state["updated"] = now
                            result["transcript"] = state["text"]
                    elif session_id and final:
                        with sessions_lock:
                            sessions.pop((session_id, "/ai-api/listen"), None)
                            sessions.pop((session_id, "/ai-api/confirm"), None)
                    result.update(compare(result["transcript"], ayahs=ayahs, ayah_from=ayah_from))
                    result["selection"] = {
                        "surah": surah,
                        "ayah_from": ayah_from,
                        "ayah_to": ayah_to,
                    }
                    result["tracking"] = track(
                        result["transcript"],
                        final=url.path != "/ai-api/listen",
                        ayahs=ayahs,
                        ayah_from=ayah_from,
                    )
                self.reply(200, result)
            except ValueError as exc:
                self.reply(422, {"error": str(exc)})
            except (BrokenPipeError, ConnectionResetError):
                pass
            except TimeoutError:
                self.reply(408, {"error": "Загрузка заняла слишком много времени."})
            except Exception:
                self.reply(422, {"error": "Не удалось обработать аудио. Попробуйте MP3, WAV или M4A без повреждений."})
            finally:
                (preview_lock if preview else lock).release()
                if final:
                    final_waiting.clear()

    return Handler


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--vad", action="store_true", help="Experimental pause filtering")
    parser.add_argument(
        "--allowed-origin",
        action="append",
        default=[],
        help="Exact browser origin allowed to use the service; repeat for each origin.",
    )
    args = parser.parse_args()
    recognizer = Recognizer(args.model, beam_size=args.beam_size, vad=args.vad)

    preview_path = Path(__file__).parent / "models/tarteel-faster-whisper-tiny"
    preview = Recognizer(str(preview_path), beam_size=1) if all(
        (preview_path / name).exists() for name in ("model.bin", "tokenizer.json")
    ) else recognizer

    def recognize_live(path):
        return preview.transcribe(path, beam_size=1)

    server = ThreadingHTTPServer(
        ("127.0.0.1", args.port),
        handler_for(
            recognizer.transcribe,
            model_name=recognizer.name,
            recognize_live=recognize_live,
            recognize_confirm=recognizer.transcribe,
            preview_model_name=preview.name,
            allowed_origins=LOCAL_ORIGINS | set(args.allowed_origin),
        ),
    )
    print(f"AI test API: http://127.0.0.1:{args.port} (local only); model={recognizer.name}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
