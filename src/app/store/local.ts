
export class LocalStore {
  private _extPrefetch?: string[];

  inCall() {
    return localStorage.getItem('video') === 'true';
  }

  setInCall(value: boolean) {
    localStorage.setItem('video', value ? 'true' : 'false');
  }

  isRefToggled(url: string, defaultValue = false) {
    const value = localStorage.getItem(`toggled:${url}`);
    if (value === null) return defaultValue;
    return value === 'true';
  }

  setRefToggled(url: string, value= true) {
    localStorage.setItem(`toggled:${url}`, ''+value);
  }

  saveEditing(text: string) {
    // TODO:
  }

  set editorStacked(value: boolean) {
    localStorage.setItem('editorStacked', ''+value);
  }

  get editorStacked() {
    const result = localStorage.getItem('editorStacked');
    if (result === null) return this.defaultEditorStacked;
    return result !== 'false';
  }

  get defaultEditorStacked() {
    // Show preview on side for tablets and below for desktop
    return window.screen.width > 948;
  }

  set showFullscreenPreview(value: boolean) {
    localStorage.setItem('showFullscreenPreview', ''+value);
  }

  get showFullscreenPreview() {
    const result = localStorage.getItem('showFullscreenPreview');
    if (result === null) return this.defaultShowFullscreenPreview;
    return result !== 'false';
  }

  get defaultShowFullscreenPreview() {
    // Default to fullscreen editor for mobile
    return window.screen.width > 740;
  }

  set showPreview(value: boolean) {
    localStorage.setItem('showPreview', ''+value);
  }

  get showPreview() {
    return localStorage.getItem('showPreview') === 'true';
  }

  /**
   * Save loaded ext cache keys for preload.
   * Keys are of the format: `query:@default.origin`.
   */
  loadExt(keys: string[]) {
    this._extPrefetch ||= this.extPrefetch;
    localStorage.setItem(`loaded:ext`, keys.join(','));
  }

  get extPrefetch() {
    return this._extPrefetch
      || localStorage.getItem(`loaded:ext`)
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
    localStorage.setItem('selectedUserTag', value);
  }

  get selectedUserTag() {
    if (this._selectedUserTag !== undefined) return this._selectedUserTag;
    return this._selectedUserTag = localStorage.getItem('selectedUserTag') || '';
  }

  /**
   * Get the last seen count for a specific type (comments, threads, replies) on a URL.
   */
  getLastSeenCount(url: string, type: 'comments' | 'threads' | 'replies'): number {
    const value = localStorage.getItem(`lastSeen:${type}:${url}`);
    return value ? (parseInt(value, 10) || 0) : 0;
  }

  /**
   * Set the last seen count for a specific type (comments, threads, replies) on a URL.
   * Removes localStorage entries when count becomes 0 to keep localStorage clean (e.g., when comments are deleted).
   */
  setLastSeenCount(url: string, type: 'comments' | 'threads' | 'replies', count: number): void {
    const key = `lastSeen:${type}:${url}`;
    if (count) {
      localStorage.setItem(key, count.toString());
    } else {
      localStorage.removeItem(key);
    }
  }

  /**
   * Get all Ref-related localStorage keys.
   * These include toggled: and lastSeen: entries.
   */
  getRefKeys(): { key: string, url: string, type: string, value: string }[] {
    const results: { key: string, url: string, type: string, value: string }[] = [];
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
   */
  getExtKeys(): { key: string, tag: string, value: string }[] {
    const results: { key: string, tag: string, value: string }[] = [];
    const loadedExt = localStorage.getItem('loaded:ext');
    if (loadedExt) {
      const tags = loadedExt.split(',').filter(k => !!k);
      for (const tag of tags) {
        results.push({
          key: 'loaded:ext',
          tag,
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
    localStorage.removeItem(key);
  }

  /**
   * Clear all Ref entries from localStorage.
   */
  clearAllRefs(): void {
    const keys = this.getRefKeys().map(r => r.key);
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }

  /**
   * Clear all Ext entries from localStorage.
   */
  clearAllExts(): void {
    this._extPrefetch = undefined;
    localStorage.removeItem('loaded:ext');
  }

  /**
   * Remove a specific tag from the loaded:ext list.
   */
  clearExtEntry(tag: string): void {
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
    return localStorage.getItem('help:' + id);
  }

  dismissHelpPopup(id: string) {
    localStorage.setItem('help:' + id, 'true');
  }
}
