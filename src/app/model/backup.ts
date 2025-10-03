export interface BackupOptions {
  ref?: boolean;
  ext?: boolean;
  user?: boolean;
  plugin?: boolean;
  template?: boolean;
  cache?: boolean;
  newerThan?: string;
  olderThan?: string;
}

export const all: BackupOptions = {
  ref: true,
  ext: true,
  user: true,
  plugin: true,
  template: true,
  cache: true,
}
