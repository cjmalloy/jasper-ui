import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({ selector: '[kbVideo]' })
export class KbVideoDirective {

  constructor(private el: ElementRef<HTMLVideoElement>) { }

  private seekEnd(video: HTMLVideoElement): number | undefined {
    if (isFinite(video.duration)) return video.duration;
    if (video.seekable.length) return video.seekable.end(video.seekable.length - 1);
    return undefined;
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    const video = this.el.nativeElement;
    switch (event.key) {
      case ' ':
      case 'k':
      case 'K':
        if (event.repeat) break;
        event.preventDefault();
        if (video.paused) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
        break;
      case 'j':
      case 'J':
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case 'l':
      case 'L': {
        event.preventDefault();
        const end = this.seekEnd(video);
        if (end !== undefined) video.currentTime = Math.min(end, video.currentTime + 10);
        break;
      }
      case 'ArrowLeft':
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        break;
      case 'ArrowRight': {
        event.preventDefault();
        const end = this.seekEnd(video);
        if (end !== undefined) video.currentTime = Math.min(end, video.currentTime + 5);
        break;
      }
      case 'ArrowUp':
        event.preventDefault();
        video.volume = Math.min(1, video.volume + 0.05);
        break;
      case 'ArrowDown':
        event.preventDefault();
        video.volume = Math.max(0, video.volume - 0.05);
        break;
      case 'f':
      case 'F':
        if (event.repeat) break;
        event.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          video.requestFullscreen?.().catch(() => {});
        }
        break;
      case 'm':
      case 'M':
        if (event.repeat) break;
        event.preventDefault();
        video.muted = !video.muted;
        break;
      case 'Home':
        event.preventDefault();
        video.currentTime = 0;
        break;
      case 'End': {
        event.preventDefault();
        const end = this.seekEnd(video);
        if (end !== undefined) video.currentTime = end;
        break;
      }
      default:
        if (event.key >= '0' && event.key <= '9') {
          event.preventDefault();
          const end = this.seekEnd(video);
          if (end !== undefined) video.currentTime = end * parseInt(event.key, 10) / 10;
        }
        break;
    }
  }

}
