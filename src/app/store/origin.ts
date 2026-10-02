import { signal } from '@angular/core';
import { Ref } from '../model/ref';

export class OriginStore {

  readonly origins = signal<Ref[]>([]);
  readonly list = signal<string[]>([]);
  readonly lookup = signal(new Map<string, string>());
  readonly tunnelLookup = signal(new Map<string, string>());
  readonly reverseLookup = signal(new Map<string, string>());
  readonly originMap = signal(new Map<string, Map<string, string>>());

}
