declare module 'bencode-js' {
  export function encode(data: any, options?: any): Buffer;
  export function decode(buffer: Buffer, options?: any): any;
}
