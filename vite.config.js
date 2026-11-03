import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// During active development we ship a static app without a caching worker.
// GitHub Pages still builds from source; old save data stays in localStorage.
export default defineConfig({
  base:'/Game/',
  plugins:[react()],
  build:{outDir:'dist',emptyOutDir:true}
});
