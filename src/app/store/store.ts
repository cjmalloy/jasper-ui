import { Injectable } from '@angular/core';
import { computed, makeObservable, observable } from 'mobx';
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

  @observable.ref
  local = new LocalStore();
  @observable
  eventBus = new EventBus();
  @observable
  origins = new OriginStore();
  @observable
  account = new AccountStore(this.origins);
  @observable
  view = new ViewStore(this.route, this.account, this.eventBus);
  @observable
  submit = new SubmitStore(this.route, this.eventBus);
  @observable
  settings = new SettingsStore(this.route);
  @observable
  graph = new GraphStore();
  @observable
  theme = 'init-theme';

  constructor(
    private route: RouterStore,
  ) {
    makeObservable(this);
  }

  @computed
  get darkTheme() {
    return this.theme === 'dark-theme';
  }
}
