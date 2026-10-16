// @ts-check
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://trendyol-mcp.atanur.dev',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
