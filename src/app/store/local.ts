
export class LocalStore {

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
