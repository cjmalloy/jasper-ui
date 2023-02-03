import jsQR, { QRCode } from 'jsqr';
import { FacingMode, getCameraStream, stopVideoStream } from './webcam';

export interface ScanRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function scanImage(image: HTMLImageElement): QRCode | null {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const g = canvas.getContext('2d', { alpha: false })!;
  g.imageSmoothingEnabled = false; // gives less blurry images
  g.drawImage(image, 0, 0);
  const imageData = g.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(imageData.data, canvas.width, canvas.height);
}

function scanCanvas(canvas: HTMLCanvasElement) {
  const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, canvas.width, canvas.height);
  return result?.data;
}

function videoToCanvas(video: HTMLVideoElement, scanRegion: ScanRegion, canvas: HTMLCanvasElement) {
  const canvasWidth = scanRegion.width;
  const canvasHeight = scanRegion.height;
  if (canvas.width !== canvasWidth) {
    canvas.width = canvasWidth;
  }
  if (canvas.height !== canvasHeight) {
    canvas.height = canvasHeight;
  }
  const g = canvas.getContext('2d', { alpha: false })!;
  g.imageSmoothingEnabled = false; // gives less blurry images
  g.drawImage(
    video,
    scanRegion.x, scanRegion.y, canvasWidth, canvasWidth,
    0, 0, canvasWidth, canvasWidth,
  );
}

export class QrScanner {

  readonly $video: HTMLVideoElement;
  readonly $canvas: HTMLCanvasElement;
  readonly $overlay?: HTMLDivElement;
  private readonly _onDecode: (result: string) => void;
  private _preferredCamera?: string;
  private _scanRegion: ScanRegion;
  private _active: boolean = false;
  private _paused: boolean = false;
  private _flashOn: boolean = false;
  private _destroyed: boolean = false;

  constructor(
    video: HTMLVideoElement,
    onDecode: (result: string) => void,
    preferredCamera?: string,
  ) {
    this.$video = video;
    this.$canvas = document.createElement('canvas');
    this._onDecode = onDecode as QrScanner['_onDecode'];
    this._preferredCamera = preferredCamera;

    this._onPlay = this._onPlay.bind(this);
    this._onLoadedMetaData = this._onLoadedMetaData.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._updateOverlay = this._updateOverlay.bind(this);

    // @ts-ignore
    video.disablePictureInPicture = true;
    // Allow inline playback on iPhone instead of requiring full screen playback,
    // see https://webkit.org/blog/6784/new-video-policies-for-ios/
    // @ts-ignore
    video.playsInline = true;
    // Allow play() on iPhone without requiring a user gesture. Should not really be needed as camera stream
    // includes no audio, but just to be safe.
    video.muted = true;

    // Avoid Safari stopping the video stream on a hidden video.
    // See https://github.com/cozmo/jsQR/issues/185
    let shouldHideVideo = false;
    if (video.hidden) {
      video.hidden = false;
      shouldHideVideo = true;
    }
    const videoContainer = video.parentElement!;

    this.$overlay = document.createElement('div');
    const overlayStyle = this.$overlay.style;
    overlayStyle.position = 'absolute';
    overlayStyle.display = 'none';
    overlayStyle.pointerEvents = 'none';
    this.$overlay.classList.add('scan-region-highlight');
    // default style; can be overwritten via css, e.g. by changing the svg's stroke color, hiding the
    // .scan-region-highlight-svg, setting a border, outline, background, etc.
    this.$overlay.innerHTML = '<svg class="scan-region-highlight-svg" viewBox="0 0 238 238" '
      + 'preserveAspectRatio="none" style="position:absolute;width:100%;height:100%;left:0;top:0;'
      + 'fill:none;stroke:#e9b213;stroke-width:4;stroke-linecap:round;stroke-linejoin:round">'
      + '<path d="M31 2H10a8 8 0 0 0-8 8v21M207 2h21a8 8 0 0 1 8 8v21m0 176v21a8 8 0 0 1-8 8h-21m-176 '
      + '0H10a8 8 0 0 1-8-8v-21"/></svg>';
    try {
      this.$overlay.firstElementChild!.animate({transform: ['scale(.98)', 'scale(1.01)']}, {
        duration: 400,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'ease-in-out',
      });
    } catch (e) {
    }
    videoContainer.insertBefore(this.$overlay, this.$video.nextSibling);
    this._scanRegion = this._calculateScanRegion(video);

    requestAnimationFrame(() => {
      // Checking in requestAnimationFrame which should avoid a potential additional re-flow for getComputedStyle.
      const videoStyle = window.getComputedStyle(video);
      if (videoStyle.display === 'none') {
        video.style.setProperty('display', 'block', 'important');
        shouldHideVideo = true;
      }
      if (videoStyle.visibility !== 'visible') {
        video.style.setProperty('visibility', 'visible', 'important');
        shouldHideVideo = true;
      }
      if (shouldHideVideo) {
        // Hide the video in a way that doesn't cause Safari to stop the playback.
        console.warn('QrScanner has overwritten the video hiding style to avoid Safari stopping the playback.');
        video.style.opacity = '0';
        video.style.width = '0';
        video.style.height = '0';
        if (this.$overlay && this.$overlay.parentElement) {
          this.$overlay.parentElement.removeChild(this.$overlay);
        }
        // @ts-ignore
        delete this.$overlay!;
        // @ts-ignore
        delete this.$codeOutlineHighlight!;
      }

      if (this.$overlay) {
        this._updateOverlay();
      }
    });

    video.addEventListener('play', this._onPlay);
    video.addEventListener('loadedmetadata', this._onLoadedMetaData);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('resize', this._updateOverlay);
  }

  async hasFlash(): Promise<boolean> {
    let stream: MediaStream | undefined;
    try {
      if (this.$video.srcObject) {
        if (!(this.$video.srcObject instanceof MediaStream)) return false; // srcObject is not a camera stream
        stream = this.$video.srcObject;
      } else {
        stream = (await getCameraStream(this._preferredCamera)).stream;
      }
      return 'torch' in stream.getVideoTracks()[0].getSettings();
    } catch (e) {
      return false;
    } finally {
      // close the stream we just opened for detecting whether it supports flash
      if (stream && stream !== this.$video.srcObject) {
        console.warn('Call hasFlash after successfully starting the scanner to avoid creating '
          + 'a temporary video stream');
        stopVideoStream(stream);
      }
    }
  }

  async toggleFlash(): Promise<void> {
    if (this._flashOn) {
      await this.turnFlashOff();
    } else {
      await this.turnFlashOn();
    }
  }

  async turnFlashOn(): Promise<void> {
    if (this._flashOn || this._destroyed) return;
    this._flashOn = true;
    if (!this._active || this._paused) return; // flash will be turned on later on .start()
    try {
      if (!await this.hasFlash()) throw 'No flash available';
      // Note that the video track is guaranteed to exist and to be a MediaStream due to the check in hasFlash
      await (this.$video.srcObject as MediaStream).getVideoTracks()[0].applyConstraints({
        // @ts-ignore: constraint 'torch' is unknown to ts
        advanced: [{torch: true}],
      });
    } catch (e) {
      this._flashOn = false;
      throw e;
    }
  }

  async turnFlashOff(): Promise<void> {
    if (!this._flashOn) return;
    // applyConstraints with torch: false does not work to turn the flashlight off, as a stream's torch stays
    // continuously on, see https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints#torch. Therefore,
    // we have to stop the stream to turn the flashlight off.
    this._flashOn = false;
    await this._restartVideoStream();
  }

  destroy(): void {
    this.$video.removeEventListener('loadedmetadata', this._onLoadedMetaData);
    this.$video.removeEventListener('play', this._onPlay);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('resize', this._updateOverlay);

    this._destroyed = true;
    this._flashOn = false;
    this.stop();
  }

  async start(): Promise<void> {
    if (this._destroyed) throw new Error('The QR scanner can not be started as it had been destroyed.');
    if (this._active && !this._paused) return;

    if (window.location.protocol !== 'https:') {
      // warn but try starting the camera anyways
      console.warn('The camera stream is only accessible if the page is transferred via https.');
    }

    this._active = true;
    if (document.hidden) return; // camera will be started as soon as tab is in foreground
    this._paused = false;
    if (this.$video.srcObject) {
      // camera stream already/still set
      await this.$video.play();
      return;
    }

    try {
      const { stream, facingMode } = await getCameraStream(this._preferredCamera);
      if (!this._active || this._paused) {
        // was stopped in the meantime
        stopVideoStream(stream);
        return;
      }
      this._setVideoMirror(facingMode);
      this.$video.srcObject = stream;
      await this.$video.play();

      // Restart the flash if it was previously on
      if (this._flashOn) {
        this._flashOn = false; // force turnFlashOn to restart the flash
        this.turnFlashOn().catch(() => {});
      }
    } catch (e) {
      if (this._paused) return;
      this._active = false;
      throw e;
    }
  }

  stop(): void {
    this.pause();
    this._active = false;
  }

  async pause(stopStreamImmediately = false): Promise<boolean> {
    this._paused = true;
    if (!this._active) return true;
    this.$video.pause();

    if (this.$overlay) {
      this.$overlay.style.display = 'none';
    }

    const stopStream = () => {
      if (this.$video.srcObject instanceof MediaStream) {
        // revoke srcObject only if it's a stream which was likely set by us
        stopVideoStream(this.$video.srcObject);
        this.$video.srcObject = null;
      }
    };

    if (stopStreamImmediately) {
      stopStream();
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!this._paused) return false;
    stopStream();
    return true;
  }

  async setCamera(id: string): Promise<void> {
    if (id === this._preferredCamera) return;
    this._preferredCamera = id;
    // Restart the scanner with the new camera which will also update the video mirror and the scan region.
    await this._restartVideoStream();
  }

  private _onPlay(): void {
    this._scanRegion = this._calculateScanRegion(this.$video);
    this._updateOverlay();
    if (this.$overlay) {
      this.$overlay.style.display = '';
    }
    this.raf();
  }

  private _onLoadedMetaData(): void {
    this._scanRegion = this._calculateScanRegion(this.$video);
    this._updateOverlay();
  }

  private _onVisibilityChange(): void {
    if (document.hidden) {
      this.pause();
    } else if (this._active) {
      this.start();
    }
  }

  private _calculateScanRegion(video: HTMLVideoElement): ScanRegion {
    // Default scan region calculation. Note that this can be overwritten in the constructor.
    const smallestDimension = Math.min(video.videoWidth, video.videoHeight);
    const scanRegionSize = Math.round(2 / 3 * smallestDimension);
    return {
      x: Math.round((video.videoWidth - scanRegionSize) / 2),
      y: Math.round((video.videoHeight - scanRegionSize) / 2),
      width: scanRegionSize,
      height: scanRegionSize,
    };
  }

  private _updateOverlay(): void {
    requestAnimationFrame(() => {
      // Running in requestAnimationFrame which should avoid a potential additional re-flow for getComputedStyle
      // and offsetWidth, offsetHeight, offsetLeft, offsetTop.
      if (!this.$overlay) return;
      const video = this.$video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const elementWidth = video.offsetWidth;
      const elementHeight = video.offsetHeight;
      const elementX = video.offsetLeft;
      const elementY = video.offsetTop;

      const videoStyle = window.getComputedStyle(video);
      const videoObjectFit = videoStyle.objectFit;
      const videoAspectRatio = videoWidth / videoHeight;
      const elementAspectRatio = elementWidth / elementHeight;
      let videoScaledWidth: number;
      let videoScaledHeight: number;
      switch (videoObjectFit) {
        case 'none':
          videoScaledWidth = videoWidth;
          videoScaledHeight = videoHeight;
          break;
        case 'fill':
          videoScaledWidth = elementWidth;
          videoScaledHeight = elementHeight;
          break;
        default: // 'cover', 'contains', 'scale-down'
          if (videoObjectFit === 'cover'
            ? videoAspectRatio > elementAspectRatio
            : videoAspectRatio < elementAspectRatio) {
            // The scaled height is the element height
            // - for 'cover' if the video aspect ratio is wider than the element aspect ratio
            //   (scaled height matches element height and scaled width overflows element width)
            // - for 'contains'/'scale-down' if element aspect ratio is wider than the video aspect ratio
            //   (scaled height matched element height and element width overflows scaled width)
            videoScaledHeight = elementHeight;
            videoScaledWidth = videoScaledHeight * videoAspectRatio;
          } else {
            videoScaledWidth = elementWidth;
            videoScaledHeight = videoScaledWidth / videoAspectRatio;
          }
          if (videoObjectFit === 'scale-down') {
            // for 'scale-down' the dimensions are the minimum of 'contains' and 'none'
            videoScaledWidth = Math.min(videoScaledWidth, videoWidth);
            videoScaledHeight = Math.min(videoScaledHeight, videoHeight);
          }
      }

      // getComputedStyle is so nice to convert keywords (left, center, right, top, bottom) to percent and makes
      // sure to set the default of 50% if only one or no component was provided, therefore we can be sure that
      // both components are set. Additionally, it converts units other than px (e.g. rem) to px.
      const [videoX, videoY] = videoStyle.objectPosition.split(' ').map((length, i) => {
        const lengthValue = parseFloat(length);
        return length.endsWith('%')
          ? (!i ? elementWidth - videoScaledWidth : elementHeight - videoScaledHeight) * lengthValue / 100
          : lengthValue;
      });

      const regionWidth = this._scanRegion.width || videoWidth;
      const regionHeight = this._scanRegion.height || videoHeight;
      const regionX = this._scanRegion.x || 0;
      const regionY = this._scanRegion.y || 0;

      const overlayStyle = this.$overlay.style;
      overlayStyle.width = `${regionWidth / videoWidth * videoScaledWidth}px`;
      overlayStyle.height = `${regionHeight / videoHeight * videoScaledHeight}px`;
      overlayStyle.top = `${elementY + videoY + regionY / videoHeight * videoScaledHeight}px`;
      const isVideoMirrored = /scaleX\(-1\)/.test(video.style.transform!);
      overlayStyle.left = `${elementX
      + (isVideoMirrored ? elementWidth - videoX - videoScaledWidth : videoX)
      + (isVideoMirrored ? videoWidth - regionX - regionWidth : regionX) / videoWidth * videoScaledWidth}px`;
      // apply same mirror as on video
      overlayStyle.transform = video.style.transform;
    });
  }

  private raf(): void {
    if (!this._active || this.$video.paused || this.$video.ended) return;
    // If requestVideoFrameCallback is available use that to avoid unnecessary scans on the same frame as the
    // camera's framerate can be lower than the screen refresh rate and this._maxScansPerSecond, especially in dark
    // settings where the exposure time is longer. Both, requestVideoFrameCallback and requestAnimationFrame are not
    // being fired if the tab is in the background, which is what we want.
    const requestFrame = 'requestVideoFrameCallback' in this.$video
      // @ts-ignore
      ? this.$video.requestVideoFrameCallback.bind(this.$video)
      : requestAnimationFrame;
    requestFrame(async () => {
      if (this.$video.readyState <= 1) {
        // Skip scans until the video is ready as drawImage() only works correctly on a video with readyState
        // > 1, see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage#Notes.
        // This also avoids false positives for videos paused after a successful scan which remains visible on
        // the canvas until the video is started again and ready.
        this.raf();
        return;
      }

      try {
        videoToCanvas(this.$video, this._scanRegion, this.$canvas);
        const result = scanCanvas(this.$canvas);
        if (result) this._onDecode(result);
      } catch (error) {
        if (!this._active) return;
        if (error) console.log(error);
      }
      this.raf();
    });
  }

  private async _restartVideoStream(): Promise<void> {
    // Note that we always pause the stream and not only if !this._paused as even if this._paused === true, the
    // stream might still be running, as it's by default only stopped after a delay of 300ms.
    const wasPaused = this._paused;
    const paused = await this.pause(true);
    if (!paused || wasPaused || !this._active) return;
    await this.start();
  }

  private _setVideoMirror(facingMode: FacingMode): void {
    // in user facing mode mirror the video to make it easier for the user to position the QR code
    const scaleFactor = facingMode === 'user' ? -1 : 1;
    this.$video.style.transform = 'scaleX(' + scaleFactor + ')';
  }

}
