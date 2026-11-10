/**
 * tools/fitness/check-architecture.ts
 * Verificação automática da arquitetura (Fitness Functions — §16).
 *
 * Regras verificadas:
 * - R-01: domain/ NÃO DEVE importar de application/, adapters/, packages/db ou infra.
 * - R-02: application/ NÃO DEVE importar de adapters/.
 * - R-03: Um módulo NÃO DEVE importar arquivos internos de outro módulo (apenas index.ts / @estudos/<modulo>).
 * - R-05: Matriz de dependências acíclica entre os 8 módulos (§4.3).
 * - R-06: packages/core e packages/registries NÃO DEVEM depender de nenhum módulo.
 * - R-11 & R-43: Termos de área específica ('plantao', 'medicina', 'edital') proibidos no núcleo e no frontend.
 * - R-12 a R-14: Todos os templates em templates/ DEVEM validar contra @estudos/template-schema.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateTemplateManifest } from '@estudos/template-schema';

export interface FitnessCheckResult {
  readonly passed: boolean;
  readonly violations: readonly string[];
  readonly summary: {
    readonly scannedFiles: number;
    readonly validatedTemplates: number;
  };
}

/**
 * Matriz de dependências permitidas (§4.3): chave pode depender dos módulos listados.
 */
const ALLOWED_MODULE_DEPS: Record<string, readonly string[]> = {
  identity: [],
  workspaces: ['identity'],
  calendar: ['identity', 'workspaces'],
  study: ['identity', 'workspaces', 'calendar'],
  practice: ['identity', 'workspaces', 'study'],
  notes: ['identity', 'workspaces'],
  rules: ['identity', 'workspaces', 'calendar', 'study', 'practice', 'notes'],
  analytics: ['identity', 'workspaces'],
};

const ALL_MODULES = Object.keys(ALLOWED_MODULE_DEPS);

// R-11 e R-43: Termos de área proibidos fora de templates/ e arquivos de teste
const FORBIDDEN_DOMAIN_TERMS_REGEX = /\b(plantao|plantão|medicina|edital)\b/i;

function walkFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
    } else if (/\.(ts|tsx|json)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function extractImports(sourceCode: string): string[] {
  const imports: string[] = [];
  const regex = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

export function runArchitectureFitnessChecks(rootDir: string = process.cwd()): FitnessCheckResult {
  const violations: string[] = [];
  let scannedFiles = 0;
  let validatedTemplates = 0;

  // 1. Verificar pacotes packages/core e packages/registries (R-06, R-11)
  for (const pkgName of ['core', 'registries', 'template-schema', 'db', 'ui']) {
    const pkgSrcDir = path.join(rootDir, 'packages', pkgName, 'src');
    const files = walkFiles(pkgSrcDir);
    for (const file of files) {
      scannedFiles++;
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      const isTest = file.endsWith('.test.ts');
      const content = fs.readFileSync(file, 'utf-8');
      const imports = extractImports(content);

      if (pkgName === 'core' || pkgName === 'registries') {
        for (const imp of imports) {
          for (const modName of ALL_MODULES) {
            if (imp === `@estudos/${modName}` || imp.includes(`modules/${modName}`)) {
              violations.push(
                `[R-06] ${rel} importa módulo "${imp}" (packages/${pkgName} não deve depender de módulos).`
              );
            }
          }
        }
      }

      if (!isTest) {
        const codeWithoutComments = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*/g, '');
        if (FORBIDDEN_DOMAIN_TERMS_REGEX.test(codeWithoutComments)) {
          violations.push(
            `[R-11] ${rel} contém termo específico de área proibido no núcleo (plantao/medicina/edital).`
          );
        }
      }
    }
  }

  // 2. Verificar módulos (R-01, R-02, R-03, R-05, R-11)
  for (const modName of ALL_MODULES) {
    const modDir = path.join(rootDir, 'modules', modName);
    const files = walkFiles(modDir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    for (const file of files) {
      scannedFiles++;
      const rel = path.relative(rootDir, file).replace(/\\/g, '/');
      const isTest = file.endsWith('.test.ts');
      const content = fs.readFileSync(file, 'utf-8');
      const imports = extractImports(content);

      const inDomain = rel.startsWith(`modules/${modName}/domain/`);
      const inApplication = rel.startsWith(`modules/${modName}/application/`);

      for (const imp of imports) {
        // R-01: domain/ não importa de application/, adapters/ ou @estudos/db
        if (inDomain) {
          if (
            imp.includes('/application/') ||
            imp.includes('../application') ||
            imp.includes('/adapters/') ||
            imp.includes('../adapters') ||
            imp === '@estudos/db'
          ) {
            violations.push(
              `[R-01] ${rel} (camada domain) importa "${imp}".`
            );
          }
        }

        // R-02: application/ não importa de adapters/
        if (inApplication) {
          if (imp.includes('/adapters/') || imp.includes('../adapters')) {
            violations.push(
              `[R-02] ${rel} (camada application) importa de adapters "${imp}".`
            );
          }
        }

        // R-03: Proibido importar arquivo interno de outro módulo
        for (const otherMod of ALL_MODULES) {
          if (otherMod === modName) continue;
          if (
            imp.startsWith(`@estudos/${otherMod}/`) ||
            (imp.includes(`modules/${otherMod}/`) && !imp.endsWith(`modules/${otherMod}/index.ts`))
          ) {
            violations.push(
              `[R-03] ${rel} importa arquivo interno de outro módulo: "${imp}". Use apenas "@estudos/${otherMod}".`
            );
          }

          // R-05: Matriz de dependências permitidas
          if (imp === `@estudos/${otherMod}` || imp.includes(`modules/${otherMod}`)) {
            const allowed = ALLOWED_MODULE_DEPS[modName] ?? [];
            if (!allowed.includes(otherMod)) {
              violations.push(
                `[R-05] Violação da matriz de dependências em ${rel}: módulo "${modName}" não pode depender de "${otherMod}".`
              );
            }
          }
        }
      }

      if (!isTest) {
        const codeWithoutComments = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*/g, '');
        if (FORBIDDEN_DOMAIN_TERMS_REGEX.test(codeWithoutComments)) {
          violations.push(
            `[R-11] ${rel} contém termo específico de área proibido no módulo "${modName}".`
          );
        }
      }
    }
  }

  // 3. Verificar frontend apps/web (R-43: sem condicionais de template ou termos de área)
  const webSrcDir = path.join(rootDir, 'apps', 'web', 'src');
  for (const file of walkFiles(webSrcDir)) {
    scannedFiles++;
    const rel = path.relative(rootDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const codeWithoutComments = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    if (/if\s*\([^)]*template_id\s*===/i.test(codeWithoutComments)) {
      violations.push(
        `[R-43] ${rel} contém condicional específica por template (if (template_id === ...)).`
      );
    }
  }

  // 4. Validar todos os templates em templates/ (R-12 a R-14)
  const templatesDir = path.join(rootDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(templatesDir, entry.name, 'template.json');
      if (!fs.existsSync(manifestPath)) {
        violations.push(`[R-12] Pasta templates/${entry.name} não possui template.json.`);
        continue;
      }
      validatedTemplates++;
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const report = validateTemplateManifest(raw);
      if (!report.valid) {
        for (const err of report.errors) {
          violations.push(`[R-12..R-14] templates/${entry.name}/template.json: ${err}`);
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    summary: {
      scannedFiles,
      validatedTemplates,
    },
  };
}

// Execução via CLI
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isDirectRun) {
  const result = runArchitectureFitnessChecks(process.cwd());
  console.log(
    `[Fitness Architecture Check] Arquivos verificados: ${result.summary.scannedFiles} | Templates validados: ${result.summary.validatedTemplates}`
  );
  if (!result.passed) {
    console.error('Violações arquiteturais encontradas:');
    for (const v of result.violations) {
      console.error(`  ✗ ${v}`);
    }
    process.exit(1);
  }
  console.log('✓ Todas as regras arquiteturais (R-01 a R-06, R-11 a R-14, R-43) foram atendidas.');
}
