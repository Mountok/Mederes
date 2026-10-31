"""Canonical Quran text resolver for the local demo.

The browser chooses only a surah and ayah range. Canonical Arabic text is loaded
server-side from the same public Quran API used by the frontend, then cached in
memory. Client-provided reference text is deliberately not trusted.
"""
import json
import threading
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from analysis import AYAHS, BASMALA, normalize

API_BASE_URLS = (
    "https://alquran.api.alislam.ru/v1",
    "https://api.alquran.cloud/v1",
)
MAX_AYAHS_PER_ATTEMPT = 10
_CACHE = {112: tuple(AYAHS)}
_LOCK = threading.Lock()


class QuranCatalogError(ValueError):
    pass


def validate_selection(surah, ayah_from, ayah_to):
    if not 1 <= surah <= 114:
        raise QuranCatalogError("Номер суры должен быть от 1 до 114.")
    if ayah_from < 1 or ayah_to < ayah_from:
        raise QuranCatalogError("Выберите корректный диапазон аятов.")
    if ayah_to - ayah_from + 1 > MAX_AYAHS_PER_ATTEMPT:
        raise QuranCatalogError(f"За одну попытку можно выбрать до {MAX_AYAHS_PER_ATTEMPT} аятов.")


def _download_surah(surah):
    last_error = None
    for base_url in API_BASE_URLS:
        try:
            request = Request(
                f"{base_url}/surah/{surah}/quran-uthmani",
                headers={"Accept": "application/json", "User-Agent": "Al-Qalam-local-MVP/1.0"},
            )
            with urlopen(request, timeout=12) as response:
                payload = json.load(response)
            ayahs = payload.get("data", {}).get("ayahs", [])
            texts = tuple(item.get("text", "").strip() for item in ayahs)
            if not texts or any(not text for text in texts):
                raise QuranCatalogError("Quran API вернул неполный текст суры.")
            if surah not in {1, 9}:
                first_tokens = texts[0].split()
                prefix_size = len(normalize(BASMALA).split())
                if normalize(" ".join(first_tokens[:prefix_size])) == normalize(BASMALA):
                    texts = (" ".join(first_tokens[prefix_size:]), *texts[1:])
                    if not texts[0]:
                        raise QuranCatalogError("Quran API вернул некорректный первый аят.")
            return texts
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, QuranCatalogError) as exc:
            last_error = exc
    raise QuranCatalogError("Не удалось получить текст суры. Проверьте интернет и повторите.") from last_error


def get_surah(surah):
    with _LOCK:
        cached = _CACHE.get(surah)
    if cached is not None:
        return cached
    downloaded = _download_surah(surah)
    with _LOCK:
        return _CACHE.setdefault(surah, downloaded)


def get_ayah_range(surah, ayah_from, ayah_to):
    validate_selection(surah, ayah_from, ayah_to)
    ayahs = get_surah(surah)
    if ayah_to > len(ayahs):
        raise QuranCatalogError(f"В выбранной суре только {len(ayahs)} аятов.")
    return list(ayahs[ayah_from - 1:ayah_to])
