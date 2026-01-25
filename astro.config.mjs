import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://121eliasson.com',
  build: {
    format: 'directory'
  }
});
