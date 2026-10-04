import { AttributionControl } from 'maplibre-gl';

/**
 * Copy of the attribution MapLibre adds by default.
 */
export const MAPLIBRE_ATTRIBUTION = '<a href="https://maplibre.org/" target="_blank">MapLibre</a>';

/**
 * Compact attribution that starts collapsed to the ⓘ button, for small maps.
 * MapLibre opens the compact attribution whenever it first becomes compact,
 * such as when a slow source loads its attribution. Clicking ⓘ still shows the
 * full attribution from the style sources.
 */
export class CollapsedAttributionControl extends AttributionControl {
  constructor() {
    super({ compact: true, customAttribution: MAPLIBRE_ATTRIBUTION });
    const updateCompact = this._updateCompact;
    this._updateCompact = () => {
      const compact = this._container.classList.contains('maplibregl-compact');
      updateCompact();
      if (!compact) this._container.classList.remove('maplibregl-compact-show');
    };
  }
}
