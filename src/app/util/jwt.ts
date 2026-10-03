export async function signJwt(payload: any, secret: BufferSource) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  const body = btoa(JSON.stringify(header)) + '.' + btoa(JSON.stringify(payload));
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const key = await crypto.subtle.importKey('raw', secret, algorithm, false, ['sign']);
  const signature = await crypto.subtle.sign(algorithm.name, key, new TextEncoder().encode(body));
  const digest = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return (body + '.' + digest).replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64Bytes(base64: string) {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
