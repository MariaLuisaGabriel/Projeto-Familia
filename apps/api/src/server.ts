/**
 * apps/api/src/server.ts
 * Servidor HTTP/JSON expondo os casos de uso dos módulos (§3).
 */
import http from 'node:http';
import { FieldTypeRegistry, GeneratorRegistry, WidgetRegistry } from '@estudos/registries';
import { createPlatformContainer, loadOfficialTemplates } from './bootstrap.ts';

const PORT = Number(process.env.PORT ?? 3333);
const container = createPlatformContainer();
const templates = loadOfficialTemplates();

// Inicializa um workspace padrão a partir do primeiro template oficial
if (templates.length > 0) {
  const initialTemplate = templates[0];
  const ws = await container.workspaceService.createFromTemplate({
    name: `${initialTemplate.name} — Principal`,
    template: initialTemplate,
  });
  await container.studyService.seedTaxonomy(ws.id, initialTemplate.taxonomy);
  await container.rulesEngine.seedRules(ws.id, initialTemplate.suggestedRules);
  await container.drainWorkspaceOutbox(ws.id);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Workspace-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'ok',
        architecture: 'modular-monolith',
        registries: {
          fieldTypes: FieldTypeRegistry.keys(),
          generators: GeneratorRegistry.keys(),
          widgets: WidgetRegistry.keys(),
        },
      })
    );
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/templates') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ templates }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/workspaces') {
    const list = await container.workspaceRepo.listAll();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ workspaces: list }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Rota não encontrada.' }));
});

server.listen(PORT, () => {
  console.log(`[apps/api] Servidor HTTP/JSON ativo em http://localhost:${PORT}`);
});
