import { computed, makeObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Plugin } from '../model/plugin';

export class SettingsStore {

  @observable.shallow
  plugins: Plugin[] = [];

  constructor(
    public route: RouterStore,
  ) {
    makeObservable(this);
  }

  @computed
  get tag(): string {
    return this.route.routeSnapshot?.firstChild?.firstChild?.params['tag'] || '';
  }
}
