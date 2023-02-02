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
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EmbedService } from '../../service/embed.service';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent implements AfterViewInit {
  @HostBinding('class') css = 'embed';

  @Input()
  ref?: Ref;
  @Input()
  text? = '';
  @Input()
  tags?: string[];

  @ViewChild('iframe')
  iframe!: ElementRef;

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

  get currentText() {
    return this.text || this.ref?.comment || '';
  }

  get currentTags() {
    return this.tags || this.ref?.tags || [];
  }

  get embed() {
    return this.ref?.plugins?.['plugin/embed']?.url || this.ref?.url;
  }

  get uis() {
    return this.admin.getPluginUi(this.tags || []);
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }
}
