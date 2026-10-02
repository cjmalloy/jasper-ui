import { Injectable, signal } from '@angular/core';
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

  local = new LocalStore();
  eventBus = new EventBus();
  origins = new OriginStore();
  account = new AccountStore(this.origins);
  view = new ViewStore(this.route, this.account);
  video = new VideoStore();
  submit = new SubmitStore(this.route, this.eventBus);
  graph = new GraphStore(this.route);

  private readonly _theme = signal('init-theme');
  private readonly _hotkey = signal(false);
  private readonly _offline = signal(false);
  private readonly _viewportHeight = signal(screen.height);
  private readonly _helpSteps = signal(0);
  private readonly _helpStepIndex = signal(-1);

  constructor(
    private route: RouterStore,
  ) { }

  get theme() { return this._theme(); }
  set theme(value: string) { this._theme.set(value); }

  get hotkey() { return this._hotkey(); }
  set hotkey(value: boolean) { this._hotkey.set(value); }

  get offline() { return this._offline(); }
  set offline(value: boolean) { this._offline.set(value); }

  get viewportHeight() { return this._viewportHeight(); }
  set viewportHeight(value: number) { this._viewportHeight.set(value); }

  get helpSteps() { return this._helpSteps(); }
  set helpSteps(value: number) { this._helpSteps.set(value); }

  get helpStepIndex() { return this._helpStepIndex(); }
  set helpStepIndex(value: number) { this._helpStepIndex.set(value); }

  get darkTheme() {
    return this.theme === 'dark-theme';
  }
}
