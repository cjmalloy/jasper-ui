import { AfterViewInit, Component, Input, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import {
  ControlComponent,
  MapComponent as MglComponent,
  NavigationControlDirective,
  ScaleControlDirective
} from '@maplibre/ngx-maplibre-gl';
import { FeatureCollection } from 'geojson';
import { Map, Marker } from 'maplibre-gl';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { features, mapTemplate } from '../../mods/map';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { memo, MemoCache } from '../../util/memo';
import { LoadingComponent } from '../loading/loading.component';
import { PageControlsComponent } from '../page-controls/page-controls.component';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: { 'class': 'map ext' },
  imports: [
    MglComponent,
    ControlComponent,
    NavigationControlDirective,
    ScaleControlDirective,
    LoadingComponent,
    PageControlsComponent
  ]
})
export class MapComponent implements AfterViewInit, HasChanges {

  @Input()
  tag = '';
  @Input()
  ext?: Ext;
  @Input()
  pageControls = true;
  @Input()
  emptyMessage = 'No results found';

  error: any;

  private _page?: Page<Ref>;
  private map?: Map;

  constructor(
    private store: Store,
    private router: Router,
    private admin: AdminService,
  ) { }

  @memo
  get mapStyle() {
    return {
      ...this.ext?.config.mapStyle || this.admin.getTemplate('map')?.defaults?.mapStyle || mapTemplate.defaults?.mapStyle || {},
      ...this.admin.getTemplate('map')?.config?.mapStyle || {},
    };
  }

  saveChanges() {
    return true;
  }

  ngAfterViewInit(): void {
  }

  ngOnDestroy() {
  }

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    MemoCache.clear(this);
    this._page = value;
    if (this._page) {
      if (this._page.page.number > 0 && this._page.page.number >= this._page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.page.totalPages - 1
          },
          queryParamsHandling: 'merge',
        });
      }
    }
  }

  get geoData(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: this._page?.content.flatMap(features) || [],
    };
  }

  mapLoaded(map: Map) {
    this.map = map;
    this._page?.content.flatMap(features).forEach(f => {
      if (f.type === 'Feature' && f.geometry.type === 'Point' && f.geometry.coordinates.length === 2) {
        new Marker()
          .setLngLat(f.geometry.coordinates as any)
          .addTo(map);
      }
    })
    // map.addSource('page', { type: 'geojson', data: this.geoData });
    // map.addLayer({
    //   id: 'points-layer',
    //   type: 'circle',
    //   source: 'page',
    //   paint: {
    //     'circle-radius': 8,
    //     'circle-color': '#4264fb' // Color of the point
    //   }
    // });
  }
}
