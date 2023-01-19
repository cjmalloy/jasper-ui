import { makeAutoObservable, observable } from 'mobx';
import { Ref } from '../model/ref';
import { isReplicating, originPlugin } from '../plugin/origin';
import { ConfigService } from '../service/config.service';
import { AccountStore } from './account';

export class OriginStore {

  origins: Ref[] = [];

  constructor(
    private config: ConfigService,
    private account: AccountStore,
  ) {
    makeAutoObservable(this, {
      origins: observable.shallow,
    });
  }

  get reverseLookup(): Map<string, string> {
    return Object.fromEntries(this.origins
      .filter(remote => isReplicating(remote, this.config.api, this.account.origin))
      .map(remote => [remote.origin, remote.plugins!['+plugin/origin'].origin]));
  }

  get originMap() {
    const config = (remote: Ref): typeof originPlugin => remote.plugins!['+plugin/origin'];
    const remotesForOrigin = (origin: string) => this.origins.filter(remote => remote.origin === origin);
    const findLocalAlias = (url: string) => remotesForOrigin(this.account.origin)
      .filter(remote => remote.url === url)
      .map(remote => config(remote).origin)
      .find(() => true) || '';
    const originMapFor = (origin: string) => new Map<string, string>(
      remotesForOrigin(origin)
        .map(remote => [config(remote).origin || '', findLocalAlias(remote.url)]));
    return new Map<string, Map<string, string>>(
      remotesForOrigin(this.account.origin)
        .map(remote => remote.origin || '')
        .map(origin => [origin, originMapFor(origin)]));
  }

}
