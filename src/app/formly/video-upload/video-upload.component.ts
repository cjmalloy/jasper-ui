import { Component, EventEmitter, HostBinding, Output } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ScrapeService } from '../../service/api/scrape.service';

@Component({
  selector: 'app-video-upload',
  templateUrl: './video-upload.component.html',
  styleUrls: ['./video-upload.component.scss']
})
export class VideoUploadComponent {
  @HostBinding('class') css = 'form-array';

  @Output()
  data = new EventEmitter<string>();

  constructor(
    private scrapes: ScrapeService,
  ) { }

  readVideo(files?: FileList) {
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
