/**
 * apps/worker/src/worker.ts
 * Entrypoint assíncrono (§3, ADR-0004, ADR-0005):
 * Processa a tabela Transactional Outbox (R-27), avalia o motor de regras (modules/rules)
 * e atualiza projeções analíticas (modules/analytics) de maneira idempotente (R-28).
 */
import { createPlatformContainer, loadOfficialTemplates } from '../../api/src/bootstrap.ts';

async function runWorkerCycle(): Promise<void> {
  const container = createPlatformContainer();
  const templates = loadOfficialTemplates();

  if (templates.length > 0) {
    const tpl = templates[0];
    const ws = await container.workspaceService.createFromTemplate({
      name: `${tpl.name} (Worker Check)`,
      template: tpl,
    });
    await container.rulesEngine.seedRules(ws.id, tpl.suggestedRules);
    const processed = await container.drainWorkspaceOutbox(ws.id);
    console.log(
      `[apps/worker] Outbox processada para workspace "${ws.name}" (${ws.id}): ${processed} evento(s) tratado(s) com sucesso.`
    );
  }
}

runWorkerCycle().catch((err) => {
  console.error('[apps/worker] Erro fatal no worker:', err);
  process.exit(1);
});
