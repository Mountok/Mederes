import axios from 'axios'

const QURAN_API_BASE_URLS = [
  'https://alquran.api.alislam.ru/v1',
  'https://api.alquran.cloud/v1',
]

async function requestQuran(path, params = {}) {
  let lastError = null

  for (const baseURL of QURAN_API_BASE_URLS) {
    try {
      const { data } = await axios.get(`${baseURL}${path}`, { params })
      return data.data
    } catch (error) {
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

export async function getSurahArabic(surahNumber) {
  return requestQuran(`/surah/${surahNumber}/quran-uthmani`)
}

export async function getSurahTranslation(surahNumber, edition) {
  return requestQuran(`/surah/${surahNumber}/${edition}`)
}

export async function getSurahAudio(surahNumber, edition = 'ar.alafasy') {
  return requestQuran(`/surah/${surahNumber}/${edition}`)
}
