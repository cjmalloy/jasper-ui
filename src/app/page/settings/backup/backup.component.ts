import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef
} from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { sortBy, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, filter, of, throwError } from 'rxjs';
import { BackupListComponent } from '../../../component/backup/backup-list/backup-list.component';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { AutofocusDirective } from '../../../directive/autofocus.directive';
import { BackupOptions } from '../../../model/backup';
import { BackupRef, BackupService } from '../../../service/api/backup.service';
import { OriginService } from '../../../service/api/origin.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { controlState, scrollToFirstInvalid } from '../../../util/form';
import { ORIGIN_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-settings-backup-page',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss'],
  host: { 'class': 'backup' },
  imports: [ReactiveFormsModule, LoadingComponent, BackupListComponent, AutofocusDirective]
})
export class SettingsBackupPage {
  private mod = inject(ModService);
  store = inject(Store);
  private backups = inject(BackupService);
  private bookmarks = inject(BookmarkService);
  private origins = inject(OriginService);
  private fb = inject(UntypedFormBuilder);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);


  readonly backupButton = viewChild.required<ElementRef<HTMLButtonElement>>('backupButton');
  readonly backupOptionsTemplate = viewChild.required<TemplateRef<any>>('backupOptions');
  readonly deleteButton = viewChild.required<ElementRef<HTMLButtonElement>>('deleteButton');
  readonly deleteConfirmTemplate = viewChild.required<TemplateRef<any>>('deleteConfirm');

  originForm: UntypedFormGroup;
  protected readonly originFormValid = controlState(() => this.originForm, c => c.valid);
  backupOptionsForm: UntypedFormGroup;

  readonly list = signal<BackupRef[] | undefined>(undefined);
  readonly uploading = signal(false);
  readonly serverError = signal<string[]>([]);
  readonly backupOrigins = signal<string[]>(this.store.origins.list());
  backupOptionsRef?: OverlayRef;
  deleteConfirmRef?: OverlayRef;
  readonly deleteConfirmation = signal('');

  constructor() {
    const mod = this.mod;
    const fb = this.fb;

    mod.setTitle($localize`Settings: Backup & Restore`);
    this.fetchBackups();
    this.originForm = fb.group({
      origin: [this.origin(), [Validators.pattern(ORIGIN_REGEX)]],
      olderThan: [DateTime.now().toISO()],
    });
    this.backupOptionsForm = fb.group({
      cache: [false],
      ref: [true],
      ext: [true],
      user: [true],
      plugin: [false],
      template: [false],
      tombstones: [false],
      newerThan: [''],
    });
    this.origins.list()
      .subscribe(origins => {
        this.backupOrigins.set(uniq([...this.store.origins.list(), ...origins]));
      });
  }

  readonly origin = computed(() => {
    return this.store.view.origin() || this.store.account.origin();
  });

  selectOrigin(origin: string) {
    if (origin === this.origin()) return;
    this.fetchBackups(origin);
    this.bookmarks.setOrigin(origin);
  }

  fetchBackups(origin?: string) {
    this.list.set(undefined);
    this.backups.list(origin === undefined ? this.origin() : origin).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return of([]);
      }),
    ).subscribe(list => this.list.set(sortBy(list, 'id').reverse()));
  }

  readonly originLabel = computed(() => {
    return this.origin() || 'default';
  });

  showBackupOptions() {
    if (this.backupOptionsRef) return;
    this.backupOptionsRef = this.createPopup(this.backupButton(), this.backupOptionsTemplate());
    this.backupOptionsRef.backdropClick().subscribe(() => this.cancelBackup());
    this.backupOptionsRef.keydownEvents().pipe(filter(e => e.key === 'Escape')).subscribe(() => this.cancelBackup());
  }

  private createPopup(anchor: ElementRef<HTMLElement>, template: TemplateRef<any>) {
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(anchor)
      .withPositions([{
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
        offsetY: 4,
      }]);
    const ref = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'hide',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });
    ref.attach(new TemplatePortal(template, this.viewContainerRef));
    return ref;
  }

  confirmBackup() {
    const options: BackupOptions = {
      cache: this.backupOptionsForm.value.cache,
      ref: this.backupOptionsForm.value.ref,
      ext: this.backupOptionsForm.value.ext,
      user: this.backupOptionsForm.value.user,
      plugin: this.backupOptionsForm.value.plugin,
      template: this.backupOptionsForm.value.template,
      tombstones: this.backupOptionsForm.value.tombstones,
      newerThan: this.backupOptionsForm.value.newerThan || undefined,
    };
    this.closeBackupOptions();
    this.backup(options);
  }

  cancelBackup() {
    this.closeBackupOptions();
  }

  closeBackupOptions() {
    this.backupOptionsRef?.detach();
    this.backupOptionsRef?.dispose();
    this.backupOptionsRef = undefined;
  }

  backup(options: BackupOptions) {
    this.serverError.set([]);
    this.backups.create(this.origin(), options).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(id => {
      this.list.set([{ id: '_' + id }, ...(this.list() || [])]);
    });
  }

  upload(files?: FileList) {
    this.serverError.set([]);
    if (!files || !files.length) return;
    this.uploading.set(true);
    const file = files[0]!;
    this.backups.upload(this.origin(), file).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        this.uploading.set(false);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.uploading.set(false);
      this.list.set([{ id: files[0].name }, ...(this.list() || [])]);
    });
  }

  regen() {
    this.serverError.set([]);
    if (!confirm($localize`Are you sure you want totally regenerate metadata${this.origin() ? ' in ' + this.origin() : ''}?`)) return;
    this.backups.regen(this.origin()).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe();
  }

  deleteOrigin() {
    this.serverError.set([]);
    this.originForm.markAllAsTouched();
    if (!this.originForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    if (this.deleteConfirmRef) return;
    this.deleteConfirmation.set('');
    this.deleteConfirmRef = this.createPopup(this.deleteButton(), this.deleteConfirmTemplate());
    this.deleteConfirmRef.backdropClick().subscribe(() => this.closeDeleteConfirm());
  }

  closeDeleteConfirm() {
    this.deleteConfirmRef?.detach();
    this.deleteConfirmRef?.dispose();
    this.deleteConfirmRef = undefined;
    this.deleteConfirmation.set('');
  }

  confirmDeleteOrigin() {
    if (this.deleteConfirmation() !== this.originLabel()) return;
    this.closeDeleteConfirm();
    const olderThan = DateTime.fromISO(this.originForm.value.olderThan);
    this.origins.delete(this.origin(), olderThan).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe();
  }
}
