import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { sortBy, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, throwError } from 'rxjs';
import { BackupListComponent } from '../../../component/backup/backup-list/backup-list.component';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { BackupOptions } from '../../../model/backup';
import { BackupRef, BackupService } from '../../../service/api/backup.service';
import { OriginService } from '../../../service/api/origin.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { ORIGIN_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings-backup-page',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss'],
  host: { 'class': 'backup' },
  imports: [ReactiveFormsModule, LoadingComponent, BackupListComponent]
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
  private cd = inject(ChangeDetectorRef);


  readonly backupButton = viewChild.required<ElementRef<HTMLButtonElement>>('backupButton');
  readonly backupOptionsTemplate = viewChild.required<TemplateRef<any>>('backupOptions');

  originForm: UntypedFormGroup;
  backupOptionsForm: UntypedFormGroup;

  list?: BackupRef[];
  uploading = false;
  serverError: string[] = [];
  backupOrigins: string[] = this.store.origins.list;
  backupOptionsRef?: OverlayRef;

  constructor() {
    const mod = this.mod;
    const fb = this.fb;

    mod.setTitle($localize`Settings: Backup & Restore`);
    this.fetchBackups();
    this.originForm = fb.group({
      origin: [this.origin, [Validators.pattern(ORIGIN_REGEX)]],
      olderThan: [DateTime.now().toISO()],
    });
    this.backupOptionsForm = fb.group({
      cache: [false],
      ref: [true],
      ext: [true],
      user: [true],
      plugin: [false],
      template: [false],
      newerThan: [''],
    });
    this.origins.list()
      .subscribe(origins => {
        this.backupOrigins = uniq([...this.store.origins.list, ...origins]);
        this.cd.markForCheck();
      });
  }

  get origin() {
    return this.store.view.origin || this.store.account.origin;
  }

  selectOrigin(origin: string) {
    if (origin === this.origin) return;
    this.fetchBackups(origin);
    this.bookmarks.origin = origin;
  }

  fetchBackups(origin?: string) {
    delete this.list;
    this.backups.list(origin === undefined ? this.origin : origin)
      .subscribe(list => this.list = sortBy(list, 'id').reverse());
  }

  showBackupOptions() {
    if (this.backupOptionsRef) return;
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(this.backupButton()!)
      .withPositions([{
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
        offsetY: 4,
      }]);
    this.backupOptionsRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'hide',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });
    this.backupOptionsRef.attach(new TemplatePortal(this.backupOptionsTemplate(), this.viewContainerRef));
    this.backupOptionsRef.backdropClick().subscribe(() => this.cancelBackup());
  }

  confirmBackup() {
    const options: BackupOptions = {
      cache: this.backupOptionsForm.value.cache,
      ref: this.backupOptionsForm.value.ref,
      ext: this.backupOptionsForm.value.ext,
      user: this.backupOptionsForm.value.user,
      plugin: this.backupOptionsForm.value.plugin,
      template: this.backupOptionsForm.value.template,
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
    this.serverError = [];
    this.backups.create(this.origin, options).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(id => {
      this.list ||= [];
      this.list.unshift({ id: '_' + id });
    });
  }

  upload(files?: FileList) {
    this.serverError = [];
    if (!files || !files.length) return;
    this.uploading = true;
    const file = files[0]!;
    this.backups.upload(this.origin, file).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        this.uploading = false;
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.uploading = false;
      this.list ||= [];
      this.list.unshift({ id: files[0].name });
    });
  }

  regen() {
    this.serverError = [];
    if (!confirm($localize`Are you sure you want totally regenerate metadata${this.origin ? ' in ' + this.origin : ''}?`)) return;
    this.backups.regen(this.origin).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe();
  }

  deleteOrigin() {
    this.serverError = [];
    this.originForm.markAllAsTouched();
    if (!this.originForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const confirmation = prompt($localize`Are you sure you want totally delete everything in ${this.origin || 'default'}?\n\nEnter the origin to confirm:`);
    if (confirmation === null) return;
    if (confirmation !== (this.origin || 'default')) {
      alert($localize`Origin did not match ${this.origin || 'default'}, aborting.`)
      return;
    }
    const olderThan = DateTime.fromISO(this.originForm.value.olderThan);
    this.origins.delete(this.origin, olderThan).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe();
  }
}
