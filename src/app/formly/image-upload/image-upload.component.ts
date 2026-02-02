import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { catchError, last, map } from 'rxjs';
import { Ref } from '../../model/ref';
import { ProxyService } from '../../service/api/proxy.service';
import { Store } from '../../store/store';
import { Saving } from '../../store/submit';
import { readFileAsDataURL } from '../../util/async';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.scss'],
  host: { 'class': 'form-array' }
})
export class ImageUploadComponent {
  private store = inject(Store);
  private proxy = inject(ProxyService);


  readonly data = output<Saving | undefined | string>();

  readImage(files?: FileList) {
    this.data.emit(undefined)
    if (!files || !files.length) return;
    const file = files[0]!;
    this.data.emit({ name: file.name });
    this.proxy.save(file, this.store.account.origin).pipe(
      map(event => {
        switch (event.type) {
          case HttpEventType.Response:
            return event.body;
          case HttpEventType.UploadProgress:
            const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
            this.data.emit({ name: file.name, progress: percentDone });
            return null;
        }
        return null;
      }),
      last(),
      map((ref: Ref | null) => ref?.url),
      catchError(err => readFileAsDataURL(file)) // base64
    ).subscribe(url => this.data.emit({ url, name: file.name }));
  }
}
