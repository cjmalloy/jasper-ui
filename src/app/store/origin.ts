import { makeAutoObservable, observable } from 'mobx';
import { Ref } from '../model/ref';
import { isReplicating, originPlugin } from '../plugin/origin';
import { ConfigService } from '../service/config.service';
import { AccountStore } from './account';

export class OriginStore {

  origins: Ref[] = [];
  reverseLookup = new Map<string, string>();
  originMap = new Map<string, Map<string, string>>();

  constructor() {
    makeAutoObservable(this, {
      origins: observable.shallow,
      reverseLookup: observable.shallow,
      originMap: observable.shallow,
    });
  }

}
