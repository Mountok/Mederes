import axios from 'axios'

const QURAN_API_BASE_URLS = [
  'https://alquran.api.alislam.ru/v1',
  'https://api.alquran.cloud/v1',
]
const ARABIC_MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g

function normalizeArabic(text) {
  return text
    .normalize('NFKC')
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱى]/g, character => ({ أ: 'ا', إ: 'ا', آ: 'ا', ٱ: 'ا', ى: 'ي' })[character])
}

function withoutDuplicatedBasmala(surah) {
  if (!surah?.ayahs?.length || [1, 9].includes(surah.number)) return surah
  const first = surah.ayahs[0]
  const tokens = first.text.trim().split(/\s+/)
  if (normalizeArabic(tokens.slice(0, 4).join(' ')) !== 'بسم الله الرحمن الرحيم') return surah
  return {
    ...surah,
    ayahs: [{ ...first, text: tokens.slice(4).join(' ') }, ...surah.ayahs.slice(1)],
  }
}

async function requestQuran(path, params = {}, options = {}) {
  let lastError = null

  for (const baseURL of QURAN_API_BASE_URLS) {
    try {
      const { data } = await axios.get(`${baseURL}${path}`, { params, ...options })
      return data.data
    } catch (error) {
      if (options.signal?.aborted) throw error
      lastError = error
    }
  }

  throw lastError
}

export async function getSurahs() {
  return requestQuran('/surah')
}

export async function getRussianEditions() {
  return requestQuran('/edition', {
    format: 'text',
    language: 'ru',
    type: 'translation',
  })
}

export async function getSurahArabic(surahNumber, options = {}) {
  const surah = await requestQuran(`/surah/${surahNumber}/quran-uthmani`, {}, options)
  return withoutDuplicatedBasmala(surah)
}

export async function getSurahTranslation(surahNumber, edition) {
  return requestQuran(`/surah/${surahNumber}/${edition}`)
}

export async function getSurahAudio(surahNumber, edition = 'ar.alafasy', options = {}) {
  return requestQuran(`/surah/${surahNumber}/${edition}`, {}, options)
}
