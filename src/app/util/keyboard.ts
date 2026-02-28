export function seekEnd(video: HTMLVideoElement): number | undefined {
  if (isFinite(video.duration)) return video.duration;
  if (video.seekable.length) return video.seekable.end(video.seekable.length - 1);
  return undefined;
}

export function handleVideoKeydown(event: KeyboardEvent, video: HTMLVideoElement) {
  switch (event.key) {
    case ' ':
    case 'k':
    case 'K':
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      if (video.paused) {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
      break;
    case 'j':
    case 'J':
      event.preventDefault();
      event.stopPropagation();
      video.currentTime = Math.max(0, video.currentTime - 10);
      break;
    case 'l':
    case 'L': {
      event.preventDefault();
      event.stopPropagation();
      const end = seekEnd(video);
      if (end !== undefined) video.currentTime = Math.min(end, video.currentTime + 10);
      break;
    }
    case 'ArrowLeft':
      event.preventDefault();
      event.stopPropagation();
      video.currentTime = Math.max(0, video.currentTime - 5);
      break;
    case 'ArrowRight': {
      event.preventDefault();
      event.stopPropagation();
      const end = seekEnd(video);
      if (end !== undefined) video.currentTime = Math.min(end, video.currentTime + 5);
      break;
    }
    case 'ArrowUp':
      event.preventDefault();
      event.stopPropagation();
      video.volume = Math.min(1, video.volume + 0.05);
      break;
    case 'ArrowDown':
      event.preventDefault();
      event.stopPropagation();
      video.volume = Math.max(0, video.volume - 0.05);
      break;
    case 'f':
    case 'F':
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else {
        video.requestFullscreen?.().catch(() => {});
      }
      break;
    case 'm':
    case 'M':
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      video.muted = !video.muted;
      break;
    case ',':
      event.preventDefault();
      event.stopPropagation();
      if (video.paused && 'requestVideoFrameCallback' in video) {
        (video as any).requestVideoFrameCallback((_: DOMHighResTimeStamp, metadata: any) => {
          video.currentTime = Math.max(0, metadata.mediaTime - 0.001);
        });
        // Re-assign to trigger a seek, which composites a frame and fires the callback
        video.currentTime = video.currentTime;
      }
      break;
    case '.':
      event.preventDefault();
      event.stopPropagation();
      if (video.paused && 'requestVideoFrameCallback' in video) {
        (video as any).requestVideoFrameCallback(() => video.pause());
        void video.play().catch(() => {});
      }
      break;
    case 'Home':
      event.preventDefault();
      event.stopPropagation();
      video.currentTime = 0;
      break;
    case 'End': {
      event.preventDefault();
      event.stopPropagation();
      const end = seekEnd(video);
      if (end !== undefined) video.currentTime = end;
      break;
    }
    default:
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        event.stopPropagation();
        const end = seekEnd(video);
        if (end !== undefined) video.currentTime = end * parseInt(event.key, 10) / 10;
      }
      break;
  }
}
