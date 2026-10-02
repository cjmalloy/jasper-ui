import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { GeocodeResult } from './geocode';

export type GeocodeSearch = (query: string, signal: AbortSignal) => Promise<GeocodeResult[]>;

/**
 * MapLibre control with an address search box. Results are overlaid on the
 * map, and choosing one flies the map there.
 */
export class GeocoderControl implements IControl {

  private map?: MapLibreMap;
  private container?: HTMLElement;
  private input?: HTMLInputElement;
  private button?: HTMLButtonElement;
  private results?: HTMLElement;
  private abort?: AbortController;

  constructor(private search: GeocodeSearch) { }

  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map;
    const container = this.container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group geocoder-control';
    // Keep events from reaching the map or any form the map is in
    for (const e of ['mousedown', 'touchstart', 'click', 'dblclick', 'wheel', 'keydown', 'keyup']) {
      container.addEventListener(e, event => event.stopPropagation());
    }

    const form = document.createElement('div');
    form.className = 'geocoder-form';
    const input = this.input = document.createElement('input');
    input.type = 'search';
    input.className = 'geocoder-input';
    input.placeholder = $localize`Search address`;
    input.setAttribute('aria-label', $localize`Search address`);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.run();
      } else if (event.key === 'Escape') {
        this.clear();
      }
    });
    input.addEventListener('input', () => {
      if (!input.value) this.clear();
    });
    const button = this.button = document.createElement('button');
    button.type = 'button';
    button.className = 'geocoder-button';
    button.textContent = '🔎️';
    button.title = $localize`Search address`;
    button.setAttribute('aria-label', $localize`Search address`);
    button.addEventListener('click', () => void this.run());
    form.append(input, button);

    const results = this.results = document.createElement('div');
    results.className = 'geocoder-results';
    results.hidden = true;

    container.append(form, results);
    return container;
  }

  onRemove() {
    this.abort?.abort();
    this.container?.remove();
    this.container = this.input = this.button = this.results = undefined;
    this.map = undefined;
  }

  private async run() {
    this.abort?.abort();
    const query = this.input?.value.trim();
    if (!query) {
      this.clear();
      return;
    }
    const abort = this.abort = new AbortController();
    this.status($localize`Searching…`);
    if (this.button) this.button.disabled = true;
    try {
      const results = await this.search(query, abort.signal);
      if (abort.signal.aborted) return;
      this.show(results);
    } catch (e: any) {
      if (abort.signal.aborted) return;
      console.error('Geocoding error:', e);
      this.status(typeof e === 'string' ? e : $localize`Address search failed.`, true);
    } finally {
      if (this.abort === abort && this.button) this.button.disabled = false;
    }
  }

  private show(results: GeocodeResult[]) {
    if (!this.results) return;
    if (!results.length) {
      this.status($localize`No results found.`);
      return;
    }
    this.results.replaceChildren(...results.map(r => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'geocoder-result';
      el.textContent = r.name;
      el.addEventListener('click', () => this.select(r));
      return el;
    }));
    this.results.hidden = false;
  }

  private status(text: string, error = false) {
    if (!this.results) return;
    const el = document.createElement('div');
    el.className = 'geocoder-status' + (error ? ' error' : '');
    el.textContent = text;
    this.results.replaceChildren(el);
    this.results.hidden = false;
  }

  private select(result: GeocodeResult) {
    this.clear();
    this.map?.flyTo({ center: result.location, zoom: Math.max(this.map.getZoom(), 14) });
  }

  private clear() {
    this.abort?.abort();
    if (this.button) this.button.disabled = false;
    if (!this.results) return;
    this.results.replaceChildren();
    this.results.hidden = true;
  }
}
