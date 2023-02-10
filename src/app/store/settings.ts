import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Plugin } from '../model/plugin';

export class SettingsStore {

  plugins: Plugin[] = [];

  constructor(
    public route: RouterStore,
  ) {
    makeAutoObservable(this);
  }

  get tag(): string {
    return this.route.routeSnapshot?.firstChild?.firstChild?.params['tag'] || '';
  }
}
