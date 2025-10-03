import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { catchError, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BackupOptions } from '../../model/backup';
import { AdminService } from '../../service/admin.service';
import { BackupService } from '../../service/api/backup.service';
import { Store } from '../../store/store';
import { readableBytes } from '../../util/format';
import { printError } from '../../util/http';

@Component({
  standalone: false,
  selector: 'app-backup',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent {

  @Input()
  id!: string;
  @Input()
  size? = 0;
  @Input()
  origin = '';

  @ViewChild('restoreButton')
  restoreButton!: ElementRef<HTMLSpanElement>;
  @ViewChild('restoreOptions')
  restoreOptionsTemplate!: TemplateRef<any>;

  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];
  restoreOptionsForm: UntypedFormGroup;
  restoreOptionsRef?: OverlayRef;

  private backupKey = '';

  constructor(
    public admin: AdminService,
    public backups: BackupService,
    public store: Store,
    private fb: UntypedFormBuilder,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
  ) {
    backups.getDownloadKey()
      .subscribe(key => this.backupKey = key);
    this.restoreOptionsForm = fb.group({
      cache: [false],
      ref: [true],
      ext: [true],
      user: [true],
      plugin: [false],
      template: [false],
      newerThan: [''],
    });
  }

  get inProgress() {
    return this.id.startsWith('_');
  }

  get fileSize() {
    return readableBytes(this.size || 0);
  }

  get downloadLink() {
    var link = this.backups.base + '/' + this.id;
    if (link.startsWith('//')) link = location.protocol + link;
    if (link.startsWith("_")) link = link.substring(1);
    if (!link.endsWith(".zip")) link = link + '.zip';
    if (this.origin) link += '?origin=' + encodeURIComponent(this.origin)
    return link;
  }

  get downloadLinkAuth() {
    return this.downloadLink + (this.origin ? '&' : '?') + 'p=' + encodeURIComponent(this.backupKey);
  }

  showRestoreOptions() {
    if (this.restoreOptionsRef) return;
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(this.restoreButton!)
      .withPositions([{
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
      }]);
    this.restoreOptionsRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'hide',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });
    this.restoreOptionsRef.attach(new TemplatePortal(this.restoreOptionsTemplate, this.viewContainerRef));
    // No backdrop click handler - user must explicitly click OK or Cancel
  }

  confirmRestore() {
    const options: BackupOptions = {
      cache: this.restoreOptionsForm.value.cache,
      ref: this.restoreOptionsForm.value.ref,
      ext: this.restoreOptionsForm.value.ext,
      user: this.restoreOptionsForm.value.user,
      plugin: this.restoreOptionsForm.value.plugin,
      template: this.restoreOptionsForm.value.template,
      newerThan: this.restoreOptionsForm.value.newerThan || undefined,
    };
    this.closeRestoreOptions();
    this.performRestore(options);
  }

  cancelRestore() {
    this.closeRestoreOptions();
  }

  closeRestoreOptions() {
    this.restoreOptionsRef?.detach();
    this.restoreOptionsRef?.dispose();
    this.restoreOptionsRef = undefined;
  }

  performRestore(options: BackupOptions) {
    return this.backups.restore(this.origin, this.id, options).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      tap(() => {
        this.serverError = [];
      }),
    ).subscribe();
  }

  delete$ = () => {
    return this.backups.delete(this.origin, this.id).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      tap(() => {
        this.serverError = [];
        this.deleted = true;
      }),
    );
  }

}
