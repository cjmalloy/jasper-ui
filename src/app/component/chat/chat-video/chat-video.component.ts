import { AsyncPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { map, Observable } from 'rxjs';
import { TitleDirective } from '../../../directive/title.directive';
import { Ext } from '../../../model/ext';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { VideoService } from '../../../service/video.service';
import { Store } from '../../../store/store';
import { hasTag } from '../../../util/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-chat-video',
  templateUrl: './chat-video.component.html',
  styleUrl: './chat-video.component.scss',
  imports: [
    RouterLink,
    TitleDirective,
    AsyncPipe,
  ],
})
export class ChatVideoComponent implements AfterViewInit {

  @Input()
  url = 'tag:/chat';

  constructor(
    public store: Store,
    private admin: AdminService,
    private exts: ExtService,
    private ts: TaggingService,
    private vs: VideoService,
  ) { }

  ngAfterViewInit() {
    if (this.store.local.inCall() && !this.store.video.enabled) {
      this.ts.getResponse(this.url)
        .subscribe(ref => {
          if (hasTag('plugin/user/lobby', ref)) {
            this.ts.deleteResponse('plugin/user/lobby', this.url).subscribe();
            if (confirm($localize`Rejoin the call?`)) this.call();
          }
        });
    }
  }

  authorExt$(user: string): Observable<Ext> {
    return this.exts.getCachedExt(user).pipe(map(x => ({ ...x, name: x.name || x.tag.substring('+user/'.length) })));
  }

  set speaker(user: string) {
    this.store.video.activeSpeaker = (user === this.store.account.tag) ? '' : user;
  }

  get userStreams() {
    return [...this.store.video.streams.entries()].map(e =>({
      tag: e[0],
      streams: e[1].filter(s => s.stream.getTracks().some(t => t.readyState === 'live')),
    }));
  }

  get isTwoPersonCall() {
    return this.userStreams.length === 1;
  }

  get featuredStream() {
    if (this.userStreams.length === 1 || !this.store.video.activeSpeaker) {
      return this.userStreams[0];
    }
    return this.userStreams.find(u => u.tag === this.store.video.activeSpeaker) || this.userStreams[0];
  }

  get gridStreams() {
    if (this.userStreams.length === 1) return [];
    if (!this.store.video.activeSpeaker) return this.userStreams.slice(1);
    return this.userStreams.filter(u => u.tag !== this.store.video.activeSpeaker);
  }

  get hungup() {
    return [...this.store.video.hungup.entries()].filter(e => e[1]).map(e => e[0]);
  }

  call() {
    this.store.video.enabled = true;
    this.store.local.setInCall(true);
    navigator.mediaDevices.getUserMedia(this.admin.getPlugin('plugin/user/video')!.config!.gumConfig)
      .then(stream => {
        if (!this.store.video.enabled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        this.ts.respond(['public', 'plugin/user/lobby'], this.url)
          .subscribe(() => this.vs.call(this.url, stream));
      })
      .catch(err => {
        console.log('Raised error when capturing:', err);
        this.hangup();
        alert($localize`Unable to access camera or microphone. Please check your browser permissions and try again.`);
      });
  }

  hangup() {
    this.store.video.enabled = false;
    this.store.local.setInCall(false);
    this.ts.deleteResponse('plugin/user/lobby', this.url).subscribe();
    this.vs.hangup();
  }
}
