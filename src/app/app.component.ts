import { Component, HostBinding } from '@angular/core';
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

  dragOver(event: DragEvent) {
    event.preventDefault();
  }

  drop(event: DragEvent) {
    const items = event.dataTransfer?.items;
    if (!items) {
      this.store.submit.setFiles([]);
      return;
    }
    const result = [] as any;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind !== 'file') return;
      result.push(d.getAsFile());
    }
    event.preventDefault();
    this.store.submit.setFiles(result);
    if (!this.store.submit.upload) {
      this.router.navigate(['/submit/upload']);
    }
  }

}
