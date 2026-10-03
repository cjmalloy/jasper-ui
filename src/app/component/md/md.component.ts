import { Component, computed, ElementRef, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MermaidConfig } from 'mermaid';
import { MarkdownComponent, MermaidAPI } from 'ngx-markdown';
import { Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import { MdPostDirective } from '../../directive/md-post.directive';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-md',
  templateUrl: './md.component.html',
  styleUrls: ['./md.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MarkdownComponent,
    MdPostDirective,
  ]
})
export class MdComponent {

  readonly origin = input<string | undefined>('');
  readonly plugins = input<string[] | undefined>();
  readonly disableSanitizer = input(false);
  readonly postProcessMarkdown = output<void>();
  readonly postProcessMarkdownSubject = new Subject<void>();
  readonly mermaid = input(true);
  readonly clipboard = input(true);

  katexOptions = {
    throwOnError: false,
    delimiters: [
      {left: "$$", right: "$$", display: true},
      {left: "$", right: "$", display: false},
    ],
  };
  mermaidOptions: MermaidConfig & MermaidAPI.MermaidConfig = {
    theme: this.store.darkTheme() ? 'dark' : 'default',
  };

  readonly text = input<string | undefined>('');

  constructor(
    public admin: AdminService,
    public store: Store,
    public el: ElementRef,
  ) { }

  readonly value = computed(() => {
    const text = this.text() || '';
    if (this.plugins()?.includes('plugin/table')) {
      try {
        const wb = XLSX.read(text, {type: 'string'});
        return XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]], {header: ''});
      } catch (e: any) {
        return `<p class="error">${e.message}</p>`
      }
    }
    return text;
  });

}
