/** CSS aspect-ratio for a model ratio such as "2:3"; non-numeric ratios ("auto") fall back to square. */
export function cssAspectRatio(ratio: string): string {
  const [width, height] = ratio.split(':').map(Number)
  return width > 0 && height > 0 ? `${width} / ${height}` : '1 / 1'
}
