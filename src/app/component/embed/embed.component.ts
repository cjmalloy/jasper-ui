import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  Inject,
  Input,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import * as _ from 'lodash';
import { Subject } from 'rxjs';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EmbedService } from '../../service/embed.service';

@Component({
  selector: 'app-embed',
  templateUrl: './embed.component.html',
  styleUrls: ['./embed.component.scss']
})
export class EmbedComponent implements AfterViewInit {
  @HostBinding('class') css = 'embed';

  @Input()
  ref!: Ref;
  @Input()
  comment?: string;
  @Input()
  expandPlugins: string[] = [];

  @ViewChild('iframe')
  iframe!: ElementRef;

  postProcessMarkdown: Subject<void> = new Subject();

  constructor(
    public admin: AdminService,
    private embeds: EmbedService,
    private refs: RefService,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

  ngAfterViewInit(): void {
    if (this.iframe) {
      this.embeds.writeIframe(this.embed, this.iframe.nativeElement);
    }
  }

  get emoji() {
    return !!this.admin.status.plugins.emoji && !!this.ref?.tags?.includes('plugin/emoji');
  }

  get latex() {
    return !!this.admin.status.plugins.latex && !!this.ref?.tags?.includes('plugin/latex');
  }

  get embed() {
    return this.ref.plugins?.['plugin/embed']?.url || this.ref?.url;
  }

  get qrWidth() {
    return Math.min(256, window.innerWidth);
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }

  onReady = _.debounce(() => {
    this.postProcessMarkdown.next();
  }, 3000);
}
