
export class LocalStore {

  isRefToggled(url: string, origin: string = '', defaultValue = false) {
    const value = localStorage.getItem(`toggled:${origin}:${url}`);
    if (!value) return defaultValue;
    return value === 'true';
  }

  setRefToggled(url: string, origin = '', value= true) {
    localStorage.setItem(`toggled:${origin}:${url}`, ''+value);
  }

  saveEditing(text: string) {
    // TODO:
  }

  set editorStacked(value: boolean) {
    localStorage.setItem('editorStacked', ''+value);
  }

  get editorStacked() {
    return localStorage.getItem('editorStacked') !== 'false';
  }

  set showFullscreenPreview(value: boolean) {
    localStorage.setItem('showFullscreenPreview', ''+value);
  }

  get showFullscreenPreview() {
    return localStorage.getItem('showFullscreenPreview') !== 'false';
  }

  set showPreview(value: boolean) {
    localStorage.setItem('showPreview', ''+value);
  }

  get showPreview() {
    return localStorage.getItem('showPreview') !== 'false';
  }
}
