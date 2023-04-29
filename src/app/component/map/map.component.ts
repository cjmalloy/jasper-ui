import { AfterViewInit, Component, HostBinding, Input } from '@angular/core';
import { Map } from 'maplibre-gl';
import { catchError, of } from 'rxjs';
import { Ext } from '../../model/ext';
import { ExtService } from '../../service/api/ext.service';
import { Store } from '../../store/store';
import { defaultOrigin } from '../../util/tag';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {
  @HostBinding('class') css = 'map ext';

  ext?: Ext;
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

  constructor(
    private store: Store,
    private exts: ExtService,
  ) { }

  ngAfterViewInit(): void {
    const map = new Map({
      container: 'map',
      style: 'https://demotiles.maplibre.org/style.json', // stylesheet location
      center: [-74.5, 40], // starting position [lng, lat]
      zoom: 9 // starting zoom
    });
  }

  ngOnDestroy() {
  }

  @Input()
  set tag(value: string) {
    if (this.ext?.tag === value) return;
    this.exts.get(defaultOrigin(value, this.store.account.origin)).pipe(
      catchError(err => {
        this.error = err;
        return of(undefined);
      }),
    ).subscribe(ext => this.ext = ext);
  }
}
