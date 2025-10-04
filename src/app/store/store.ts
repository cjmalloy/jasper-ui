import { inject, Injectable } from '@angular/core';
import { makeAutoObservable, observable } from 'mobx';
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
  account = new AccountStore(this.origins);
  view = new ViewStore(this.route, this.account);
  theme = 'init-theme';
  hotkey = false;
  offline = false;
  viewportHeight = screen.height;

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
