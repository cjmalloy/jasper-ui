import { Component, EventEmitter, HostBinding, Output } from '@angular/core';

@Component({
  selector: 'app-audio-upload',
  templateUrl: './audio-upload.component.html',
  styleUrls: ['./audio-upload.component.scss']
})
export class AudioUploadComponent {
  @HostBinding('class') css = 'form-array';

  @Output()
  data = new EventEmitter<string>();

  constructor() { }

  readAudio(files?: FileList) {
    if (!files || !files.length) return;
    const file = files[0]!;
    const reader = new FileReader();
    reader.onload = () => this.data.next(reader.result as string);
    reader.readAsDataURL(file);
  }
}
