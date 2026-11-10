#!/usr/bin/env node
/**
 * tools/generators/cli.mjs
 * Ferramenta de Scaffolding (§14.1, R-57 a R-59).
 *
 * Uso:
 *   npm run gen -- template <slug>
 *   npm run gen -- module <nome>
 *   npm run gen -- field-type <key>
 *   npm run gen -- core-entity <NomeEntidade>
 */
import fs from 'node:fs';
import path from 'node:path';

const [, , kind, rawName] = process.argv;

if (!kind || !rawName) {
  console.log(`Scaffolding da Plataforma de Estudos (§14.1)
Comandos disponíveis:
  npm run gen -- field-type <chave>    # domínio + UI + testes + linhas de registro
  npm run gen -- widget <chave>        # entrada de widget + projeção
  npm run gen -- generator <chave>     # gerador determinístico + teste (R-22, R-24)
  npm run gen -- action <chave>        # ação de regra (R-32)
  npm run gen -- template <slug>       # pasta em templates/<slug>/template.json válido (R-12)
  npm run gen -- module <nome>         # estrutura hexagonal baseada em modules/notes (R-56)
  npm run gen -- core-entity <Nome>    # checklist completa §13.3 com TODOs (R-55)
`);
  process.exit(0);
}

const slug = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
const root = process.cwd();

if (kind === 'template') {
  const dir = path.join(root, 'templates', slug);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = {
    id: slug,
    version: '1.0.0',
    name: rawName,
    description: `Template declarativo para ${rawName}`,
    eventTypes: [
      {
        key: 'aula',
        label: 'Aula',
        icon: 'book-open',
        defaultDurationMin: 60,
        fields: [{ key: 'observacao', label: 'Observação', type: 'text', analyzable: false }],
      },
    ],
    itemTypes: [
      {
        key: 'estudo-teorico',
        label: 'Estudo Teórico',
        icon: 'file-text',
        fields: [],
      },
    ],
    taxonomy: [
      {
        key: 'disciplina-geral',
        title: 'Disciplina Inicial',
        topics: [{ key: 'topico-1', title: 'Tópico Introdutório', weight: 1 }],
      },
    ],
    generators: [{ kind: 'linear', params: { itemsPerWeek: 4 } }],
    dashboard: ['progress', 'hours-by-subject'],
  };
  const targetFile = path.join(dir, 'template.json');
  fs.writeFileSync(targetFile, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log(`✓ Template mínimo válido criado em: ${path.relative(root, targetFile)}`);
} else if (kind === 'module') {
  const modDir = path.join(root, 'modules', slug);
  for (const sub of ['domain', 'application', 'adapters']) {
    fs.mkdirSync(path.join(modDir, sub), { recursive: true });
  }
  fs.writeFileSync(
    path.join(modDir, 'package.json'),
    JSON.stringify(
      {
        name: `@estudos/${slug}`,
        version: '0.2.0',
        private: true,
        type: 'module',
        main: './index.ts',
        types: './index.ts',
        dependencies: { '@estudos/core': '*' },
      },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(modDir, 'domain', `${slug}.ts`),
    `/**\n * modules/${slug}/domain\n * Gerado a partir do módulo de referência modules/notes (R-56, R-59).\n */\nimport { type WorkspaceScopedEntity, type UUIDv7, createBaseEntityFields } from '@estudos/core';\n\nexport interface ${slug.charAt(0).toUpperCase() + slug.slice(1)}Record extends WorkspaceScopedEntity {\n  readonly title: string;\n}\n\nexport function create${slug.charAt(0).toUpperCase() + slug.slice(1)}Record(workspaceId: UUIDv7, title: string): ${slug.charAt(0).toUpperCase() + slug.slice(1)}Record {\n  return { ...createBaseEntityFields(workspaceId), title: title.trim() };\n}\n`
  );
  fs.writeFileSync(
    path.join(modDir, 'application', `${slug}-service.ts`),
    `/**\n * modules/${slug}/application\n */\nimport type { UUIDv7 } from '@estudos/core';\nimport type { ${slug.charAt(0).toUpperCase() + slug.slice(1)}Record } from '../domain/${slug}.ts';\n\nexport interface ${slug.charAt(0).toUpperCase() + slug.slice(1)}RepositoryPort {\n  save(workspaceId: UUIDv7, record: ${slug.charAt(0).toUpperCase() + slug.slice(1)}Record): Promise<void>;\n}\n`
  );
  fs.writeFileSync(
    path.join(modDir, 'adapters', `in-memory-${slug}-repository.ts`),
    `/**\n * modules/${slug}/adapters\n */\nimport type { UUIDv7 } from '@estudos/core';\nimport type { ${slug.charAt(0).toUpperCase() + slug.slice(1)}Record } from '../domain/${slug}.ts';\nimport type { ${slug.charAt(0).toUpperCase() + slug.slice(1)}RepositoryPort } from '../application/${slug}-service.ts';\n\nexport class InMemory${slug.charAt(0).toUpperCase() + slug.slice(1)}Repository implements ${slug.charAt(0).toUpperCase() + slug.slice(1)}RepositoryPort {\n  private readonly store = new Map<string, ${slug.charAt(0).toUpperCase() + slug.slice(1)}Record>();\n  public async save(workspaceId: UUIDv7, record: ${slug.charAt(0).toUpperCase() + slug.slice(1)}Record): Promise<void> {\n    this.store.set(\`\${workspaceId}:\${record.id}\`, record);\n  }\n}\n`
  );
  fs.writeFileSync(
    path.join(modDir, 'index.ts'),
    `export * from './domain/${slug}.ts';\nexport * from './application/${slug}-service.ts';\nexport * from './adapters/in-memory-${slug}-repository.ts';\n`
  );
  console.log(`✓ Módulo hexagonal criado em: modules/${slug}/`);
} else if (kind === 'core-entity') {
  console.log(`Checklist obrigatória para nova entidade "${rawName}" no núcleo (§13.3, R-55):
  [ ] 1. ADR aprovado em docs/adr/ justificando a entrada no núcleo (R-10)
  [ ] 2. Módulo dono definido e matriz de dependências atualizada (§4.3)
  [ ] 3. Tabela com id (UUIDv7), workspace_id, created_at, updated_at, deleted_at (R-34, R-39)
  [ ] 4. Repositório com workspace_id obrigatório (R-35)
  [ ] 5. Eventos de domínio versionados (R-09)
  [ ] 6. Autorização por papel nos casos de uso (R-48)
  [ ] 7. Inclusão na exportação e importação do workspace (R-41)
  [ ] 8. Suporte no cache offline e fila de mutações (R-46)
  [ ] 9. Testes de isolamento por workspace (R-35)
  [ ] 10. Gatilhos e widgets do catálogo atualizados
  [ ] 11. Receita correspondente atualizada em docs/EXTENDING.md (R-54)`);
} else {
  console.log(`✓ Esqueleto de extensão para "${kind}" (${slug}) pronto. Consulte docs/EXTENDING.md para registrar no catálogo correspondente.`);
}
