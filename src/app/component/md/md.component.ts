import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import { AdminService } from '../../service/admin.service';
import { EmbedService } from '../../service/embed.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-md',
  templateUrl: './md.component.html',
  styleUrls: ['./md.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MdComponent implements DoCheck, OnDestroy {

  @Input()
  origin? = '';
  @Input()
  plugins?: string[];
  @Input()
  disableSanitizer = false;
  @Output()
  postProcessMarkdown: Subject<void> = new Subject();
  @Input()
  mermaid = true;
  @Input()
  clipboard = true;

  @ViewChild('md', { static: true })
  md!: ElementRef<HTMLDivElement>;
  @ViewChild('md', { static: true, read: ViewContainerRef })
  vc!: ViewContainerRef;

  private _text = '';
  private _value? = '';
  private lastRender?: string;
  private cleanup?: () => void;

  constructor(
    public admin: AdminService,
    public store: Store,
    public el: ElementRef,
    private embeds: EmbedService,
  ) { }

  get text(): string {
    return this._text;
  }

  @Input()
  set text(value: string | undefined) {
    this._text = value || '';
    delete this._value;
  }

  get value() {
    if (this.plugins?.includes('plugin/table')) {
      if (this._value) return this._value;
      try {
        const wb = XLSX.read(this._text, {type: 'string'});
        return this._value = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]], {header: ''});
      } catch (e: any) {
        return `<p class="error">${e.message}</p>`
      }
    }
    return this._value = this._text;
  }

  get katex() {
    return !!this.plugins?.includes('plugin/latex');
  }

  ngDoCheck() {
    const key = JSON.stringify([this._text, this.plugins || [], this.origin || '', this.mermaid, this.clipboard, this.disableSanitizer]);
    if (key === this.lastRender) return;
    this.lastRender = key;
    this.render();
  }

  ngOnDestroy() {
    this.destroy();
  }

  private destroy() {
    this.cleanup?.();
    delete this.cleanup;
    this.vc.clear();
  }

  private render() {
    this.destroy();
    this.cleanup = this.embeds.render(this.md.nativeElement, this.value, {
      vc: this.vc,
      origin: this.origin || '',
      mermaid: this.mermaid,
      clipboard: this.clipboard,
    }, this.katex, this.disableSanitizer);
    this.postProcessMarkdown.next();
  }
}
