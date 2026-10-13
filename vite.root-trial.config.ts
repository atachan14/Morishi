import {defineConfig} from 'vite';
// Build the isolated trial without changing the running game's Vite configuration.
export default defineConfig({base:'./',build:{outDir:'dist/root-trial',rollupOptions:{input:{rootTrial:'root-trial.html'}}}});