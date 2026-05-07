/**
 * Convert a cache key (e.g. `tag:@origin`, `tag@origin:@default`, `tag@origin:`, `tag:`)
 * to a proper tag with origin format (`tag@origin`).
 * Removes the `:` separator and uses whichever origin comes first.
 */
export function cacheKeyToTag(key: string): string {
  const colonIndex = key.indexOf(':');
  if (colonIndex === -1) return key;
  const beforeColon = key.substring(0, colonIndex);
  const afterColon = key.substring(colonIndex + 1);
  if (beforeColon.includes('@')) return beforeColon;
  return beforeColon + afterColon;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

const memoryStorage = new Map<string, string>();
const fallbackStorage: StorageLike = {
  get length() {
    return memoryStorage.size;
  },
  getItem(key: string) {
    return memoryStorage.get(key) ?? null;
  },
  key(index: number) {
    return Array.from(memoryStorage.keys())[index] ?? null;
  },
  removeItem(key: string) {
    memoryStorage.delete(key);
  },
  setItem(key: string, value: string) {
    memoryStorage.set(key, value);
  }
};

function storage(): StorageLike {
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // Fall back when storage access is blocked, e.g. in private or non-browser contexts.
  }
  return fallbackStorage;
}

export class LocalStore {
  private _extPrefetch?: string[];

  inCall() {
    return storage().getItem('video') === 'true';
  }

  setInCall(value: boolean) {
    storage().setItem('video', value ? 'true' : 'false');
  }

  isRefToggled(url: string, defaultValue = false) {
    const value = storage().getItem(`toggled:${url}`);
    if (value === null) return defaultValue;
    return value === 'true';
  }

  setRefToggled(url: string, value = true) {
    storage().setItem(`toggled:${url}`, ''+value);
  }

  set editorStacked(value: boolean) {
    storage().setItem('editorStacked', ''+value);
  }

  get editorStacked() {
    const result = storage().getItem('editorStacked');
    if (result === null) return this.defaultEditorStacked;
    return result !== 'false';
  }

  get defaultEditorStacked() {
    // Show preview on side for tablets and below for desktop
    return window.screen.width > 948;
  }

  set showFullscreenPreview(value: boolean) {
    storage().setItem('showFullscreenPreview', ''+value);
  }

  get showFullscreenPreview() {
    const result = storage().getItem('showFullscreenPreview');
    if (result === null) return this.defaultShowFullscreenPreview;
    return result !== 'false';
  }

  get defaultShowFullscreenPreview() {
    // Default to fullscreen editor for mobile
    return window.screen.width > 740;
  }

  set showPreview(value: boolean) {
    storage().setItem('showPreview', ''+value);
  }

  get showPreview() {
    return storage().getItem('showPreview') === 'true';
  }

  /**
   * Save loaded ext cache keys for preload.
   * Keys are of the format: `query:@default.origin`.
   */
  loadExt(keys: string[]) {
    this._extPrefetch ||= this.extPrefetch;
    storage().setItem(`loaded:ext`, keys.join(','));
  }

  get extPrefetch() {
    return this._extPrefetch
      || storage().getItem(`loaded:ext`)
        ?.split(',')
        ?.filter(k => !!k && !k.startsWith(':') && !k.startsWith('@'))
      || [];
  }

  /**
   * Save the selected user sub tag for the User-Tag header
   */
  _selectedUserTag?: string;
  set selectedUserTag(value: string) {
    this._selectedUserTag = value
    storage().setItem('selectedUserTag', value);
  }

  get selectedUserTag() {
    if (this._selectedUserTag !== undefined) return this._selectedUserTag;
    return this._selectedUserTag = storage().getItem('selectedUserTag') || '';
  }

  /**
   * Get the last seen count for a specific type (comments, threads, replies) on a URL.
   */
  getLastSeenCount(url: string, type: 'comments' | 'threads' | 'replies'): number {
    const value = storage().getItem(`lastSeen:${type}:${url}`);
    return value ? (parseInt(value, 10) || 0) : 0;
  }

  /**
   * Set the last seen count for a specific type (comments, threads, replies) on a URL.
   * Removes localStorage entries when count becomes 0 to keep localStorage clean (e.g., when comments are deleted).
   */
  setLastSeenCount(url: string, type: 'comments' | 'threads' | 'replies', count: number): void {
    const key = `lastSeen:${type}:${url}`;
    if (count) {
      storage().setItem(key, count.toString());
    } else {
      storage().removeItem(key);
    }
  }

  /**
   * Get all Ref-related localStorage keys.
   * These include toggled: and lastSeen: entries.
   */
  getRefKeys(): { key: string, url: string, type: string, value: string }[] {
    const results: { key: string, url: string, type: string, value: string }[] = [];
    const localStorage = storage();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('toggled:')) {
        results.push({
          key,
          url: key.substring('toggled:'.length),
          type: 'toggled',
          value: localStorage.getItem(key) || ''
        });
      } else if (key.startsWith('lastSeen:')) {
        const rest = key.substring('lastSeen:'.length);
        const colonIndex = rest.indexOf(':');
        if (colonIndex === -1) continue;
        const type = rest.substring(0, colonIndex);
        const url = rest.substring(colonIndex + 1);
        results.push({
          key,
          url,
          type: `lastSeen:${type}`,
          value: localStorage.getItem(key) || ''
        });
      }
    }
    return results;
  }

  /**
   * Get all Ext-related localStorage keys.
   * Cache keys are stored in formats like `tag:@origin` or `tag@origin:`.
   * Convert to proper `tag@origin` format for display and routing.
   */
  getExtKeys(): { key: string, tag: string, value: string }[] {
    const results: { key: string, tag: string, value: string }[] = [];
    const loadedExt = storage().getItem('loaded:ext');
    if (loadedExt) {
      const tags = loadedExt.split(',').filter(k => !!k);
      for (const tag of tags) {
        results.push({
          key: tag,
          tag: cacheKeyToTag(tag),
          value: 'cached'
        });
      }
    }
    return results;
  }

  /**
   * Clear a specific Ref entry from localStorage.
   */
  clearRefEntry(key: string): void {
    storage().removeItem(key);
  }

  /**
   * Clear all Ref entries from localStorage.
   */
  clearAllRefs(): void {
    const keys = this.getRefKeys().map(r => r.key);
    const localStorage = storage();
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }

  /**
   * Clear all Ext entries from localStorage.
   */
  clearAllExts(): void {
    this._extPrefetch = undefined;
    storage().removeItem('loaded:ext');
  }

  /**
   * Remove a specific tag from the loaded:ext list.
   */
  clearExtEntry(tag: string): void {
    const localStorage = storage();
    const loadedExt = localStorage.getItem('loaded:ext');
    if (loadedExt) {
      const tags = loadedExt.split(',').filter(k => !!k && k !== tag);
      if (tags.length > 0) {
        localStorage.setItem('loaded:ext', tags.join(','));
      } else {
        localStorage.removeItem('loaded:ext');
      }
      this._extPrefetch = undefined;
    }
  }

  shownHelpPopup(id: string) {
    return storage().getItem('help:' + id);
  }

  dismissHelpPopup(id: string) {
    storage().setItem('help:' + id, 'true');
  }

  /**
   * Get all help-related localStorage keys.
   */
  getHelpKeys(): { key: string, id: string }[] {
    const results: { key: string, id: string }[] = [];
    const localStorage = storage();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('help:')) {
        results.push({ key, id: key.slice('help:'.length) });
      }
    }
    return results;
  }

  /**
   * Clear a specific help entry from localStorage.
   */
  clearHelpEntry(key: string): void {
    storage().removeItem(key);
  }

  /**
   * Clear all help entries from localStorage.
   */
  clearAllHelp(): void {
    const keys = this.getHelpKeys().map(h => h.key);
    const localStorage = storage();
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }
}
