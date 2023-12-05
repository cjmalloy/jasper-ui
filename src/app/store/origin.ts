import { makeObservable, observable } from 'mobx';
import { Ref } from '../model/ref';

export class OriginStore {

  @observable.shallow
  origins: Ref[] = [];
  @observable.ref
  reverseLookup = new Map<string, string>();
  @observable.ref
  originMap = new Map<string, Map<string, string>>();

  constructor() {
    makeObservable(this);
  }

}
