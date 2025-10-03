import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { catchError, Observable, throwError } from 'rxjs';
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

  showRestoreOptions(targetElement: HTMLElement) {
    if (this.restoreOptionsRef) return;
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(targetElement)
      .withPositions([{
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
        offsetY: 4,
      }]);
    this.restoreOptionsRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'hide',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });
    this.restoreOptionsRef.attach(new TemplatePortal(this.restoreOptionsTemplate, this.viewContainerRef));
    this.restoreOptionsRef.backdropClick().subscribe(() => this.cancelRestore());
  }

  restore$ = () => {
    // Show options popup - need to get the element reference
    // Since this is called from confirm-action, we need to find the restore button
    const restoreElement = document.querySelector('.backup .action .fake-link');
    if (restoreElement) {
      this.showRestoreOptions(restoreElement as HTMLElement);
    }
    // Return an observable that will be resolved when user clicks OK
    return new Observable(observer => {
      // Store the observer so we can complete it later
      this.restoreObserver = observer;
    });
  }

  private restoreObserver: any = null;

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
    this.backups.restore(this.origin, this.id, options).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        if (this.restoreObserver) {
          this.restoreObserver.error(err);
          this.restoreObserver = null;
        }
        return throwError(() => err);
      }),
      tap(() => {
        this.serverError = [];
        if (this.restoreObserver) {
          this.restoreObserver.next();
          this.restoreObserver.complete();
          this.restoreObserver = null;
        }
      }),
    ).subscribe();
  }

  cancelRestore() {
    this.closeRestoreOptions();
    if (this.restoreObserver) {
      this.restoreObserver.error(new Error('cancelled'));
      this.restoreObserver = null;
    }
  }

  closeRestoreOptions() {
    this.restoreOptionsRef?.detach();
    this.restoreOptionsRef?.dispose();
    this.restoreOptionsRef = undefined;
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
