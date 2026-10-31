"""Loopback WebSocket microphone stream for the local recitation demo."""
import asyncio
import json
import time

from websockets.asyncio.server import serve

from analysis import compare
from quran_catalog import QuranCatalogError, get_ayah_range
from server import is_loopback_origin, merge_live_text
from tracking import track

MAX_AUDIO_SECONDS = 60
WINDOW_SECONDS = 12
PREVIEW_INTERVAL = 2.5
CONFIRM_INTERVAL = 8


async def serve_stream(preview, base, port=8002, allowed_origins=(), resolve_ayahs=get_ayah_range):
    permitted = set(allowed_origins)

    async def handle(ws):
        origin = ws.request.headers.get("Origin")
        if ws.request.path != "/ai-stream" or not origin or (origin not in permitted and not is_loopback_origin(origin)):
            await ws.close(code=1008, reason="Доступ запрещён для этого источника.")
            return
        frames = bytearray()
        preview_lock, base_lock, send_lock = asyncio.Lock(), asyncio.Lock(), asyncio.Lock()
        tasks = set()
        transcript = {"preview": "", "confirm": ""}
        last_sent = {"preview": 0, "confirm": 0}
        sequence = {"preview": 0, "confirm": 0}
        stopped = False

        async def send(message):
            async with send_lock:
                await ws.send(json.dumps(message, ensure_ascii=False))

        try:
            first = await asyncio.wait_for(ws.recv(), timeout=10)
            start = json.loads(first) if isinstance(first, str) else {}
            if start.get("type") != "start":
                raise ValueError("Сначала выберите суру.")
            surah, ayah_from, ayah_to = (int(start[key]) for key in ("surah", "ayah_from", "ayah_to"))
            sample_rate = int(start["sample_rate"])
            if not 8000 <= sample_rate <= 96000:
                raise ValueError("Некорректная частота записи.")
            ayahs = await asyncio.to_thread(resolve_ayahs, surah, ayah_from, ayah_to)
            selection = dict(surah=surah, ayah_from=ayah_from, ayah_to=ayah_to)
            await send({"type": "ready"})

            async def recognize(kind, audio, seq):
                model = preview if kind == "preview" else base
                lock = preview_lock if kind == "preview" else base_lock
                async with lock:
                    if stopped:
                        return
                    try:
                        result = await asyncio.to_thread(model.transcribe_pcm16, audio, sample_rate,
                                                         1 if kind == "preview" else None)
                    except ValueError:
                        return  # Silence and fragments are expected during reading.
                if stopped or seq < sequence[kind]:
                    return
                transcript[kind] = merge_live_text(transcript[kind], result["transcript"])
                result["transcript"] = transcript[kind]
                result.update(compare(result["transcript"], ayahs=ayahs, ayah_from=ayah_from))
                result["selection"] = selection
                result["tracking"] = track(result["transcript"], final=False,
                                           ayahs=ayahs, ayah_from=ayah_from)
                await send({"type": kind, "seq": seq, "result": result})

            async def schedule():
                while not stopped:
                    await asyncio.sleep(.25)
                    duration = len(frames) / (sample_rate * 2)
                    if duration < 2:
                        continue
                    now = time.monotonic()
                    for kind, interval, lock in (("preview", PREVIEW_INTERVAL, preview_lock),
                                                 ("confirm", CONFIRM_INTERVAL, base_lock)):
                        if kind == "confirm" and duration < CONFIRM_INTERVAL:
                            continue
                        if now - last_sent[kind] < interval or lock.locked():
                            continue
                        last_sent[kind] = now
                        sequence[kind] += 1
                        audio = bytes(frames[-int(WINDOW_SECONDS * sample_rate * 2):])
                        task = asyncio.create_task(recognize(kind, audio, sequence[kind]))
                        tasks.add(task)
                        task.add_done_callback(tasks.discard)

            scheduler = asyncio.create_task(schedule())
            try:
                async for message in ws:
                    if isinstance(message, bytes):
                        if len(message) % 2 or len(message) > 512 * 1024:
                            raise ValueError("Некорректный фрагмент аудио.")
                        if len(frames) + len(message) > MAX_AUDIO_SECONDS * sample_rate * 2:
                            raise ValueError("Запись ограничена 60 секундами.")
                        frames.extend(message)
                    elif json.loads(message).get("type") == "stop":
                        stopped = True
                        scheduler.cancel()
                        if len(frames) < sample_rate * 2:
                            raise ValueError("Читайте хотя бы одну секунду.")
                        async with base_lock:
                            result = await asyncio.to_thread(base.transcribe_pcm16, bytes(frames), sample_rate)
                        result.update(compare(result["transcript"], ayahs=ayahs, ayah_from=ayah_from))
                        result["selection"] = selection
                        result["tracking"] = track(result["transcript"], final=True,
                                                   ayahs=ayahs, ayah_from=ayah_from)
                        await send({"type": "final", "result": result})
                        break
            finally:
                stopped = True
                scheduler.cancel()
                for task in tasks:
                    task.cancel()
        except (ValueError, KeyError, TypeError, json.JSONDecodeError, QuranCatalogError) as exc:
            await send({"type": "error", "error": str(exc) or "Не удалось обработать запись."})
        except Exception:
            await send({"type": "error", "error": "Соединение с AI-сервисом прервалось."})
        finally:
            await ws.close()

    async with serve(handle, "127.0.0.1", port, max_size=512 * 1024, compression=None):
        await asyncio.Future()
