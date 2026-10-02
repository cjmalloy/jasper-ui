import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
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
    RouterLink,
    TitleDirective,
  ],
})
export class ChatVideoComponent implements AfterViewInit {

  private readonly destroyRef = inject(DestroyRef);
  readonly url = input('tag:/chat');

  constructor(
    public store: Store,
    private admin: AdminService,
    private exts: ExtService,
    private ts: TaggingService,
    private vs: VideoService,
  ) { }

  ngAfterViewInit() {
    if (this.store.local.inCall() && !this.store.video.enabled()) {
      this.ts.getResponse(this.url()).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(ref => {
          if (hasTag('plugin/user/lobby', ref)) {
            this.ts.deleteResponse('plugin/user/lobby', this.url()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
            if (confirm($localize`Rejoin the call?`)) this.call();
          }
        });
    }
  }

  readonly authorExts = toSignal(toObservable(computed(() =>
    [...new Set([...this.userStreams().map(u => u.tag), ...this.hungup()])]
  )).pipe(switchMap(users => users.length ? forkJoin(users.map(user =>
    this.exts.getCachedExt(user).pipe(map(x => [user, {
      ...x, name: x.name || x.tag.substring('+user/'.length),
    }] as const)),
  )).pipe(map(entries => new Map(entries))) : of(new Map<string, Ext>()))), { initialValue: new Map<string, Ext>() });

  setSpeaker(user: string) {
    this.store.video.activeSpeaker.set((user === this.store.account.tag()) ? '' : user);
  }

  readonly userStreams = computed(() => {
    return [...this.store.video.streams().entries()].map(e =>({
      tag: e[0],
      streams: e[1].filter(s => s.stream.getTracks().some(t => t.readyState === 'live')),
    }));
  });

  readonly isTwoPersonCall = computed(() => this.userStreams().length === 1);

  readonly featuredStream = computed(() => {
    if (this.userStreams().length === 1 || !this.store.video.activeSpeaker()) {
      return this.userStreams()[0];
    }
    return this.userStreams().find(u => u.tag === this.store.video.activeSpeaker()) || this.userStreams()[0];
  });

  readonly gridStreams = computed(() => this.userStreams().filter(u => u.tag !== this.featuredStream()?.tag));

  readonly hungup = computed(() => {
    return [...this.store.video.hungup().entries()].filter(e => e[1]).map(e => e[0]);
  });

  call() {
    this.store.video.enabled.set(true);
    this.store.local.setInCall(true);
    navigator.mediaDevices.getUserMedia(this.admin.getPlugin('plugin/user/video')!.config!.gumConfig)
      .then(stream => {
        if (this.destroyRef.destroyed || !this.store.video.enabled()) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        let transferred = false;
        this.ts.respond(['public', 'plugin/user/lobby'], this.url())
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => {
              if (!transferred) stream.getTracks().forEach(t => t.stop());
            }),
          )
          .subscribe(() => {
            if (!this.store.video.enabled()) {
              stream.getTracks().forEach(t => t.stop());
              return;
            }
            transferred = true;
            this.vs.call(this.url(), stream);
          });
      })
      .catch(err => {
        if (this.destroyRef.destroyed) return;
        console.log('Raised error when capturing:', err);
        this.hangup();
        alert($localize`Unable to access camera or microphone. Please check your browser permissions and try again.`);
      });
  }

  hangup() {
    this.store.video.enabled.set(false);
    this.store.local.setInCall(false);
    this.ts.deleteResponse('plugin/user/lobby', this.url()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.vs.hangup();
  }

}
