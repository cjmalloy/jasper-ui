

export type FacingMode = 'environment' | 'user';
export interface Camera {
  id: string;
  label: string;
}

export async function checkCamera(): Promise<boolean> {
  try {
    return !!(await listCameras(false)).length;
  } catch (e) {
    return false;
  }
}

export async function listCameras(requestLabels = false): Promise<Array<Camera>> {
  if (!navigator.mediaDevices) return [];

  const enumerateCameras = async (): Promise<Array<MediaDeviceInfo>> =>
    (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');

  // Note that enumerateDevices can always be called and does not prompt the user for permission.
  // However, enumerateDevices only includes device labels if served via https and an active media stream exists
  // or permission to access the camera was given. Therefore, if we're not getting labels but labels are requested
  // ask for camera permission by opening a stream.
  let openedStream: MediaStream | undefined;
  try {
    if (requestLabels && (await enumerateCameras()).every((camera) => !camera.label)) {
      openedStream = await navigator.mediaDevices.getUserMedia({audio: false, video: true});
    }
  } catch (e) {
    // Fail gracefully, especially if the device has no camera or on mobile when the camera is already in use
    // and some browsers disallow a second stream.
  }

  try {
    return (await enumerateCameras()).map((camera, i) => ({
      id: camera.deviceId,
      label: camera.label || (i === 0 ? 'Default Camera' : `Camera ${i + 1}`),
    }));
  } finally {
    // close the stream we just opened for getting camera access for listing the device labels
    if (openedStream) {
      console.warn('Call listCameras after successfully starting a QR scanner to avoid creating '
        + 'a temporary video stream');
      stopVideoStream(openedStream);
    }
  }
}

export async function getCameraStream(deviceId?: string): Promise<{ stream: MediaStream, facingMode: FacingMode }> {
  if (!navigator.mediaDevices) throw 'Camera not found.';

  const constraintsWithoutCamera: Array<MediaTrackConstraints> = [{
    width: {min: 1024}
  }, {
    width: {min: 768}
  }, {

  }];
  const constraintsWithCamera = constraintsWithoutCamera.map((constraint) => Object.assign({}, constraint, {
    deviceId: deviceId,
    facingMode: 'environment',
  }));

  for (const constraints of [...constraintsWithCamera, ...constraintsWithoutCamera]) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: constraints});
      // Try to determine the facing mode from the stream, otherwise use a guess or 'environment' as
      // default. Note that the guess is not always accurate as Safari returns cameras of different facing
      // mode, even for exact facingMode constraints.
      const facingMode = getFacingMode(stream) || 'user';
      return {stream, facingMode};
    } catch (e) {
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
  // Try to determine the facing mode from the stream, otherwise use a guess or 'environment' as
  // default. Note that the guess is not always accurate as Safari returns cameras of different facing
  // mode, even for exact facingMode constraints.
  const facingMode = getFacingMode(stream) || 'environment';
  return { stream, facingMode };
}

function getFacingMode(videoStream: MediaStream): FacingMode | null {
  const videoTrack = videoStream.getVideoTracks()[0];
  if (!videoTrack) return null; // unknown
  // inspired by https://github.com/JodusNodus/react-qr-reader/blob/master/src/getDeviceId.js#L13
  return /rear|back|environment/i.test(videoTrack.label)
    ? 'environment'
    : /front|user|face/i.test(videoTrack.label)
      ? 'user'
      : null; // unknown
}

export function stopVideoStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop(); //  note that this will also automatically turn the flashlight off
    stream.removeTrack(track);
  }
}
