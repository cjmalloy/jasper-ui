import { generateStoryboardKeyframes } from '../mods/thumbnail';

type Storyboard = {
  cols?: unknown;
  rows?: unknown;
  width?: unknown;
  height?: unknown;
};

type StoryboardGrid = {
  cols: number;
  rows: number;
  totalFrames: number;
};

export type StoryboardAnimation = {
  name: string;
  styleId: string;
  keyframes: string;
  value: string;
};

const THUMBNAIL_SIZE = 48;
const MAX_FRAMES = 10_000;

function getGrid(storyboard: Storyboard | null): StoryboardGrid | null {
  if (!storyboard?.cols || !storyboard?.rows) return null;
  const cols = Math.trunc(Number(storyboard.cols));
  const rows = Math.trunc(Number(storyboard.rows));
  const totalFrames = cols * rows;
  if (cols <= 0 || rows <= 0 || totalFrames > MAX_FRAMES) return null;
  return { cols, rows, totalFrames };
}

function getDimensions(storyboard: Storyboard | null) {
  if (!getGrid(storyboard)) return null;
  const width = Number(storyboard?.width);
  const height = Number(storyboard?.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  return { width, height };
}

export function storyboardUrl(url: string | null): string | null {
  if (!url) return null;
  const escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `url("${escapedUrl}")`;
}

export function storyboardSize(storyboard: Storyboard | null): string | null {
  const grid = getGrid(storyboard);
  return grid ? `${grid.cols * 100}% ${grid.rows * 100}%` : null;
}

export function storyboardMargin(storyboard: Storyboard | null): string | null {
  const dimensions = getDimensions(storyboard);
  if (!dimensions) return null;
  const { width, height } = dimensions;
  if (width > height) return `${(THUMBNAIL_SIZE - THUMBNAIL_SIZE * height / width) / 2}px 10px 0 0`;
  const margin = (THUMBNAIL_SIZE - THUMBNAIL_SIZE * width / height) / 2;
  return `0 ${margin + 10}px 0 ${margin}px`;
}

export function storyboardWidth(storyboard: Storyboard | null): string | null {
  const dimensions = getDimensions(storyboard);
  if (!dimensions) return null;
  const { width, height } = dimensions;
  return width > height ? `${THUMBNAIL_SIZE}px` : `${THUMBNAIL_SIZE * width / height}px`;
}

export function storyboardHeight(storyboard: Storyboard | null): string | null {
  const dimensions = getDimensions(storyboard);
  if (!dimensions) return null;
  const { width, height } = dimensions;
  return width > height ? `${THUMBNAIL_SIZE * height / width}px` : `${THUMBNAIL_SIZE}px`;
}

export function storyboardAnimation(storyboard: Storyboard | null): StoryboardAnimation | null {
  const grid = getGrid(storyboard);
  if (!grid || grid.totalFrames < 2) return null;
  const name = `storyboard-slide-${grid.cols}x${grid.rows}`;
  return {
    name,
    styleId: `style-${name}`,
    keyframes: generateStoryboardKeyframes(name, grid.cols, grid.rows),
    value: `${name} ${(grid.totalFrames * 0.4).toFixed(2)}s linear infinite`,
  };
}
