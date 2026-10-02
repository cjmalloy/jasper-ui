import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, ElementRef, linkedSignal, signal, TemplateRef, ViewContainerRef, input, viewChild } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, Observable, of, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BackupOptions } from '../../model/backup';
import { AdminService } from '../../service/admin.service';
import { BackupService } from '../../service/api/backup.service';
import { Store } from '../../store/store';
import { readableBytes } from '../../util/format';
import { printError } from '../../util/http';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';

@Component({
  selector: 'app-backup',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss'],
  host: {
    '[class.deleted]': 'deleted()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ConfirmActionComponent, ReactiveFormsModule]
})
export class BackupComponent {

  readonly id = input.required<string>();
  readonly size = input<number | undefined>(0);
  readonly origin = input('');

  readonly restoreButton = viewChild('restoreButton', { read: ElementRef });
  readonly restoreOptionsTemplate = viewChild.required<TemplateRef<any>>('restoreOptions');

  readonly deleted = linkedSignal(() => {
    this.id();
    this.origin();
    return false;
  });
  readonly serverError = signal<string[]>([]);
  private readonly backupKey = signal('');
  restoreOptionsForm: UntypedFormGroup;
  restoreOptionsRef?: OverlayRef;

  constructor(
    public admin: AdminService,
    public backups: BackupService,
    public store: Store,
    private fb: UntypedFormBuilder,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
  ) {
    backups.getDownloadKey()
      .subscribe(key => this.backupKey.set(key));
    this.restoreOptionsForm = fb.group({
      cache: [false],
      ref: [true],
      ext: [true],
      user: [true],
      plugin: [false],
      template: [false],
      tombstones: [false],
      newerThan: [''],
    });
  }

  readonly inProgress = computed(() => this.id().startsWith('_'));

  readonly fileSize = computed(() => readableBytes(this.size() || 0));

  readonly downloadLink = computed(() => {
    var link = this.backups.base + '/' + this.id();
    if (link.startsWith('//')) link = location.protocol + link;
    if (link.startsWith("_")) link = link.substring(1);
    if (!link.endsWith(".zip")) link = link + '.zip';
    const origin = this.origin();
    if (origin) link += '?origin=' + encodeURIComponent(origin)
    return link;
  });

  readonly downloadLinkAuth = computed(() =>
    this.downloadLink() + (this.origin() ? '&' : '?') + 'p=' + encodeURIComponent(this.backupKey()));

  showRestoreOptions() {
    const restoreButton = this.restoreButton();
    if (this.restoreOptionsRef || !restoreButton) return;
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(restoreButton)
      .withPositions([{
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
        offsetY: 4,
      }]);
    this.restoreOptionsRef = this.overlay.create({
      hasBackdrop: false,
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });
    this.restoreOptionsRef.attach(new TemplatePortal(this.restoreOptionsTemplate(), this.viewContainerRef));
  }

  restore$ = () => {
    return of(null).pipe(
      tap(() => this.showRestoreOptions()),
    );
  }

  confirmRestore() {
    const options: BackupOptions = {
      cache: this.restoreOptionsForm.value.cache,
      ref: this.restoreOptionsForm.value.ref,
      ext: this.restoreOptionsForm.value.ext,
      user: this.restoreOptionsForm.value.user,
      plugin: this.restoreOptionsForm.value.plugin,
      template: this.restoreOptionsForm.value.template,
      tombstones: this.restoreOptionsForm.value.tombstones,
      newerThan: this.restoreOptionsForm.value.newerThan || undefined,
    };
    this.closeRestoreOptions();
    this.backups.restore(this.origin(), this.id(), options).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
      tap(() => {
        this.serverError.set([]);
      }),
    ).subscribe();
  }

  cancelRestore() {
    this.closeRestoreOptions();
  }

  closeRestoreOptions() {
    this.restoreOptionsRef?.detach();
    this.restoreOptionsRef?.dispose();
    this.restoreOptionsRef = undefined;
  }

  delete$ = () => {
    return this.backups.delete(this.origin(), this.id()).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
      tap(() => {
        this.serverError.set([]);
        this.deleted.set(true);
      }),
    );
  }

}
