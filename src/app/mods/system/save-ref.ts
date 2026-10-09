/**
 * Python helpers for delta scripts that update the input Ref in-place.
 * Requires the requests package.
 * save_ref(ref, update) applies update to a copy of ref and sends the difference
 * as a JSON patch using the ref modified date as the cursor. If the patch fails
 * the Ref is reloaded and update is applied again. Return None from update to skip saving.
 */
// language=python
export const pythonSaveRef = `
import copy as _copy
import json as _json
import os as _os
import sys as _sys
import time as _time
import requests as _requests
def fetch_ref(url, origin):
    response = _requests.get(
        f"{_os.environ['JASPER_API']}/api/v1/ref",
        headers={
            'Local-Origin': origin or 'default',
            'User-Role': 'ROLE_ADMIN',
        },
        params={
            'url': url,
            'origin': origin,
        },
        timeout=30,
    )
    if not response.ok:
        raise Exception(f"{response.status_code}: {response.text}")
    return response.json()
def ref_patch(old, new):
    ignore = ('modified', 'metadata')
    path = lambda key: '/' + key.replace('~', '~0').replace('/', '~1')
    return ([{'op': 'add', 'path': path(k), 'value': v} for k, v in new.items() if k not in ignore and (k not in old or old[k] != v)] +
            [{'op': 'remove', 'path': path(k)} for k in old if k not in ignore and k not in new])
def save_ref(ref, update, attempts=5):
    origin = ref.get('origin') or ''
    for attempt in range(attempts):
        if attempt:
            _time.sleep(attempt)
            try:
                ref = fetch_ref(ref['url'], origin)
            except Exception as e:
                print(f"Error reloading Ref: {e}", file=_sys.stderr)
                continue
        updated = update(_copy.deepcopy(ref))
        if updated is None: return ref
        ops = ref_patch(ref, updated)
        if not ops: return ref
        try:
            response = _requests.patch(
                f"{_os.environ['JASPER_API']}/api/v1/ref",
                headers={
                    'Local-Origin': origin or 'default',
                    'User-Role': 'ROLE_ADMIN',
                    'Content-Type': 'application/json-patch+json',
                },
                params={
                    'url': ref['url'],
                    'origin': origin,
                    'cursor': ref.get('modified'),
                },
                data=_json.dumps(ops),
                timeout=30,
            )
            if response.ok:
                updated['modified'] = response.json()
                return updated
            print(f"Error saving Ref {response.status_code}: {response.text}", file=_sys.stderr)
        except Exception as e:
            print(f"Error saving Ref: {e}", file=_sys.stderr)
    print(f"Could not save Ref {origin} {ref['url']}", file=_sys.stderr)
    _sys.exit(1)
`;

/**
 * JavaScript version of {@link pythonSaveRef}.
 * Requires the axios package.
 */
// language=JavaScript
export const javascriptSaveRef = `
const saveRef = async (ref, update, attempts = 5) => {
  const axios = require('axios');
  const api = process.env.JASPER_API + '/api/v1/ref';
  const origin = ref.origin || '';
  const headers = {
    'Local-Origin': origin || 'default',
    'User-Role': 'ROLE_ADMIN',
  };
  const ignore = ['modified', 'metadata'];
  const path = key => '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      try {
        ref = (await axios.get(api, { headers, params: { url: ref.url, origin } })).data;
      } catch (e) {
        console.error('Error reloading Ref', e.response?.data || e.message);
        continue;
      }
    }
    const updated = update(JSON.parse(JSON.stringify(ref)));
    if (!updated) return ref;
    const ops = [
      ...Object.keys(updated)
        .filter(k => !ignore.includes(k) && (!(k in ref) || !same(ref[k], updated[k])))
        .map(k => ({ op: 'add', path: path(k), value: updated[k] })),
      ...Object.keys(ref)
        .filter(k => !ignore.includes(k) && !(k in updated))
        .map(k => ({ op: 'remove', path: path(k) })),
    ];
    if (!ops.length) return ref;
    try {
      updated.modified = (await axios.patch(api, ops, {
        headers: { ...headers, 'Content-Type': 'application/json-patch+json' },
        params: { url: ref.url, origin, cursor: ref.modified },
      })).data;
      return updated;
    } catch (e) {
      console.error('Error saving Ref', e.response?.data || e.message);
    }
  }
  throw new Error('Could not save Ref ' + origin + ' ' + ref.url);
};
`;
