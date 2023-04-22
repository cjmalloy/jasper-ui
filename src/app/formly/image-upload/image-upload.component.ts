import { Component, EventEmitter, HostBinding, Output } from '@angular/core';

@Component({
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.scss']
})
export class ImageUploadComponent {
  @HostBinding('class') css = 'form-array';

  @Output()
  data = new EventEmitter<string>();

  constructor() { }

  readImage(files?: FileList) {
    if (!files || !files.length) return;
    const file = files[0]!;
    const reader = new FileReader();
    reader.onload = () => this.data.next(reader.result as string);
    reader.readAsDataURL(file);
  }
}
