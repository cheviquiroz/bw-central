// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    // Usamos alias para obligar a que todo use la misma instancia de Three.js
    alias: {
      'three': 'three'
    },
    server: {
      deps: {
        // Esto le dice a Vitest v4 que procese estas dependencias de forma estricta
        fallbackCJS: true,
      }
    },
    // 🔽 Esta es la clave para Vitest v4+ 🔽
    deps: {
      optimizer: {
        web: {
          include: [
            '@thatopen/components',
            '@thatopen/components-front',
            'web-ifc',
            'three'
          ]
        }
      }
    }
  }
});