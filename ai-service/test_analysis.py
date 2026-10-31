import unittest
from analysis import AYAHS, BASMALA, compare, normalize

class AnalysisTests(unittest.TestCase):
    def test_correct(self):
        self.assertEqual(compare(" ".join(AYAHS))["differences"], [])
    def test_basmala(self):
        result=compare(BASMALA+" "+" ".join(AYAHS))
        self.assertTrue(result["basmala_removed"])
        self.assertFalse(result["differences"])
    def test_missing(self):
        words=normalize(" ".join(AYAHS)).split()
        del words[2]
        self.assertEqual(compare(" ".join(words))["differences"][0]["type"],"omission")
    def test_repeat(self):
        words=normalize(" ".join(AYAHS)).split()
        words.insert(1,words[0])
        self.assertEqual(compare(" ".join(words))["word_distance"],1)
        self.assertEqual(compare(" ".join(words))["differences"][0]["type"],"possible_repetition")
    def test_replace(self):
        words=normalize(" ".join(AYAHS)).split()
        words[2]="كتاب"
        self.assertEqual(compare(" ".join(words))["differences"][0]["type"],"substitution")
    def test_empty(self):
        self.assertEqual(compare("")["word_distance"],15)
    def test_custom_ayah_range_keeps_absolute_ayah_number(self):
        result = compare("قل كتاب", ayahs=["قل هو"], ayah_from=17)
        self.assertEqual(result["differences"][0]["ayah"], 17)

if __name__ == "__main__":
    unittest.main()
