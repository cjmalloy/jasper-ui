import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    retry: 2,
    isolate: true,
    server: {
      deps: {
        inline: ['maplibre-gl', '@maplibre/ngx-maplibre-gl'],
      },
    },
  },
});
