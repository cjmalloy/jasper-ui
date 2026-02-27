import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({ selector: '[kbVideo]' })
export class KbVideoDirective {

  constructor(private el: ElementRef<HTMLVideoElement>) { }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    const video = this.el.nativeElement;
    switch (event.key) {
      case ' ':
      case 'k':
      case 'K':
        event.preventDefault();
        video.paused ? video.play() : video.pause();
        break;
      case 'j':
      case 'J':
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case 'l':
      case 'L':
        event.preventDefault();
        if (isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 5);
        break;
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
        event.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          video.requestFullscreen();
        }
        break;
      case 'm':
      case 'M':
        event.preventDefault();
        video.muted = !video.muted;
        break;
      case 'Home':
        event.preventDefault();
        video.currentTime = 0;
        break;
      case 'End':
        event.preventDefault();
        if (isFinite(video.duration)) video.currentTime = video.duration;
        break;
      default:
        if (event.key >= '0' && event.key <= '9') {
          event.preventDefault();
          if (isFinite(video.duration)) video.currentTime = video.duration * parseInt(event.key, 10) / 10;
        }
        break;
    }
  }

}
