import { HttpEvent, HttpEventType } from '@angular/common/http';
import { Component, EventEmitter, Output } from '@angular/core';
import { catchError, last, map, of } from 'rxjs';
import { Ref } from '../../model/ref';
import { ProxyService } from '../../service/api/proxy.service';
import { Store } from '../../store/store';

@Component({
  standalone: false,
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.scss'],
  host: {'class': 'form-array'}
})
export class PdfUploadComponent {

  @Output()
  data = new EventEmitter<{ url?: string, name: string, progress?: number } | undefined | string>();

  constructor(
    private store: Store,
    private proxy: ProxyService,
  ) { }

  readPdf(files?: FileList) {
    this.data.next(undefined)
    if (!files || !files.length) return;
    const file = files[0]!;
    this.data.next({ name: file.name })
    const reader = new FileReader();
    reader.onload = () => {
      this.proxy.save(file, this.store.account.origin).pipe(
        map((event: HttpEvent<Ref> | Ref): Ref | null => {
          if (!('type' in event)) return event as Ref;
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
        catchError(err => of(reader.result as string)) // base64
      ).subscribe(url => this.data.next({ url, name: file.name }));
    }
    reader.readAsDataURL(file);
  }
}
