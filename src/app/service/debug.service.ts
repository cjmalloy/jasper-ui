import { Injectable } from '@angular/core';
import { from, of } from 'rxjs';
import { signJwt } from '../util/jwt';
import { ConfigService } from './config.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DebugService {
  loading?: Promise<string>;

  constructor(
    private config: ConfigService,
  ) { }

  get init$() {
    if (location.search.includes('debug=')) {
      const debugRole = location.search.match(/debug=([^&]+)/)![1];
      const debugTag = location.search.match(/tag=([^&]+)/)?.[1] || '';
      if (debugRole.toLowerCase() === 'false') return of(null);
      return from(this.getDebugToken(debugTag, 'ROLE_' + debugRole.toUpperCase()).then(jwt => this.config.token = jwt));
    }
    if (environment.dev && !location.search.includes('anon=')) {
      return from(this.getDebugToken('+user/chris', 'ROLE_ADMIN').then(jwt => this.config.token = jwt));
    }
    return of(null)
  }

  private async getDebugToken(tag: string, ...roles: string[]) {
    if (!tag.startsWith('_') && !tag.startsWith('+')) {
      tag = '+user/' + (tag || 'debug');
    }
    if (tag.startsWith('_') && !roles.includes('ROLE_PRIVATE')) {
      roles.push('ROLE_PRIVATE');
    }
    const payload = {
      verified_email: true,
      sub: '+user'.length === tag.length ? tag : tag.substring('+user/'.length),
      auth: roles.join(','),
    };
    const secret = atob('MjY0ZWY2ZTZhYmJhMTkyMmE5MTAxMTg3Zjc2ZDlmZWUwYjk0MDgzODA0MDJiOTgyNTk4MmNjYmQ4Yjg3MmVhYjk0MmE0OGFmNzE2YTQ5ZjliMTEyN2NlMWQ4MjA5OTczYjU2NzAxYTc4YThkMzYxNzdmOTk5MTIxODZhMTkwMDM=');
    const jwt = await signJwt(payload, new TextEncoder().encode(secret));
    console.log('GENERATING DEBUG JWT (DO NOT USE IN PRODUCTION)');
    console.log(payload);
    return jwt;
  }
}
