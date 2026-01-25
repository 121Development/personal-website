import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'hybrid',
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    }
  }),
  site: 'https://121eliasson.com',
  build: {
    format: 'directory'
  }
});
