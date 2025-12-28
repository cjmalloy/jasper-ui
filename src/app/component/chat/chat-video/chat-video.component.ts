import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { Ref } from '../../../model/ref';
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
  query = 'chat';
  @Input()
  responseOf?: Ref;

  constructor(
    public store: Store,
    private ts: TaggingService,
    private vs: VideoService,
    private cd: ChangeDetectorRef,
  ) { }

  ngAfterViewInit() {
    if (!this.store.video.enabled) {
      this.ts.getResponse(this.responseOf?.url || ('tag:/' + this.query))
        .subscribe(ref => {
          if (hasTag('plugin/user/video', ref)) this.call();
        });
    }
  }

  get userStreams() {
    return [...this.store.video.streams.entries()].map(e =>({ tag: e[0], streams: e[1]}));
  }

  call() {
    runInAction(() => this.store.video.enabled = true);
    this.ts.respond(['public', 'plugin/user/video'], this.responseOf?.url || ('tag:/' + this.query)).subscribe();
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {
        if (!this.store.video.enabled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        this.vs.call(this.query, this.responseOf?.url || '', stream);
      })
      .catch(err => {
        console.log("Raised error when capturing:", err);
      });
  }

  hangup() {
    runInAction(() => this.store.video.enabled = false);
    this.ts.deleteResponse('plugin/user/video', this.responseOf?.url || ('tag:/' + this.query)).subscribe();
    this.vs.hangup();
  }
}
