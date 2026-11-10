/**
 * tools/resolve-workspaces.mjs
 * Resolvedor ESM nativo do Node.js (node:module) para mapear @estudos/*
 * diretamente para packages/* e modules/* sem precisar de symlinks ou build prévio.
 */
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

const WORKSPACE_MAP = {
  '@estudos/core': path.join(root, 'packages/core/src/index.ts'),
  '@estudos/registries': path.join(root, 'packages/registries/src/index.ts'),
  '@estudos/template-schema': path.join(root, 'packages/template-schema/src/index.ts'),
  '@estudos/db': path.join(root, 'packages/db/src/index.ts'),
  '@estudos/ui': path.join(root, 'packages/ui/src/index.tsx'),
  '@estudos/identity': path.join(root, 'modules/identity/index.ts'),
  '@estudos/workspaces': path.join(root, 'modules/workspaces/index.ts'),
  '@estudos/calendar': path.join(root, 'modules/calendar/index.ts'),
  '@estudos/study': path.join(root, 'modules/study/index.ts'),
  '@estudos/practice': path.join(root, 'modules/practice/index.ts'),
  '@estudos/notes': path.join(root, 'modules/notes/index.ts'),
  '@estudos/rules': path.join(root, 'modules/rules/index.ts'),
  '@estudos/analytics': path.join(root, 'modules/analytics/index.ts'),
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = WORKSPACE_MAP[specifier];
    if (mapped && fs.existsSync(mapped)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(mapped).href,
      };
    }
    return nextResolve(specifier, context);
  },
});
