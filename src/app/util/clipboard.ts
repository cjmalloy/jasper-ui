export function clipboardPasteValues(event: Event) {
  return event instanceof CustomEvent && Array.isArray(event.detail) ? event.detail as string[] : [];
}

/**
 * Write an image to the system clipboard as PNG.
 * The ClipboardItem is created synchronously with a pending blob so the
 * write keeps the user activation of the click that started it.
 */
export function copyImage(image: Promise<Blob | string>) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return Promise.reject(new Error('Copying images is not supported'));
  }
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': image.then(pngBlob) })]);
}

/**
 * Convert an image blob or URL into a PNG blob.
 */
export async function pngBlob(src: Blob | string): Promise<Blob> {
  if (src instanceof Blob && src.type === 'image/png') return src;
  const url = src instanceof Blob ? URL.createObjectURL(src) : src;
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob
      ? resolve(blob)
      : reject(new Error('Could not encode image')), 'image/png'));
  } finally {
    if (src instanceof Blob) URL.revokeObjectURL(url);
  }
}
