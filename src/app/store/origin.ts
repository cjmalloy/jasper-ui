import { makeAutoObservable, observable } from 'mobx';
import { Ref } from '../model/ref';

export class OriginStore {

  origins: Ref[] = [];
  lookup = new Map<string, string>();
  tunnelLookup = new Map<string, string>();
  reverseLookup = new Map<string, string>();
  originMap = new Map<string, Map<string, string>>();

  constructor() {
    makeAutoObservable(this, {
      origins: observable.shallow,
      lookup: observable.ref,
      tunnelLookup: observable.ref,
      reverseLookup: observable.ref,
      originMap: observable.ref,
    });
  }

}
