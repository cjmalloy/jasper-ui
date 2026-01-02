import { AfterViewInit, ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { TaggingService } from '../../../service/api/tagging.service';
import { VideoService } from '../../../service/video.service';
import { Store } from '../../../store/store';
import { hasTag } from '../../../util/tag';
import { LoadingComponent } from '../../loading/loading.component';
import { NavComponent } from '../../nav/nav.component';

@Component({
  selector: 'app-chat-video',
  templateUrl: './chat-video.component.html',
  styleUrl: './chat-video.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NavComponent,
    LoadingComponent,
    MobxAngularModule,
  ],
})
export class ChatVideoComponent implements AfterViewInit {

  @Input()
  url = 'tag:/chat';

  constructor(
    public store: Store,
    private ts: TaggingService,
    private vs: VideoService,
  ) { }

  ngAfterViewInit() {
    if (!this.store.video.enabled) {
      this.ts.getResponse(this.url)
        .subscribe(ref => {
          if (hasTag('plugin/user/lobby', ref)) this.call();
        });
    }
  }

  get userStreams() {
    return [...this.store.video.streams.entries()].map(e =>({ tag: e[0], streams: e[1].filter(s => s.getTracks().some(t => t.readyState === 'live')) }));
  }

  get hungup() {
    return [...this.store.video.hungup.entries()].filter(e => e[1]).map(e => e[0]);
  }

  call() {
    runInAction(() => this.store.video.enabled = true);
    this.ts.respond(['public', 'plugin/user/lobby'], this.url).subscribe();
    navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 640 }, height: { ideal: 640 } } })
      .then(stream => {
        if (!this.store.video.enabled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        this.vs.call(this.url, stream);
      })
      .catch(err => {
        console.log('Raised error when capturing:', err);
        runInAction(() => this.store.video.enabled = false);
        alert($localize`Unable to access camera or microphone. Please check your browser permissions and try again.`);
      });
  }

  hangup() {
    runInAction(() => this.store.video.enabled = false);
    this.ts.deleteResponse('plugin/user/lobby', this.url).subscribe();
    this.vs.hangup();
  }
}
