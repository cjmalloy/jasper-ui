import { signal } from '@angular/core';
import { Ref } from '../model/ref';

export interface AccountAlias {
  from?: string;
  origin: string;
  local: string;
  remote: string;
}

export class OriginStore {

  readonly origins = signal<Ref[]>([]);
  readonly list = signal<string[]>([]);
  readonly lookup = signal<ReadonlyMap<string, string>>(new Map());
  readonly tunnelLookup = signal<ReadonlyMap<string, string>>(new Map());
  readonly reverseLookup = signal<ReadonlyMap<string, string>>(new Map());
  readonly originMap = signal<ReadonlyMap<string, ReadonlyMap<string, string>>>(new Map());
  readonly accountAliases = signal<AccountAlias[]>([]);

}
