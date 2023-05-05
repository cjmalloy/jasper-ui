import { Component, HostBinding, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { runInAction } from 'mobx';
import { ConfigService } from './service/config.service';
import { Store } from './store/store';
import { file } from './util/download';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  @HostBinding('class.electron') electron = this.config.electron;

  constructor(
    public config: ConfigService,
    public store: Store,
    private router: Router,
  ) { }

  get debug() {
    return !isDevMode() && this.store.account.debug;
  }

  dragOver(event: DragEvent) {
    event.preventDefault();
  }

  drop(event: DragEvent) {
    const items = event.dataTransfer?.items;
    if (!items) {
      this.store.submit.setFiles([]);
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      console.log(d.getAsFile()?.name);
      console.log(d.type);
      console.log(d.kind);
    }
    const files = [] as any;
    const audio = [] as any;
    const video = [] as any;
    const images = [] as any;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind !== 'file') return;
      if (d.type === 'application/json' || d.type === 'application/zip') {
        files.push(d.getAsFile());
      }
      if (d.type.startsWith('audio/')) {
        audio.push(d.getAsFile());
      }
      if (d.type.startsWith('video/')) {
        video.push(d.getAsFile());
      }
      if (d.type.startsWith('image/')) {
        images.push(d.getAsFile());
      }
    }
    event.preventDefault();
    runInAction(() => {
      this.store.submit.setFiles(files);
      this.store.submit.audio = audio as any;
      this.store.submit.video = video as any;
      this.store.submit.images = images as any;
    });
    if (!this.store.submit.upload) {
      this.router.navigate(['/submit/upload']);
    }
  }

}
