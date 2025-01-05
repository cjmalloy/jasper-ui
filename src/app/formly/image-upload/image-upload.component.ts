import { Component, EventEmitter, Output } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { ProxyService } from '../../service/api/proxy.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.scss'],
  host: {'class': 'form-array'}
})
export class ImageUploadComponent {

  @Output()
  data = new EventEmitter<{ url: string, name: string }>();

  constructor(
    private store: Store,
    private proxy: ProxyService,
  ) { }

  readImage(files?: FileList) {
    if (!files || !files.length) return;
    const file = files[0]!;
    const reader = new FileReader();
    reader.onload = () => {
      this.proxy.save(file, this.store.account.origin).pipe(
        map(ref => ref.url),
        catchError(err => of(reader.result as string))
      ).subscribe(url => this.data.next({ url, name: file.name }));
    }
    reader.readAsDataURL(file);
  }
}
