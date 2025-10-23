
export function emoji(emoji: string) {
  // @ts-ignore
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return false;
  g.canvas.width = g.canvas.height = 1;
  g.fillText(emoji, -4, 4);
  return g.getImageData(0, 0, 1, 1).data[3] > 0 && emoji;
}
