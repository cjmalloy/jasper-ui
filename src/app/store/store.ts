import { Injectable } from '@angular/core';
import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { AccountStore } from './account';
import { ViewStore } from './view';

@Injectable({
  providedIn: 'root'
})
export class Store {

  account = new AccountStore();
  view = new ViewStore(this.route);

  constructor(
    private route: RouterStore,
  ) {
    makeAutoObservable(this);
  }
}
