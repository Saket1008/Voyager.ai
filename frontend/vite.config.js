import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
  port: Number(process.env.PORT) || 5173,
  // allow falling back to another port during local dev when 5173 is busy
  strictPort: false
  }
});
