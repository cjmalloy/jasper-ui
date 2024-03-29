export type Point = { x: number, y: number };
export type Rect = { x1: number, y1: number, x2: number, y2: number };

export namespace Rect {
  export function contains(r?: Rect, p?: Point) {
    if (!r || !p) return false;
    return (
      p.x >= Math.min(r.x1, r.x2) && p.x <= Math.max(r.x1, r.x2) &&
      p.y >= Math.min(r.y1, r.y2) && p.y <= Math.max(r.y1, r.y2)
    );
  }
}

export function relativeX(x: number, el?: any): number {
  if (!el) return x + scrollX;
  return relativeX(x - el.offsetLeft, el.offsetParent!);
}

export function relativeY(y: number, el?: any): number {
  if (!el) return y + scrollY;
  return relativeY(y - el.offsetTop, el.offsetParent!);
}
