export function seekEnd(media: HTMLMediaElement): number | undefined {
  if (isFinite(media.duration)) return media.duration;
  if (media.seekable.length) return media.seekable.end(media.seekable.length - 1);
  return undefined;
}

export function handleMediaKeydown(event: KeyboardEvent, media: HTMLMediaElement) {
  const isVideo = media instanceof HTMLVideoElement;
  switch (event.key) {
    case ' ':
    case 'k':
    case 'K':
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      if (media.paused) {
        void media.play().catch(() => {});
      } else {
        media.pause();
      }
      break;
    case 'j':
    case 'J':
      event.preventDefault();
      event.stopPropagation();
      media.currentTime = Math.max(0, media.currentTime - 10);
      break;
    case 'l':
    case 'L': {
      event.preventDefault();
      event.stopPropagation();
      const end = seekEnd(media);
      if (end !== undefined) media.currentTime = Math.min(end, media.currentTime + 10);
      break;
    }
    case 'ArrowLeft':
      event.preventDefault();
      event.stopPropagation();
      media.currentTime = Math.max(0, media.currentTime - 5);
      break;
    case 'ArrowRight': {
      event.preventDefault();
      event.stopPropagation();
      const end = seekEnd(media);
      if (end !== undefined) media.currentTime = Math.min(end, media.currentTime + 5);
      break;
    }
    case 'ArrowUp':
      event.preventDefault();
      event.stopPropagation();
      media.volume = Math.min(1, media.volume + 0.05);
      break;
    case 'ArrowDown':
      event.preventDefault();
      event.stopPropagation();
      media.volume = Math.max(0, media.volume - 0.05);
      break;
    case 'f':
    case 'F':
      if (!isVideo) return;
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else {
        (media as HTMLVideoElement).requestFullscreen?.().catch(() => {});
      }
      break;
    case 'm':
    case 'M':
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      media.muted = !media.muted;
      break;
    case ',':
      if (!isVideo) return;
      event.preventDefault();
      event.stopPropagation();
      if (media.paused && 'requestVideoFrameCallback' in media) {
        (media as any).requestVideoFrameCallback((_: DOMHighResTimeStamp, metadata: any) => {
          media.currentTime = Math.max(0, metadata.mediaTime - 0.001);
        });
        // Re-assign to trigger a seek, which composites a frame and fires the callback
        media.currentTime = media.currentTime;
      }
      break;
    case '.':
      if (!isVideo) return;
      event.preventDefault();
      event.stopPropagation();
      if (media.paused && 'requestVideoFrameCallback' in media) {
        const wasMuted = media.muted;
        media.muted = true;
        (media as any).requestVideoFrameCallback(() => {
          media.pause();
          media.muted = wasMuted;
        });
        void media.play().catch(() => {});
      }
      break;
    case 'Home':
      event.preventDefault();
      event.stopPropagation();
      media.currentTime = 0;
      break;
    case 'End': {
      event.preventDefault();
      event.stopPropagation();
      const end = seekEnd(media);
      if (end !== undefined) media.currentTime = end;
      break;
    }
    default:
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        event.stopPropagation();
        const end = seekEnd(media);
        if (end !== undefined) media.currentTime = end * parseInt(event.key, 10) / 10;
      }
      break;
  }
}

export function handleVideoKeydown(event: KeyboardEvent, video: HTMLVideoElement) {
  handleMediaKeydown(event, video);
}
