import { Injectable } from '@angular/core';
import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { AccountStore } from './account';
import { GraphStore } from './graph';
import { OriginStore } from './origin';
import { SubmitStore } from './submit';
import { ViewStore } from './view';

@Injectable({
  providedIn: 'root'
})
export class Store {

  origins = new OriginStore();
  account = new AccountStore(this.origins);
  view = new ViewStore(this.route);
  submit = new SubmitStore(this.route);
  graph = new GraphStore(this.route);
  theme = 'init-theme';

  constructor(
    private route: RouterStore,
  ) {
    makeAutoObservable(this);
  }

  get darkTheme() {
    return this.theme === 'dark-theme';
  }
}
