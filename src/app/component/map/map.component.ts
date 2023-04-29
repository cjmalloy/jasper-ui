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
import { features } from '../../mods/map';
import { Store } from '../../store/store';
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
  style = {
    version: 8,
    sources: {
      satellite: {
        tileSize: 512,
        type: 'raster',
        url:
          'https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
      }
    },
    layers: [
      {
        id: 'satellite',
        layout: {
          visibility: 'visible'
        },
        minzoom: 0,
        paint: {
          'raster-opacity': 1
        },
        source: 'satellite',
        type: 'raster'
      }
    ]
  };

  private _page?: Page<Ref>;
  private map?: Map;

  constructor(
    private store: Store,
    private router: Router,
  ) { }

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
