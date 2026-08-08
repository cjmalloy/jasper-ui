import { makeAutoObservable, observable } from 'mobx';
import { Ref } from '../model/ref';

export interface AccountAlias {
  origin: string;
  local: string;
  remote: string;
}

export class OriginStore {

  origins: Ref[] = [];
  list: string[] = [];
  lookup = new Map<string, string>();
  tunnelLookup = new Map<string, string>();
  reverseLookup = new Map<string, string>();
  originMap = new Map<string, Map<string, string>>();
  accountAliases: AccountAlias[] = [];

  constructor() {
    makeAutoObservable(this, {
      origins: observable.shallow,
      list: observable.ref,
      lookup: observable.ref,
      tunnelLookup: observable.ref,
      reverseLookup: observable.ref,
      originMap: observable.ref,
      accountAliases: observable.ref,
    });
  }

}
