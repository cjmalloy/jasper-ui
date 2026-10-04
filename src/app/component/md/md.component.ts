import { Component, computed, ElementRef, input, output, inject } from '@angular/core';
import { MermaidConfig } from 'mermaid';
import { MarkdownComponent, MermaidAPI } from 'ngx-markdown';
import * as XLSX from 'xlsx';
import { MdPostDirective } from '../../directive/md-post.directive';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-md',
  templateUrl: './md.component.html',
  styleUrls: ['./md.component.scss'],
  imports: [
    MarkdownComponent,
    MdPostDirective,
  ]
})
export class MdComponent {
  admin = inject(AdminService);
  store = inject(Store);
  el = inject(ElementRef);


  readonly origin = input<string | undefined>('');
  readonly plugins = input<string[] | undefined>();
  readonly disableSanitizer = input(false);
  readonly postProcessMarkdown = output<void>();
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
