import { computed, inject, Injectable, signal } from '@angular/core';
import { AccountStore } from './account';
import { EventBus } from './bus';
import { GraphStore } from './graph';
import { LocalStore } from './local';
import { OriginStore } from './origin';
import { RouterStore } from './router';
import { SubmitStore } from './submit';
import { VideoStore } from './video';
import { ViewStore } from './view';

@Injectable({
  providedIn: 'root'
})
export class Store {
  private route = inject(RouterStore);


  local = new LocalStore();
  eventBus = new EventBus();
  origins = new OriginStore();
  account = new AccountStore(this.origins);
  view = new ViewStore(this.route, this.account);
  video = new VideoStore();
  submit = new SubmitStore(this.route, this.eventBus);
  graph = new GraphStore(this.route);

  readonly theme = signal('init-theme');
  readonly hotkey = signal(false);
  readonly offline = signal(false);
  readonly viewportHeight = signal(screen.height);
  readonly helpSteps = signal(0);
  readonly helpStepIndex = signal(-1);

  readonly darkTheme = computed(() => this.theme() === 'dark-theme');
}
