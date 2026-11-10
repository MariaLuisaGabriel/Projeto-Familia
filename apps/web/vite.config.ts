import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@estudos/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@estudos/registries': path.resolve(__dirname, '../../packages/registries/src/index.ts'),
      '@estudos/template-schema': path.resolve(__dirname, '../../packages/template-schema/src/index.ts'),
      '@estudos/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@estudos/ui': path.resolve(__dirname, '../../packages/ui/src/index.tsx'),
      '@estudos/identity': path.resolve(__dirname, '../../modules/identity/index.ts'),
      '@estudos/workspaces': path.resolve(__dirname, '../../modules/workspaces/index.ts'),
      '@estudos/calendar': path.resolve(__dirname, '../../modules/calendar/index.ts'),
      '@estudos/study': path.resolve(__dirname, '../../modules/study/index.ts'),
      '@estudos/practice': path.resolve(__dirname, '../../modules/practice/index.ts'),
      '@estudos/notes': path.resolve(__dirname, '../../modules/notes/index.ts'),
      '@estudos/rules': path.resolve(__dirname, '../../modules/rules/index.ts'),
      '@estudos/analytics': path.resolve(__dirname, '../../modules/analytics/index.ts'),
    },
  },
});
