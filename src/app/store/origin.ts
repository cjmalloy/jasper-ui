import { makeAutoObservable, observable } from 'mobx';
import { Ref } from '../model/ref';

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
