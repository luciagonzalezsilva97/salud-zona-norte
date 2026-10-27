import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Permite que la vista previa de Vercel/v0 (*.vercel.run) abra la app
    allowedHosts: ['.vercel.run', '.vercel.app'],
  },
});
