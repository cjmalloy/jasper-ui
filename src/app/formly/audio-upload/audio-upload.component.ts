import { Component, EventEmitter, HostBinding, Output } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ScrapeService } from '../../service/api/scrape.service';

@Component({
  selector: 'app-audio-upload',
  templateUrl: './audio-upload.component.html',
  styleUrls: ['./audio-upload.component.scss']
})
export class AudioUploadComponent {
  @HostBinding('class') css = 'form-array';

  @Output()
  data = new EventEmitter<string>();

  constructor(
    private scraper: ScrapeService,
  ) { }

  readAudio(files?: FileList) {
    if (!files || !files.length) return;
    const file = files[0]!;
    const reader = new FileReader();
    reader.onload = () => {
      this.scraper.cache(file).pipe(
        catchError(err => of(reader.result as string))
      ).subscribe(url => this.data.next(url));
    }
    reader.readAsDataURL(file);
  }
}
