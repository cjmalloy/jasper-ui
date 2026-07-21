import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    retry: 2,
    isolate: true,
    execArgv: ['--localstorage-file=/tmp/jasper-ui-test-localstorage.json'],
    server: {
      deps: {
        inline: ['maplibre-gl', '@maplibre/ngx-maplibre-gl'],
      },
    },
  },
});
