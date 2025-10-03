import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { sortBy, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, throwError } from 'rxjs';
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
  standalone: false,
  selector: 'app-settings-backup-page',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss'],
  host: {'class': 'backup'}
})
export class SettingsBackupPage {

  @ViewChild('backupButton')
  backupButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('backupOptions')
  backupOptionsTemplate!: TemplateRef<any>;

  originForm: UntypedFormGroup;
  backupOptionsForm: UntypedFormGroup;

  list?: BackupRef[];
  uploading = false;
  serverError: string[] = [];
  backupOrigins: string[] = this.store.origins.list;
  backupOptionsRef?: OverlayRef;
  isRestoreMode = false;
  pendingRestoreBackup?: BackupRef;

  constructor(
    private mod: ModService,
    public store: Store,
    private backups: BackupService,
    private bookmarks: BookmarkService,
    private origins: OriginService,
    private fb: UntypedFormBuilder,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
  ) {
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
      .subscribe(origins => this.backupOrigins = uniq([...this.store.origins.list, ...origins]));
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
    this.isRestoreMode = false;
    this.pendingRestoreBackup = undefined;
    if (this.backupOptionsRef) return;
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(this.backupButton!)
      .withPositions([{
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
      }]);
    this.backupOptionsRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'hide',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });
    this.backupOptionsRef.attach(new TemplatePortal(this.backupOptionsTemplate, this.viewContainerRef));
    // No backdrop click handler - user must explicitly click OK or Cancel
  }

  showRestoreOptions(event: MouseEvent, backup: BackupRef) {
    this.isRestoreMode = true;
    this.pendingRestoreBackup = backup;
    if (this.backupOptionsRef) return;
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(new ElementRef(event.target as HTMLElement))
      .withPositions([{
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
      }]);
    this.backupOptionsRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'hide',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });
    this.backupOptionsRef.attach(new TemplatePortal(this.backupOptionsTemplate, this.viewContainerRef));
    // No backdrop click handler - user must explicitly click OK or Cancel
  }

  onRestoreRequested(backup: BackupRef) {
    this.isRestoreMode = true;
    this.pendingRestoreBackup = backup;
    if (this.backupOptionsRef) return;
    // Use global positioning since we don't have a specific button reference
    const positionStrategy = this.overlay.position()
      .global()
      .centerHorizontally()
      .centerVertically();
    this.backupOptionsRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'hide',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });
    this.backupOptionsRef.attach(new TemplatePortal(this.backupOptionsTemplate, this.viewContainerRef));
    // No backdrop click handler - user must explicitly click OK or Cancel
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
    if (this.isRestoreMode && this.pendingRestoreBackup) {
      this.restore(this.pendingRestoreBackup, options);
    } else {
      this.backup(options);
    }
  }

  cancelBackup() {
    this.closeBackupOptions();
    this.isRestoreMode = false;
    this.pendingRestoreBackup = undefined;
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

  restore(backup: BackupRef, options: BackupOptions) {
    this.serverError = [];
    this.backups.restore(this.origin, backup.id, options).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.serverError = [];
    });
  }

  onBackupCancelled() {
    // Nothing to do when cancelled
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
    if (confirmation !== (this.origin || 'default')){
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
