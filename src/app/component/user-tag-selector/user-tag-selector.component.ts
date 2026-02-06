import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { debounce, uniqBy } from 'lodash-es';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-user-tag-selector',
  templateUrl: './user-tag-selector.component.html',
  styleUrls: ['./user-tag-selector.component.scss'],
  imports: [ReactiveFormsModule]
})
export class UserTagSelectorComponent implements OnDestroy {
  private configs = inject(ConfigService);
  private admin = inject(AdminService);
  private editor = inject(EditorService);
  private exts = inject(ExtService);
  store = inject(Store);
  private cd = inject(ChangeDetectorRef);


  preview = '';
  editing = false;
  autocomplete: { value: string, label: string }[] = [];

  private previewing?: Subscription;
  private searching?: Subscription;

  constructor() {
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
      this.cd.detectChanges();
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
      window.open(this.configs.base + 'tag/' + input.value);
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
      this.cd.detectChanges();
    });
  }, 400);
}
