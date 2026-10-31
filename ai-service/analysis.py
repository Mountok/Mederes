"""Conservative word-level comparison; not pronunciation/tajweed assessment."""
import unicodedata

AYAHS = [
    "قُلْ هُوَ اللَّهُ أَحَدٌ",
    "اللَّهُ الصَّمَدُ",
    "لَمْ يَلِدْ وَلَمْ يُولَدْ",
    "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
]
BASMALA = "بسم الله الرحمن الرحيم"


def normalize(text):
    text = unicodedata.normalize("NFKC", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn" and c != "ـ")
    text = text.translate(str.maketrans("أإآٱى", "ااااي"))
    return " ".join("".join(c if c.isalpha() or c.isspace() else " " for c in text).split())


def compare(text, ayahs=None, ayah_from=1):
    ayahs = AYAHS if ayahs is None else ayahs
    if not ayahs:
        raise ValueError("Не выбран текст для сравнения.")
    observed = normalize(text).split()
    prefix = normalize(BASMALA).split()
    basmala_removed = observed[:len(prefix)] == prefix
    if basmala_removed:
        observed = observed[len(prefix):]
    ref = normalize(" ".join(ayahs)).split()
    locations = [(ayah_from + a, w + 1) for a, ayah in enumerate(ayahs)
                 for w, _ in enumerate(normalize(ayah).split())]
    n, m = len(ref), len(observed)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dp[i][j] = min(dp[i-1][j]+1, dp[i][j-1]+1,
                           dp[i-1][j-1]+(ref[i-1] != observed[j-1]))
    i, j, changes = n, m, []
    while i or j:
        if i and j and ref[i-1] == observed[j-1] and dp[i][j] == dp[i-1][j-1]:
            i, j = i-1, j-1
            continue
        if i and j and dp[i][j] == dp[i-1][j-1]+1:
            kind, expected, heard, index = "substitution", ref[i-1], observed[j-1], i-1
            i, j = i-1, j-1
        elif i and dp[i][j] == dp[i-1][j]+1:
            kind, expected, heard, index = "omission", ref[i-1], None, i-1
            i -= 1
        else:
            heard, index = observed[j-1], max(0, i-1)
            repeated = (j > 1 and heard == observed[j-2]) or (j < m and heard == observed[j])
            kind = "possible_repetition" if repeated else "insertion"
            expected = None
            j -= 1
        ayah, word = locations[index]
        changes.append(dict(type=kind, expected=expected, observed=heard,
                            reference_index=index, ayah=ayah, word=word))
    return dict(reference=ayahs, normalized_transcript=" ".join(observed),
                basmala_removed=basmala_removed, differences=list(reversed(changes)),
                word_distance=dp[n][m], reference_word_count=n,
                transcript_reference_distance=round(dp[n][m]/n, 4),
                requires_teacher_review=True,
                warning="Расхождения могут быть ошибками распознавания. Это не оценка таджвида или точности модели.")
