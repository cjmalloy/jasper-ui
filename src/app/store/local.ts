
export class LocalStore {
  private _extPrefetch?: string[];

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
}
