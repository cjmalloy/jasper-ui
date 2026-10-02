import { makeAutoObservable, observableRef, observableShallow } from 'mobx';
import { Ref } from '../model/ref';

export class OriginStore {

  origins: Ref[] = [];
  list: string[] = [];
  lookup = new Map<string, string>();
  tunnelLookup = new Map<string, string>();
  reverseLookup = new Map<string, string>();
  originMap = new Map<string, Map<string, string>>();

  constructor() {
    makeAutoObservable(this, {
      origins: observableShallow,
      list: observableRef,
      lookup: observableRef,
      tunnelLookup: observableRef,
      reverseLookup: observableRef,
      originMap: observableRef,
    });
  }

}
