import { AsyncPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, Input, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
  selector: 'app-chat-video',
  templateUrl: './chat-video.component.html',
  styleUrl: './chat-video.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MobxAngularModule,
    RouterLink,
    TitleDirective,
    AsyncPipe,
  ],
})
export class ChatVideoComponent implements AfterViewInit, OnDestroy {

  @Input()
  url = 'tag:/chat';

  private audioContexts = new Map<string, { ctx: AudioContext, analyser: AnalyserNode }>();
  private speakerDebounce?: ReturnType<typeof setTimeout>;
  private animationFrameId?: number;

  constructor(
    public store: Store,
    private admin: AdminService,
    private exts: ExtService,
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

  authorExt$(user: string): Observable<Ext> {
    return this.exts.getCachedExt(user).pipe(map(x => ({ ...x, name: x.name || x.tag.substring('+user/'.length) })));
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

  get isTwoPersonCall() {
    return this.userStreams.length === 1;
  }

  get activeSpeaker() {
    return this.store.video.activeSpeaker;
  }

  get featuredStream() {
    if (this.isTwoPersonCall) {
      return this.userStreams[0]; // Callee on top for 2-person
    }
    return this.userStreams.find(u => u.tag === this.activeSpeaker) || this.userStreams[0];
  }

  get gridStreams() {
    if (this.isTwoPersonCall) return [];
    return this.userStreams.filter(u => u.tag !== this.activeSpeaker);
  }

  setupAudioDetection(tag: string, stream: MediaStream) {
    if (this.audioContexts.has(tag)) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    this.audioContexts.set(tag, { ctx, analyser });

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const checkLevel = () => {
      if (!this.store.video.enabled) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;

      runInAction(() => this.store.video.speakingLevels.set(tag, avg));

      if (avg > 25) { // Speaking threshold
        clearTimeout(this.speakerDebounce);
        this.speakerDebounce = setTimeout(() => {
          runInAction(() => this.store.video.activeSpeaker = tag);
        }, 300);
      }
      this.animationFrameId = requestAnimationFrame(checkLevel);
    };
    checkLevel();
  }

  ngOnDestroy() {
    // Clear the debounce timeout
    if (this.speakerDebounce) {
      clearTimeout(this.speakerDebounce);
    }

    // Stop the requestAnimationFrame loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Close all AudioContext instances
    this.audioContexts.forEach(({ ctx }) => {
      ctx.close();
    });
    this.audioContexts.clear();
  }

}
