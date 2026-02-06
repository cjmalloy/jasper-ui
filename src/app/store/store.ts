import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountStore } from './account';
import { EventBus } from './bus';
import { GraphStore } from './graph';
import { LocalStore } from './local';
import { OriginStore } from './origin';
import { SubmitStore } from './submit';
import { VideoStore } from './video';
import { ViewStore } from './view';

@Injectable({
  providedIn: 'root'
})
export class Store {

  private router = inject(Router);

  local = new LocalStore();
  eventBus = new EventBus();
  origins = new OriginStore();
  account = new AccountStore(this.origins);
  view = new ViewStore(this.router, this.account);
  video = new VideoStore();
  submit = new SubmitStore(this.router, this.eventBus);
  graph = new GraphStore(this.router);

  private _theme = signal('init-theme');
  private _hotkey = signal(false);
  private _offline = signal(false);
  private _viewportHeight = signal(screen.height);

  get theme() { return this._theme(); }
  set theme(value: string) { this._theme.set(value); }

  get hotkey() { return this._hotkey(); }
  set hotkey(value: boolean) { this._hotkey.set(value); }

  get offline() { return this._offline(); }
  set offline(value: boolean) { this._offline.set(value); }

  get viewportHeight() { return this._viewportHeight(); }
  set viewportHeight(value: number) { this._viewportHeight.set(value); }

  get darkTheme() {
    return this._theme() === 'dark-theme';
  }
}
