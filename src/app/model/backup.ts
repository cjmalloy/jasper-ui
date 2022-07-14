export interface Backup {
  id: string;
  modified: string;
}

export interface BackupOptions {
  ref?: boolean;
  ext?: boolean;
  user?: boolean;
  feed?: boolean;
  origin?: boolean;
  plugin?: boolean;
  template?: boolean;
}

export const all: BackupOptions = {
  ref: true,
  ext: true,
  user: true,
  feed: true,
  origin: true,
  plugin: true,
  template: true,
}
