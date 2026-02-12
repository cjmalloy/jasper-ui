import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  inject,
  Input,
  input,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-backup',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss'],
  imports: [RouterLink, ConfirmActionComponent, ReactiveFormsModule]
})
export class BackupComponent {
  admin = inject(AdminService);
  backups = inject(BackupService);
  store = inject(Store);
  private fb = inject(UntypedFormBuilder);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);


  @Input()
  id!: string;
  readonly size = input<number | undefined>(0);
  readonly origin = input('');

  readonly restoreButton = viewChild('restoreButton', { read: ElementRef });
  readonly restoreOptionsTemplate = viewChild.required<TemplateRef<any>>('restoreOptions');

  @HostBinding('class.deleted')
  deleted = false;
  serverError: string[] = [];
  restoreOptionsForm: UntypedFormGroup;
  restoreOptionsRef?: OverlayRef;

  private backupKey = '';

  constructor() {
    const backups = this.backups;
    const fb = this.fb;

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
    return readableBytes(this.size() || 0);
  }

  get downloadLink() {
    var link = this.backups.base + '/' + this.id;
    if (link.startsWith('//')) link = location.protocol + link;
    if (link.startsWith("_")) link = link.substring(1);
    if (!link.endsWith(".zip")) link = link + '.zip';
    const origin = this.origin();
    if (origin) link += '?origin=' + encodeURIComponent(origin)
    return link;
  }

  get downloadLinkAuth() {
    return this.downloadLink + (this.origin() ? '&' : '?') + 'p=' + encodeURIComponent(this.backupKey);
  }

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
      newerThan: this.restoreOptionsForm.value.newerThan || undefined,
    };
    this.closeRestoreOptions();
    this.backups.restore(this.origin(), this.id, options).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      tap(() => {
        this.serverError = [];
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
    return this.backups.delete(this.origin(), this.id).pipe(
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
