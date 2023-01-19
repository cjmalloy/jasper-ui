import { Injectable } from '@angular/core';
import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { ConfigService } from '../service/config.service';
import { AccountStore } from './account';
import { GraphStore } from './graph';
import { SubmitStore } from './submit';
import { ViewStore } from './view';

@Injectable({
  providedIn: 'root'
})
export class Store {

  account = new AccountStore(this.config);
  view = new ViewStore(this.route);
  submit = new SubmitStore(this.route);
  graph = new GraphStore(this.route);
  theme = 'init-theme';

  constructor(
    private route: RouterStore,
    private config: ConfigService,
  ) {
    makeAutoObservable(this);
  }

  get darkTheme() {
    return this.theme === 'dark-theme';
  }
}
