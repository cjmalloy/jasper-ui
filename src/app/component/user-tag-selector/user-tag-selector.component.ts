import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { debounce, uniqBy } from 'lodash-es';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-user-tag-selector',
  templateUrl: './user-tag-selector.component.html',
  styleUrls: ['./user-tag-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule]
})
export class UserTagSelectorComponent implements OnDestroy {

  private readonly _preview = signal('');
  private readonly _editing = signal(false);
  private readonly _autocomplete = signal<{ value: string, label: string }[]>([]);

  get preview() { return this._preview(); }
  set preview(value: string) { this._preview.set(value); }
  get editing() { return this._editing(); }
  set editing(value: boolean) { this._editing.set(value); }
  get autocomplete() { return this._autocomplete(); }
  set autocomplete(value: { value: string, label: string }[]) { this._autocomplete.set(value); }

  private previewing?: Subscription;
  private searching?: Subscription;

  constructor(
    private configs: ConfigService,
    private admin: AdminService,
    private editor: EditorService,
    private exts: ExtService,
    public store: Store,
  ) {
    this.getPreview(this.store.local.selectedUserTag);
  }

  ngOnDestroy() {
    this.previewing?.unsubscribe();
    this.searching?.unsubscribe();
  }

  blur(input: HTMLInputElement) {
    this.editing = false;
    this.getPreview(input.value);
    if (this.store.local.selectedUserTag !== input.value) {
      this.store.local.selectedUserTag = input.value;
      location.reload();
    }
  }

  getPreview(value: string) {
    if (!value) return;
    this.previewing?.unsubscribe();
    this.previewing = this.preview$(value).subscribe((x?: { name?: string, tag: string }) => {
      this.preview = x?.name || x?.tag || '';
    });
  }

  preview$(value: string): Observable<{ name?: string, tag: string } | undefined> {
    return this.editor.getTagPreview(value, this.store.account.origin, false, true, false);
  }

  edit(input: HTMLInputElement) {
    this.editing = true;
    this.preview = '';
    input.focus();
  }

  clickPreview(input: HTMLInputElement) {
    if (this.store.hotkey) {
      this.configs.tag(input.value);
    } else {
      this.edit(input);
    }
  }

  search = debounce((value: string) => {
    this.searching?.unsubscribe();
    this.searching = this.exts.page({
      query: '(+user|_user):' + (this.store.account.origin || '*'),
      search: value,
      sort: ['origin:len', 'tag:len'],
      size: 5,
    }).pipe(
      switchMap(page => page.page.totalElements ? forkJoin(page.content.map(x => this.preview$(x.tag + x.origin))) : of([])),
      map(xs => xs.filter(x => !!x) as { name?: string, tag: string }[]),
    ).subscribe(xs => {
      this.autocomplete = xs.map(x => ({ value: x.tag, label: x.name || x.tag }));
      this.autocomplete = uniqBy(this.autocomplete, 'value');
    });
  }, 400);
}
