import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { MapService } from '@maplibre/ngx-maplibre-gl';
import { GeocodeService } from '../../service/geocode.service';
import { GeocodeResult } from '../../util/geocode';

/**
 * Address search shown inside a map with <mgl-control>. Results are overlaid
 * on the map, and choosing one flies the map there.
 */
@Component({
  selector: 'app-geocoder',
  host: {
    'class': 'geocoder-control maplibregl-ctrl-group',
    // Keep events from reaching the map or any form the map is in
    '(mousedown)': '$event.stopPropagation()',
    '(touchstart)': '$event.stopPropagation()',
    '(dblclick)': '$event.stopPropagation()',
    '(wheel)': '$event.stopPropagation()',
    '(keydown)': '$event.stopPropagation()',
  },
  template: `
    <div class="geocoder-form">
      <input type="search"
             class="geocoder-input"
             placeholder="Search address"
             i18n-placeholder
             aria-label="Search address"
             i18n-aria-label
             [value]="query"
             (input)="input($any($event.target).value)"
             (keydown.enter)="$event.preventDefault(); search()"
             (keydown.escape)="clear()">
      <button type="button"
              class="geocoder-button"
              title="Search address"
              i18n-title
              aria-label="Search address"
              i18n-aria-label
              [disabled]="searching"
              (click)="search()">🔎️</button>
    </div>
    @if (searching || searchError || results) {
      <div class="geocoder-results">
        @if (searching) {
          <div class="geocoder-status" i18n>Searching…</div>
        } @else if (searchError) {
          <div class="geocoder-status error">{{ searchError }}</div>
        } @else {
          @for (r of results; track $index) {
            <button type="button"
                    class="geocoder-result"
                    (click)="select(r)">{{ r.name }}</button>
          } @empty {
            <div class="geocoder-status" i18n>No results found.</div>
          }
        }
      </div>
    }
  `,
  styleUrls: ['./geocoder.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeocoderComponent implements OnDestroy {

  query = '';
  searching = false;
  searchError = '';
  results?: GeocodeResult[];

  private abort?: AbortController;

  constructor(
    private mapService: MapService,
    private geocoder: GeocodeService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnDestroy() {
    this.abort?.abort();
  }

  input(value: string) {
    this.query = value;
    if (!value) this.clear();
  }

  async search() {
    this.clear();
    if (!this.query.trim()) return;
    const abort = this.abort = new AbortController();
    this.searching = true;
    this.cd.markForCheck();
    try {
      const results = await this.geocoder.geocode(this.query, abort.signal);
      if (abort.signal.aborted) return;
      this.results = results;
    } catch (e: any) {
      if (abort.signal.aborted) return;
      console.error('Geocoding error:', e);
      this.searchError = typeof e === 'string' ? e : $localize`Address search failed.`;
    }
    this.searching = false;
    this.cd.markForCheck();
  }

  select(result: GeocodeResult) {
    this.clear();
    const map = this.mapService.mapInstance;
    map?.flyTo({ center: result.location, zoom: Math.max(map.getZoom(), 14) });
  }

  clear() {
    this.abort?.abort();
    this.searching = false;
    this.searchError = '';
    this.results = undefined;
    this.cd.markForCheck();
  }
}
