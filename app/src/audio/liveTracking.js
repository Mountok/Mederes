export function combineResults(preview, confirmed) {
  if (!preview) return confirmed
  if (!confirmed) return preview
  const words = preview.tracking.words.map((word, index) => {
    const verified = confirmed.tracking.words[index]
    return verified && ['matched', 'review'].includes(verified.state) ? verified : word
  })
  const tracking = {
    ...preview.tracking,
    words,
    aligned: preview.tracking.aligned || confirmed.tracking.aligned,
    reached: Math.max(preview.tracking.reached, confirmed.tracking.reached),
    matched: words.filter(word => word.state === 'matched').length,
    reviewed: words.filter(word => word.state === 'review').length,
  }
  return { ...preview, tracking, confirmed_model: confirmed.model }
}

export function keepAlignedProvisional(final, preview, confirmed) {
  const provisional = combineResults(preview, confirmed)
  if (final?.tracking?.aligned || !provisional?.tracking?.aligned) return final
  return { ...provisional, final_fallback: true }
}
