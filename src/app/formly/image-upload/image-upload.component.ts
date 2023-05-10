import { Component, EventEmitter, HostBinding, Output } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ScrapeService } from '../../service/api/scrape.service';

@Component({
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.scss']
})
export class ImageUploadComponent {
  @HostBinding('class') css = 'form-array';

  @Output()
  data = new EventEmitter<string>();

  constructor(
    private scrapes: ScrapeService,
  ) { }

  readImage(files?: FileList) {
    if (!files || !files.length) return;
    const file = files[0]!;
    const reader = new FileReader();
    reader.onload = () => {
      this.scrapes.cache(file).pipe(
        catchError(err => of(reader.result as string))
      ).subscribe(url => this.data.next(url));
    }
    reader.readAsDataURL(file);
  }
}
