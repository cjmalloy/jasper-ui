import { inject, Injectable, isDevMode } from '@angular/core';
import { from, of } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class DebugService {
  private config = inject(ConfigService);

  loading?: Promise<string>;

  get init$() {
    if (location.search.includes('debug=')) {
      const debugRole = location.search.match(/debug=([^&]+)/)![1];
      const debugTag = location.search.match(/tag=([^&]+)/)?.[1] || '';
      if (debugRole.toLowerCase() === 'false') return of(null);
      return from(this.getDebugToken(debugTag, 'ROLE_' + debugRole.toUpperCase()).then(jwt => this.config.token = jwt));
    }
    if (isDevMode() && !location.search.includes('anon=')) {
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
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };
    const payload = {
      aud: '',
      verified_email: true,
      sub: '+user'.length === tag.length ? tag : tag.substring('+user/'.length),
      auth: roles.join(','),
    };
    const body = btoa(JSON.stringify(header)) + '.' + btoa(JSON.stringify(payload));

    const secret = atob('MjY0ZWY2ZTZhYmJhMTkyMmE5MTAxMTg3Zjc2ZDlmZWUwYjk0MDgzODA0MDJiOTgyNTk4MmNjYmQ4Yjg3MmVhYjk0MmE0OGFmNzE2YTQ5ZjliMTEyN2NlMWQ4MjA5OTczYjU2NzAxYTc4YThkMzYxNzdmOTk5MTIxODZhMTkwMDM=');
    const enc = new TextEncoder();
    const algorithm = { name: 'HMAC', hash: 'SHA-256' };

    const key = await crypto.subtle.importKey('raw', enc.encode(secret), algorithm, false, ['sign', 'verify']);
    const signature = await crypto.subtle.sign(algorithm.name, key, enc.encode(body));
    const digest = btoa(String.fromCharCode(...new Uint8Array(signature)));

    console.log('GENERATING DEBUG JWT (DO NOT USE IN PRODUCTION)');
    console.log(header);
    console.log(payload);
    return (body + '.' + digest).replace(/\+/g, '-').replace(/\//g, '_');
  }
}
