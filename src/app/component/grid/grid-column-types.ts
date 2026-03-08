export const GRID_CUSTOM_COLUMN_TYPES = ['url', 'tag', 'tags', 'sources', 'image', 'lens', 'markdown', 'embed'] as const;
export const GRID_AUTO_HEIGHT_COLUMN_TYPES = ['tags', 'sources', 'image', 'lens', 'markdown', 'embed'] as const;

export type GridCustomColumnType = (typeof GRID_CUSTOM_COLUMN_TYPES)[number];
