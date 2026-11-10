# Plataforma de Estudos (`Projeto-Familia`)

Plataforma modular de estudos orientada a **metadados** e **templates declarativos**, projetada segundo a especificação em [`docs/ARQUITETURA.md`](./docs/ARQUITETURA.md) (`arquitetura_app.pdf`).

O sistema adota um **monolito modular com arquitetura hexagonal** em que o núcleo conhece apenas conceitos universais de estudo, enquanto particularidades de cada área (Residência Médica, Concurso Público, Graduação Universitária) vivem em **templates versionados** sobre catálogos fechados de extensão (`FieldTypeRegistry`, `GeneratorRegistry`, `TriggerRegistry`, `ConditionRegistry`, `ActionRegistry`, `WidgetRegistry`).

---

## Passo a Passo: Como Executar o Projeto

### 1. Pré-requisitos

- **Node.js** `>= 20.0.0` (testado com Node `v24.x`)
- **npm** `>= 10.0.0` (ou **pnpm** via `corepack enable`)

---

### 2. Instalar as Dependências

Na raiz do repositório (`c:\_dev\Projeto-Familia`), instale as dependências de todos os workspaces do monorepo:

```bash
npm install
```

---

### 3. Executar a Aplicação Web (Frontend PWA Minimalista)

Inicie o servidor de desenvolvimento Vite para a interface web (`apps/web`):

```bash
npm run dev
```

- Abra no navegador: **`http://localhost:5173`**
- Na barra superior, alterne entre os workspaces instanciados a partir dos templates oficiais (`Residência Médica`, `Concurso Público`, `Graduação Universitária`) para ver os formulários, campos customizados, cronogramas, regras e widgets mudarem dinamicamente a partir dos metadados.

---

### 4. Executar a API HTTP e o Worker Assíncrono (Opcional)

O monolito modular compartilha os mesmos módulos entre `apps/api` e `apps/worker`:

- **Iniciar o servidor HTTP/JSON (`apps/api` na porta `3333`):**
  ```bash
  npm run dev:api
  ```
  Endpoints disponíveis:
  - `GET http://localhost:3333/api/health` — Status e chaves registradas nos catálogos
  - `GET http://localhost:3333/api/templates` — Lista de manifestos de templates oficiais
  - `GET http://localhost:3333/api/workspaces` — Workspaces ativos

- **Executar o processador da Transactional Outbox e Motor de Regras (`apps/worker`):**
  ```bash
  npm run dev:worker
  ```

---

### 5. Executar Verificações de Arquitetura (Fitness Functions) e Testes

O projeto inclui verificações automáticas de fronteiras hexagonais, matriz de dependências entre módulos, ausência de termos específicos de área no núcleo e validação de todos os templates contra o meta-schema (§16):

1. **Verificar fronteiras e regras da arquitetura (`R-01` a `R-06`, `R-11` a `R-14`, `R-43`):**
   ```bash
   npm run check:arch
   ```

2. **Executar a suíte de testes automatizados (Núcleo, Registros, Meta-Schema, Módulos e Fitness):**
   ```bash
   npm test
   ```

3. **Verificar tipagem TypeScript em todo o monorepo:**
   ```bash
   npm run typecheck
   ```

4. **Gerar build de produção da PWA:**
   ```bash
   npm run build
   ```

---

### 6. Usar a Ferramenta de Scaffolding (`tools/generators`)

Para criar novos templates, módulos hexagonais ou consultar a checklist de novas entidades do núcleo (§14.1):

```bash
# Ver todos os geradores disponíveis
npm run gen

# Criar um novo template declarativo válido em templates/<slug>/template.json
npm run gen -- template residencia-multiprofissional

# Criar um novo módulo hexagonal baseado no módulo de referência (modules/notes)
npm run gen -- module gamificacao

# Exibir a checklist obrigatória (§13.3) para nova entidade no núcleo
npm run gen -- core-entity SessaoEstudo
```

---

## Estrutura do Repositório

```text
Projeto-Familia/
├── apps/
│   ├── web/                 # Frontend PWA minimalista (React + Vite, FieldTypeViewRegistry)
│   ├── api/                 # Servidor HTTP/JSON expondo casos de uso dos módulos
│   └── worker/              # Processamento assíncrono (Transactional Outbox, regras, geradores)
├── modules/                 # 8 módulos com arquitetura hexagonal (domain / application / adapters / index.ts)
│   ├── identity/            # Contas, sessão e papéis no workspace (owner, editor, viewer)
│   ├── workspaces/          # Workspaces, instanciação por cópia versionada, exportação/importação JSON
│   ├── calendar/            # Eventos, recorrência RRULE (RFC 5545), bloqueios de período e .ics
│   ├── study/               # Disciplinas, tópicos, itens de estudo e geradores determinísticos
│   ├── practice/            # Questões, tentativas e repetição espaçada FSRS
│   ├── notes/               # Anotações em Markdown e vínculos (módulo de referência — R-56)
│   ├── rules/               # Motor de regras do usuário (when -> if -> then, depth <= 3)
│   └── analytics/           # Projeções e agregações somente-leitura para widgets
├── packages/
│   ├── core/                # Primitivos do núcleo (UUIDv7, DomainEvent, limites §8.2, papéis)
│   ├── registries/          # Catálogos fechados (FieldType, Generator, Trigger, Condition, Action, Widget)
│   ├── template-schema/     # Meta-schema de templates, validador e diff de versões
│   ├── db/                  # Schema PostgreSQL + JSONB + migrações SQL
│   └── ui/                  # Componentes minimalistas compartilhados (WCAG 2.1 AA, alvos >= 44px)
├── templates/
│   ├── residencia-medica/   # Template declarativo para Residência Médica
│   ├── concurso-publico/    # Template declarativo para Concurso Público
│   └── graduacao/           # Template declarativo para Graduação Universitária
├── tools/
│   ├── fitness/             # Fitness functions de verificação arquitetural em CI
│   └── generators/          # CLI de scaffolding de templates, módulos e registros
└── docs/
    ├── ARQUITETURA.md       # Especificação completa da arquitetura
    ├── EXTENDING.md         # Receitas passo a passo de extensão (R-54)
    └── adr/                 # Architecture Decision Records (ADR-0001 a ADR-0008)
```
