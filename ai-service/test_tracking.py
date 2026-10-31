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


if __name__ == "__main__":
    unittest.main()
