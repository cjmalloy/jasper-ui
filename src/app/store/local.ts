
export class LocalStore {

  isRefToggled(url: string, defaultValue = false) {
    const value = localStorage.getItem('toggled:' + url);
    if (!value) return defaultValue;
    return value === 'true';
  }

  setRefToggled(url: string, value= true) {
    localStorage.setItem('toggled:' + url, ''+value);
  }
}
