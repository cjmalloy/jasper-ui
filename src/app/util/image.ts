

export async function loadImage(file: File): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = URL.createObjectURL(file);
  try {
    await awaitImageLoad(image);
    return image;
  } finally {
    URL.revokeObjectURL(image.src);
  }
}

async function awaitImageLoad(image: HTMLImageElement): Promise<void> {
  if (image.complete && image.naturalWidth !== 0) return; // already loaded
await new Promise<void>((resolve, reject) => {
  const listener = (event: ErrorEvent | Event) => {
    image.removeEventListener('load', listener);
    image.removeEventListener('error', listener);
    if (event instanceof ErrorEvent) {
      reject('Image load error');
    } else {
      resolve();
    }
  };
  image.addEventListener('load', listener);
  image.addEventListener('error', listener);
});
}
