import { Component, EventEmitter, HostBinding, Output } from '@angular/core';

@Component({
  selector: 'app-video-upload',
  templateUrl: './video-upload.component.html',
  styleUrls: ['./video-upload.component.scss']
})
export class VideoUploadComponent {
  @HostBinding('class') css = 'form-array';

  @Output()
  data = new EventEmitter<string>();

  constructor() { }

  readVideo(files?: FileList) {
    if (!files || !files.length) return;
    const file = files[0]!;
    const reader = new FileReader();
    reader.onload = () => this.data.next(reader.result as string);
    reader.readAsDataURL(file);
  }
}
