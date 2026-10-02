import { signal } from '@angular/core';
import { Ref } from '../model/ref';

export class OriginStore {

  private readonly _origins = signal<Ref[]>([]);
  private readonly _list = signal<string[]>([]);
  private readonly _lookup = signal(new Map<string, string>());
  private readonly _tunnelLookup = signal(new Map<string, string>());
  private readonly _reverseLookup = signal(new Map<string, string>());
  private readonly _originMap = signal(new Map<string, Map<string, string>>());

  get origins() { return this._origins(); }
  set origins(value: Ref[]) { this._origins.set(value); }

  get list() { return this._list(); }
  set list(value: string[]) { this._list.set(value); }

  get lookup() { return this._lookup(); }
  set lookup(value: Map<string, string>) { this._lookup.set(value); }

  get tunnelLookup() { return this._tunnelLookup(); }
  set tunnelLookup(value: Map<string, string>) { this._tunnelLookup.set(value); }

  get reverseLookup() { return this._reverseLookup(); }
  set reverseLookup(value: Map<string, string>) { this._reverseLookup.set(value); }

  get originMap() { return this._originMap(); }
  set originMap(value: Map<string, Map<string, string>>) { this._originMap.set(value); }

}
