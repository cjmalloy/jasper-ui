import { Directive, ElementRef, Input, OnChanges } from '@angular/core';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { getExtension } from '../../util/http';

function generateStoryboardKeyframes(name: string, cols: number, rows: number): string {
  // Guard against invalid grid sizes that would cause division by zero
  if (cols <= 0 || rows <= 0) {
    return '';
  }
  const totalFrames = cols * rows;
  const lines: string[] = [`@keyframes ${name} {`];
  for (let i = 0; i < totalFrames; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const pct = ((i / totalFrames) * 100).toFixed(4);
    const x = cols === 1 ? '0%' : `${(col / (cols - 1)) * 100}%`;
    const y = rows === 1 ? '0%' : `${(row / (rows - 1)) * 100}%`;
    lines.push(`  ${pct}% { background-position: ${x} ${y}; animation-timing-function: step-end; }`);
  }
  lines.push('}');
  return lines.join('\n');
}

@Directive({
  selector: '[appStoryboard]',
})
export class StoryboardDirective implements OnChanges {

  @Input('appStoryboard')
  ref?: Ref;
  @Input()
  storyboardRepost?: Ref;
  @Input()
  storyboardEditValue?: any;

  constructor(
    private el: ElementRef<HTMLElement>,
    private admin: AdminService,
    private proxy: ProxyService,
  ) {}

  ngOnChanges() {
    this.apply();
  }

  private get storyboard() {
    if (!this.admin.getPlugin('plugin/thumbnail/storyboard')) return null;
    if (this.storyboardEditValue !== undefined && this.storyboardEditValue !== null) {
      return this.storyboardEditValue.plugins?.['plugin/thumbnail/storyboard'] || null;
    }
    return this.ref?.plugins?.['plugin/thumbnail/storyboard']
      || this.storyboardRepost?.plugins?.['plugin/thumbnail/storyboard']
      || null;
  }

  private apply() {
    const el = this.el.nativeElement;
    const sb = this.storyboard;

    if (sb?.url) {
      const rawUrl = String(sb.url);
      const origin = this.ref?.origin || this.storyboardRepost?.origin || '';
      let resolvedUrl: string;
      if (rawUrl.startsWith('cache:') || this.admin.getPlugin('plugin/thumbnail')?.config?.proxy) {
        const ext = getExtension(rawUrl) || '';
        const title = this.ref?.title || 'storyboard';
        resolvedUrl = this.proxy.getFetch(rawUrl, origin, title + (title.endsWith(ext) ? '' : ext), true);
      } else {
        resolvedUrl = rawUrl;
      }
      const escapedUrl = resolvedUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      el.style.setProperty('--storyboard-url', `url("${escapedUrl}")`);
    } else {
      el.style.removeProperty('--storyboard-url');
    }

    if (sb?.cols && sb?.rows) {
      el.style.setProperty('--storyboard-size', `${sb.cols * 100}% ${sb.rows * 100}%`);
      el.style.setProperty('--storyboard-margin', ((48 - (48 * sb.height / sb.width)) / 2) + 'px');
      el.style.setProperty('--storyboard-height', (48 * sb.height / sb.width) + 'px');

      const totalFrames = sb.cols * sb.rows;
      if (totalFrames >= 2) {
        const frameDurationS = 1;
        const totalDurationS = totalFrames * frameDurationS;
        const name = `storyboard-slide-${sb.cols}x${sb.rows}`;
        const styleId = `style-${name}`;
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = generateStoryboardKeyframes(name, sb.cols, sb.rows);
          document.head.appendChild(style);
        }
        el.style.setProperty('--storyboard-animation', `${name} ${totalDurationS.toFixed(2)}s linear infinite`);
      } else {
        el.style.removeProperty('--storyboard-animation');
      }
    } else {
      el.style.removeProperty('--storyboard-size');
      el.style.removeProperty('--storyboard-margin');
      el.style.removeProperty('--storyboard-height');
      el.style.removeProperty('--storyboard-animation');
    }

    const thumbPlugins = this.storyboardEditValue !== null && this.storyboardEditValue !== undefined
      ? this.storyboardEditValue.plugins
      : (this.ref?.plugins || this.storyboardRepost?.plugins);
    const thumbData = thumbPlugins?.['plugin/thumbnail'];
    const hasThumbData = !!(thumbData?.url || thumbData?.emoji || thumbData?.color);
    el.classList.toggle('has-storyboard-default', !!sb && !hasThumbData);
  }
}
