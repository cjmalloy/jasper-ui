import { Injectable } from '@angular/core';
import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { AccountStore } from './account';
import { GraphStore } from './graph';
import { ViewStore } from './view';

@Injectable({
  providedIn: 'root'
})
export class Store {

  account = new AccountStore();
  view = new ViewStore(this.route);
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
