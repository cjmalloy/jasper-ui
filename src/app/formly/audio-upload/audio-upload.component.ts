import { HttpEventType } from '@angular/common/http';
import { Component, EventEmitter, Output } from '@angular/core';
import { catchError, last, map } from 'rxjs';
import { Ref } from '../../model/ref';
import { ProxyService } from '../../service/api/proxy.service';
import { Store } from '../../store/store';
import { Saving } from '../../store/submit';
import { readFileAsDataURL } from '../../util/async';

@Component({
    selector: 'app-audio-upload',
    templateUrl: './audio-upload.component.html',
    styleUrls: ['./audio-upload.component.scss'],
    host: { 'class': 'form-array' }
})
export class AudioUploadComponent {

  @Output()
  data = new EventEmitter<Saving | undefined | string>();

  constructor(
    private store: Store,
    private proxy: ProxyService,
  ) { }

  readAudio(files?: FileList) {
    this.data.next(undefined)
    if (!files || !files.length) return;
    const file = files[0]!;
    this.data.next({ name: file.name });
    this.proxy.save(file, this.store.account.origin).pipe(
      map(event => {
        switch (event.type) {
          case HttpEventType.Response:
            return event.body;
          case HttpEventType.UploadProgress:
            const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
            this.data.next({ name: file.name, progress: percentDone });
            return null;
        }
        return null;
      }),
      last(),
      map((ref: Ref | null) => ref?.url),
      catchError(err => readFileAsDataURL(file)) // base64
    ).subscribe(url => this.data.next({ url, name: file.name }));
  }
}
