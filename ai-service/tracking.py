"""Prefix alignment for provisional live highlighting, not pronunciation scoring."""
from analysis import AYAHS, BASMALA, normalize

OPENINGS = ["أعوذ بالله من الشيطان الرجيم", BASMALA]


def sparse_matches(reference, heard):
    """Find ordered exact words without treating other ASR output as errors."""
    n, m = len(reference), len(heard)
    lengths = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            lengths[i][j] = (1 + lengths[i + 1][j + 1] if reference[i] == heard[j]
                             else max(lengths[i + 1][j], lengths[i][j + 1]))
    i = j = 0
    pairs = []
    while i < n and j < m:
        if reference[i] == heard[j]:
            pairs.append((i, j))
            i += 1
            j += 1
        elif lengths[i + 1][j] >= lengths[i][j + 1]:
            i += 1
        else:
            j += 1
    return pairs


def track(text, final=False, ayahs=None, ayah_from=1):
    ayahs = AYAHS if ayahs is None else ayahs
    if not ayahs:
        raise ValueError("Не выбран текст для сопоставления.")
    heard = normalize(text).split()
    for opening in OPENINGS:
        prefix = normalize(opening).split()
        if heard and heard == prefix[:len(heard)]:
            heard = []
            break
        if heard[:len(prefix)] == prefix:
            heard = heard[len(prefix):]
    display = [word for ayah in ayahs for word in ayah.split()]
    ref = normalize(" ".join(ayahs)).split()
    # A short, imperfect basmala can precede the selected text in a live window.
    # Only trim it when the first three reference words are heard in sequence.
    if not final and len(ref) >= 3 and len(heard) >= 4:
        for start in range(1, min(9, len(heard) - 2)):
            if heard[start:start + 3] == ref[:3]:
                heard = heard[start:]
                break
    states = [dict(index=i, text=word, state="pending", heard=None) for i, word in enumerate(display)]
    empty = dict(words=states, matched=0, reviewed=0, reached=0, total=len(ref),
                 ayah_from=ayah_from, ayah_to=ayah_from + len(ayahs) - 1,
                 aligned=False, final=final, complete=False)
    if not heard:
        return empty
    # Trailing reference words have no cost: they may simply not have been read yet.
    n, m = len(ref), len(heard)
    if m > 200:
        return empty
    # Break equal edit-cost ties in favour of actual matching words, not short prefixes.
    dp = [[(0, 0)]*(m+1) for _ in range(n+1)]
    for i in range(n+1): dp[i][0] = (i, 0)
    for j in range(m+1): dp[0][j] = (j, 0)
    for i in range(1, n+1):
        for j in range(1, m+1):
            above, left, diagonal = dp[i-1][j], dp[i][j-1], dp[i-1][j-1]
            same = ref[i-1] == heard[j-1]
            dp[i][j] = min((above[0]+1, above[1]), (left[0]+1, left[1]),
                           (diagonal[0]+int(not same), diagonal[1]-int(same)))
    end = min(range(n+1), key=lambda i: (*dp[i][m], abs(i-m), i))
    i, j, matches, edits = end, m, 0, []
    while i or j:
        if i and j and dp[i][j] == (dp[i-1][j-1][0]+int(ref[i-1] != heard[j-1]), dp[i-1][j-1][1]-int(ref[i-1] == heard[j-1])):
            same = ref[i-1] == heard[j-1]
            matches += int(same)
            edits.append((i-1, "matched" if same else "review", heard[j-1]))
            i, j = i-1, j-1
        elif i and dp[i][j] == (dp[i-1][j][0]+1, dp[i-1][j][1]):
            edits.append((i-1, "review", None))
            i -= 1
        else:
            edits.append((max(0, i-1), "review", heard[j-1]))
            j -= 1
    # Sparse ASR matches can indicate position, but cannot confirm reading.
    # Show them as tentative instead of turning the entire verse into an error.
    if matches < 2 or matches / max(m, end, 1) < 0.45:
        candidates = sparse_matches(ref, heard)
        if len(candidates) == 1 and candidates[0] != (0, 0):
            return empty
        for index, heard_index in candidates:
            states[index].update(state="tentative", heard=heard[heard_index])
        if not candidates:
            return empty
        return dict(empty, words=states, reached=candidates[-1][0] + 1, low_confidence=True,
                    tentative_count=len(candidates))
    for index, state, observed in reversed(edits):
        if states[index]["state"] != "review":
            states[index].update(state=state, heard=observed)
    # The newest words can change on the next ASR pass; do not flag them prematurely.
    if not final:
        for index in range(max(0, end-2), end):
            states[index]["state"] = "tentative"
    return dict(words=states, matched=sum(w["state"] == "matched" for w in states),
                reviewed=sum(w["state"] == "review" for w in states), reached=end,
                total=n, ayah_from=ayah_from, ayah_to=ayah_from + len(ayahs) - 1,
                aligned=True, final=final, complete=end == n)
