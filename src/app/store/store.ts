import { computed, inject, Injectable, signal } from '@angular/core';
import { RouterStore } from 'mobx-angular';
import { AccountStore } from './account';
import { EventBus } from './bus';
import { GraphStore } from './graph';
import { LocalStore } from './local';
import { OriginStore } from './origin';
import { SubmitStore } from './submit';
import { ViewStore } from './view';

@Injectable({
  providedIn: 'root'
})
export class Store {

  local = inject(LocalStore);
  eventBus = inject(EventBus);
  origins = inject(OriginStore);
  submit = inject(SubmitStore);
  graph = inject(GraphStore);
  account = inject(AccountStore);
  view = inject(ViewStore);
  
  private _theme = signal('init-theme');
  private _hotkey = signal(false);
  private _offline = signal(false);
  private _viewportHeight = signal(screen.height);

  // Backwards compatible getters/setters
  get theme() { return this._theme(); }
  set theme(value: string) { this._theme.set(value); }
  
  get hotkey() { return this._hotkey(); }
  set hotkey(value: boolean) { this._hotkey.set(value); }
  
  get offline() { return this._offline(); }
  set offline(value: boolean) { this._offline.set(value); }
  
  get viewportHeight() { return this._viewportHeight(); }
  set viewportHeight(value: number) { this._viewportHeight.set(value); }

  // Signal-based API
  theme$ = computed(() => this._theme());
  hotkey$ = computed(() => this._hotkey());
  offline$ = computed(() => this._offline());
  viewportHeight$ = computed(() => this._viewportHeight());

  constructor(
    private route: RouterStore,
  ) {
  }

  get darkTheme() {
    return this.theme === 'dark-theme';
  }
}
