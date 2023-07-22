import { makeAutoObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Plugin } from '../model/plugin';

export class SettingsStore {

  plugins: Plugin[] = [];

  constructor(
    public route: RouterStore,
  ) {
    makeAutoObservable(this, {
      plugins: observable.shallow,
    });
  }

  get tag(): string {
    return this.route.routeSnapshot?.firstChild?.firstChild?.params['tag'] || '';
  }
}
