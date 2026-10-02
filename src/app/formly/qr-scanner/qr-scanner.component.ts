import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  Component,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { loadImage } from '../../util/image';
import { QrScanner, scanImage } from '../../util/qr-scanner';
import { Camera, hasCamera, listCameras } from '../../util/webcam';

@Component({
  selector: 'app-qr-scanner',
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'form-array' }
})
export class QrScannerComponent implements OnDestroy {

  readonly video = viewChild.required<TemplateRef<HTMLVideoElement>>('video');

  readonly upload = input(true);
  readonly data = output<string>();

  private readonly _scanner = signal<QrScanner | undefined>(undefined);
  overlayRef?: OverlayRef;
  private readonly _hasFlash = signal(false);
  private readonly _hasCamera = signal<boolean | undefined>(undefined);
  private readonly _cameras = signal<Camera[] | undefined>(undefined);
  private readonly _checkedCamera = signal(false);

  constructor(
    private viewContainerRef: ViewContainerRef,
    private overlay: Overlay,
  ) { }

  get scanner(): QrScanner | undefined { return this._scanner(); }
  set scanner(value: QrScanner | undefined) { this._scanner.set(value); }

  get hasFlash(): boolean { return this._hasFlash(); }
  set hasFlash(value: boolean) { this._hasFlash.set(value); }

  get cameras(): Camera[] | undefined { return this._cameras(); }
  set cameras(value: Camera[] | undefined) { this._cameras.set(value); }

  get checkedCamera(): boolean { return this._checkedCamera(); }
  set checkedCamera(value: boolean) { this._checkedCamera.set(value); }

  ngOnDestroy() {
    this.stopScanQr();
  }

  readQr(files?: FileList) {
    if (!files || !files.length) return;
    const file = files[0]!;
    loadImage(file)
      .then(image => scanImage(image))
      .then(qr => qr?.data && this.data.emit(qr.data));
  }

  scanQr() {
    if (this.scanner) {
      this.stopScanQr();
      return;
    }
    document.documentElement.style.overflowY = 'auto';
    this.overlayRef = this.overlay.create({
      height: '100vh',
      width: '100vw',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
    });
    this.overlayRef.attach(new TemplatePortal(this.video(), this.viewContainerRef));
    this.scanner ||= new QrScanner(this.overlayRef.overlayElement.firstElementChild as HTMLVideoElement, data => {
      if (data) this.data.emit(data);
      this.stopScanQr();
    }, this.camera);

    this.scanner?.start()
      .then(() => listCameras().then(value => this.cameras = value))
      .then(() => this.scanner?.hasFlash())
      .then(value => this.hasFlash = !!value);
  }

  stopScanQr() {
    document.documentElement.style.overflowY = 'scroll';
    if (!this.scanner) return;
    this.scanner.stop();
    this.scanner.destroy();
    this.scanner = undefined;
    this.overlayRef?.detach();
    this.overlayRef?.dispose();
  }

  get hasMultipleCameras() {
    return (this.cameras?.length || 0) > 1;
  }

  get hasCamera() {
    const detected = this._hasCamera();
    if (detected !== undefined) return detected;
    if (localStorage.getItem('hasCamera') === 'true') return true;
    if (!this.checkedCamera) hasCamera().then(value => this.hasCamera = value);
    this.checkedCamera = true;
    return false;
  }

  set hasCamera(value: boolean) {
    this._hasCamera.set(value);
    localStorage.setItem('hasCamera', ''+value);
  }

  get camera() {
    return localStorage.getItem('cameraId')!;
  }

  set camera(id: string | undefined) {
    localStorage.setItem('cameraId', id!);
    if (id) {
      this.scanner?.setCamera(id)
        .then(() => this.scanner?.hasFlash())
        .then(value => this.hasFlash = !!value);
    }
  }

  nextCamera() {
    listCameras()
      .then(cameras => {
        if (!cameras.length) return;
        const cameraId = this.camera;
        for (let i = 0; i < cameras.length; i++) {
          if (!cameraId) return this.camera = cameras[i].id;
          if (cameraId === cameras[i].id) return this.camera = cameras[(i + 1) % cameras.length].id;
        }
        return this.camera = cameras[0].id;
      });
  }
}
