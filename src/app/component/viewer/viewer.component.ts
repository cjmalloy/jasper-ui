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
import { EmbedService } from '../../service/embed.service';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent implements AfterViewInit {
  @HostBinding('class') css = 'embed';

  @Input()
  text? = '';
  @Input()
  tags?: string[];

  @ViewChild('iframe')
  iframe!: ElementRef;

  uis = this.admin.getPluginUi(this.currentTags);

  private _ref?: Ref;

  constructor(
    public admin: AdminService,
    private embeds: EmbedService,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

  ngAfterViewInit(): void {
    if (this.iframe) {
      this.embeds.writeIframe(this.embed, this.iframe.nativeElement);
    }
  }

  get ref() {
    return this._ref;
  }

  @Input()
  set ref(value: Ref | undefined) {
    this._ref = value;
    this.uis = this.admin.getPluginUi(this.currentTags);
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

  cssWidth(width: any) {
    if (!width) return 0;
    return width + 'px';
  }
}
