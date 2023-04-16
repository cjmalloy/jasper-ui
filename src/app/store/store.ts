import { Injectable } from '@angular/core';
import { makeAutoObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { AccountStore } from './account';
import { EventBus } from './bus';
import { GraphStore } from './graph';
import { LocalStore } from './local';
import { OriginStore } from './origin';
import { SettingsStore } from './settings';
import { SubmitStore } from './submit';
import { ViewStore } from './view';

@Injectable({
  providedIn: 'root'
})
export class Store {

  local = new LocalStore();
  eventBus = new EventBus();
  origins = new OriginStore();
  account = new AccountStore(this.origins);
  view = new ViewStore(this.route, this.eventBus);
  submit = new SubmitStore(this.route, this.eventBus);
  settings = new SettingsStore(this.route);
  graph = new GraphStore(this.route);
  theme = 'init-theme';

  constructor(
    private route: RouterStore,
  ) {
    makeAutoObservable(this, {
      local: observable.ref,
    });
  }

  get darkTheme() {
    return this.theme === 'dark-theme';
  }
}
