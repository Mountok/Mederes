export function combineResults(preview, confirmed) {
  if (!preview) return confirmed
  if (!confirmed) return preview
  const words = preview.tracking.words.map((word, index) => {
    const verified = confirmed.tracking.words[index]
    return verified && (['matched', 'review'].includes(verified.state) ||
      (verified.state === 'tentative' && word.state === 'pending')) ? verified : word
  })
  const aligned = preview.tracking.aligned || confirmed.tracking.aligned
  const tracking = {
    ...preview.tracking,
    words,
    aligned,
    low_confidence: !aligned && (preview.tracking.low_confidence || confirmed.tracking.low_confidence),
    tentative_count: words.filter(word => word.state === 'tentative').length,
    reached: Math.max(preview.tracking.reached, confirmed.tracking.reached),
    matched: words.filter(word => word.state === 'matched').length,
    reviewed: words.filter(word => word.state === 'review').length,
  }
  return { ...preview, tracking, confirmed_model: confirmed.model }
}

export function retainConfirmedWords(final, preview, confirmed) {
  const provisional = combineResults(preview, confirmed)
  if (final?.tracking?.aligned || !provisional?.tracking?.aligned) return final
  return { ...provisional, final_fallback: true }
}
