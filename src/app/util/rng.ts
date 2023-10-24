import { isString } from 'lodash-es';

export function rng(seed: any): Rng {
  let gen = sfc32(isString(seed) ? parseInt(seed.substring(0, 8), 16) : seed * 1000000);
  const rng = {
    random(): number {
      return gen();
    },
    range(from: number, to: number): number {
      const r = gen();
      return Math.floor(r * to - from + 1) + from;
    },
    cycle(run: number) {
      while (run > 0) {
        run--;
        gen();
      }
    },
    restart() {
      gen = sfc32(parseInt(seed, 16))
    },
    seed(newSeed: string){
      seed = newSeed;
      gen = sfc32(parseInt(newSeed, 16));
    }
  };
  rng.cycle(1000); // Warm up
  return rng;
}

function sfc32(a = 0, b = 0, c = 0, d = 0) {
  return function() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = c << 21 | c >>> 11;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

export interface Rng {
  random(): number;
  range(...range: number[]): number;
  cycle(run: number): void;
  restart(): void;
  seed(...args: any[]): void;
}
