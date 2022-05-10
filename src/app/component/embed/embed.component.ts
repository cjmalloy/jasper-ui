import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { EmbedService } from '../../service/embed.service';

@Component({
  selector: 'app-embed',
  templateUrl: './embed.component.html',
  styleUrls: ['./embed.component.scss']
})
export class EmbedComponent implements AfterViewInit {

  @Input()
  ref!: Ref;
  @Input()
  expandPlugins: string[] = [];

  @ViewChild('iframe')
  iframe!: ElementRef;

  constructor(
    public admin: AdminService,
    private embeds: EmbedService,
  ) { }

  ngAfterViewInit(): void {
    this.embeds.writeIframe(this.embed, this.iframe.nativeElement);
  }

  get emoji() {
    return !!this.admin.status.plugins.emoji && !!this.ref.tags?.includes('plugin/emoji');
  }

  get latex() {
    return !!this.admin.status.plugins.latex && !!this.ref.tags?.includes('plugin/latex');
  }

  get embed() {
    return this.ref.plugins?.['plugin/embed']?.url || this.ref.url;
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }

}
