import unittest
from analysis import AYAHS, BASMALA, normalize
from tracking import track


class TrackingTests(unittest.TestCase):
    def test_partial_does_not_flag_future(self):
        result = track(AYAHS[0], final=True)
        self.assertEqual(result["matched"], 4)
        self.assertEqual(result["reviewed"], 0)
        self.assertTrue(all(w["state"] == "pending" for w in result["words"][4:]))

    def test_live_tail_tentative(self):
        result = track(AYAHS[0])
        self.assertEqual([w["state"] for w in result["words"][:4]], ["matched", "matched", "tentative", "tentative"])

    def test_complete(self):
        result = track(BASMALA + " " + " ".join(AYAHS), final=True)
        self.assertTrue(result["complete"])
        self.assertEqual(result["matched"], 15)

    def test_opening_only(self):
        for text in ["", "بسم الله", BASMALA, "أعوذ بالله من الشيطان الرجيم " + BASMALA]:
            self.assertFalse(track(text)["aligned"])

    def test_unrelated(self):
        self.assertFalse(track("شكرا لكم على المشاهدة")["aligned"])

    def test_sparse_recognition_only_highlights_tentative_words(self):
        text = "اللَّهُ أَعَتْهُ اللَّهُ السَّمَتْ لَهَمْ وَلِتْ وَلَمْ يُؤْذَتْ وَلَمِّكُ اللَّهُ كُفُرًا أَحَدٌ"
        result = track(text, final=True)
        self.assertFalse(result["aligned"])
        self.assertTrue(result["low_confidence"])
        self.assertEqual(result["matched"], 0)
        self.assertGreaterEqual(sum(word["state"] == "tentative" for word in result["words"]), 3)
        self.assertFalse(any(word["state"] in {"matched", "review"} for word in result["words"]))

    def test_first_word_can_be_tentative_while_asr_is_still_short(self):
        result = track("قُلْ وَاللَّهُ")
        self.assertEqual(result["words"][0]["state"], "tentative")
        self.assertFalse(result["aligned"])

    def test_middle_omission(self):
        words = normalize(" ".join(AYAHS)).split()
        del words[2]
        result = track(" ".join(words), final=True)
        self.assertEqual(result["words"][2]["state"], "review")

    def test_repeat(self):
        result = track("قل قل هو الله أحد", final=True)
        self.assertGreater(result["reviewed"], 0)

    def test_matching_final_word_is_not_left_pending(self):
        result = track("قل هو الله أحد الله السمد لم يلد ولم يولد ولم يكله كهوان أحد", final=True)
        self.assertEqual(result["words"][-1]["state"], "matched")
        self.assertTrue(result["complete"])

    def test_custom_reference_range(self):
        result = track("الحمد لله", final=True, ayahs=["الْحَمْدُ لِلَّهِ"], ayah_from=2)
        self.assertTrue(result["complete"])
        self.assertEqual(result["ayah_from"], 2)
        self.assertEqual(result["ayah_to"], 2)

    def test_live_window_tolerates_imperfect_opening(self):
        result = track("إسم الله الرحمن قل هم قل هو الله أحد")
        self.assertTrue(result["aligned"])
        self.assertGreaterEqual(result["matched"], 2)

    def test_final_does_not_discard_words_before_selected_text(self):
        result = track("كلام غير متعلق قل هو الله أحد", final=True)
        self.assertGreater(result["reviewed"], 0)


if __name__ == "__main__":
    unittest.main()
