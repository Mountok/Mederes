import unittest

from quran_catalog import MAX_AYAHS_PER_ATTEMPT, QuranCatalogError, get_ayah_range, validate_selection


class QuranCatalogTests(unittest.TestCase):
    def test_bundled_fallback_for_al_ikhlas(self):
        self.assertEqual(len(get_ayah_range(112, 1, 4)), 4)

    def test_reject_unknown_surah(self):
        with self.assertRaises(QuranCatalogError):
            validate_selection(115, 1, 1)

    def test_reject_reversed_range(self):
        with self.assertRaises(QuranCatalogError):
            validate_selection(1, 4, 2)

    def test_limit_attempt_size(self):
        with self.assertRaises(QuranCatalogError):
            validate_selection(2, 1, MAX_AYAHS_PER_ATTEMPT + 1)


if __name__ == "__main__":
    unittest.main()
