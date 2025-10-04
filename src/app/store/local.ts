import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocalStore {
  private _extPrefetch?: string[];
  private _editorStacked = signal<boolean | null>(null);
  private _showFullscreenPreview = signal<boolean | null>(null);
  private _showPreview = signal<boolean>(false);
  private _selectedUserTag = signal<string>('');

  constructor() {
    // Initialize signals from localStorage
    const editorStackedValue = localStorage.getItem('editorStacked');
    if (editorStackedValue !== null) {
      this._editorStacked.set(editorStackedValue !== 'false');
    }

    const showFullscreenPreviewValue = localStorage.getItem('showFullscreenPreview');
    if (showFullscreenPreviewValue !== null) {
      this._showFullscreenPreview.set(showFullscreenPreviewValue !== 'false');
    }

    this._showPreview.set(localStorage.getItem('showPreview') === 'true');
    this._selectedUserTag.set(localStorage.getItem('selectedUserTag') || '');
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
    this._editorStacked.set(value);
  }

  get editorStacked() {
    const value = this._editorStacked();
    if (value !== null) return value;
    return this.defaultEditorStacked;
  }

  editorStacked$ = computed(() => {
    const value = this._editorStacked();
    if (value !== null) return value;
    return this.defaultEditorStacked;
  });

  get defaultEditorStacked() {
    // Show preview on side for tablets and below for desktop
    return window.screen.width > 948;
  }

  set showFullscreenPreview(value: boolean) {
    localStorage.setItem('showFullscreenPreview', ''+value);
    this._showFullscreenPreview.set(value);
  }

  get showFullscreenPreview() {
    const value = this._showFullscreenPreview();
    if (value !== null) return value;
    return this.defaultShowFullscreenPreview;
  }

  showFullscreenPreview$ = computed(() => {
    const value = this._showFullscreenPreview();
    if (value !== null) return value;
    return this.defaultShowFullscreenPreview;
  });

  get defaultShowFullscreenPreview() {
    // Default to fullscreen editor for mobile
    return window.screen.width > 740;
  }

  set showPreview(value: boolean) {
    localStorage.setItem('showPreview', ''+value);
    this._showPreview.set(value);
  }

  get showPreview() {
    return this._showPreview();
  }

  showPreview$ = computed(() => this._showPreview());

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
  set selectedUserTag(value: string) {
    this._selectedUserTag.set(value);
    localStorage.setItem('selectedUserTag', value);
  }

  get selectedUserTag() {
    return this._selectedUserTag();
  }

  selectedUserTag$ = computed(() => this._selectedUserTag());
}
