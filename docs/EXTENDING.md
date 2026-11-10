# Receitas de Extensão (`EXTENDING.md`)

> **Regra R-54:** Toda extensão de um tipo listado em §13.1 DEVE seguir a receita correspondente neste documento.

---

## 1. Criar um novo Template (`templates/<slug>/template.json`)

**Esforço:** Baixo · **Toca código existente?** Não (apenas dados declarativos).

1. Gere o esqueleto inicial via CLI:
   ```bash
   npm run gen -- template meu-objetivo
   ```
2. Edite `templates/meu-objetivo/template.json` definindo:
   - `eventTypes` e `itemTypes` usando chaves existentes em `FieldTypeRegistry` (`text`, `select`, `number`, `duration`, `boolean`, etc.).
   - `taxonomy` com as disciplinas e tópicos iniciais.
   - `generators` referenciando uma chave de `GeneratorRegistry` (`linear`, `weighted`, `cycle`, `until-exam`, `by-performance`).
   - `dashboard` referenciando entradas de `WidgetRegistry`.
3. Valide o template contra o meta-schema e registros (R-12 a R-14):
   ```bash
   npm run check:arch
   ```

---

## 2. Adicionar um novo Tipo de Campo (`FieldTypeRegistry`)

**Esforço:** Baixo · **Regras:** R-20, R-21, R-22, R-23.

1. Em `packages/registries/src/index.ts`, implemente a interface `FieldType<TConfig, TValue>` com:
   - `key` única, estável e imutável (R-20);
   - `validateConfig` e `validateValue` (R-21);
   - `isAnalyzable` e `toIndexExpression` se suportar agregação em gráficos (R-37).
2. Em `apps/web/src/registries/field-type-views.tsx`, registre o `FieldTypeView<TConfig, TValue>` correspondente (`Editor`, `Display`, `Filter`).
3. Adicione testes cobrindo configuração válida/inválida, valor válido/inválido e casos-limite em `packages/registries/src/registries.test.ts` (R-22).

---

## 3. Adicionar um novo Gerador, Gatilho, Condição ou Ação

**Esforço:** Baixo a médio · **Regras:** R-22, R-23, R-24, R-32.

1. Registre a entrada em `GeneratorRegistry`, `TriggerRegistry`, `ConditionRegistry` ou `ActionRegistry` dentro de `packages/registries/src/index.ts`.
2. Certifique-se de que geradores e ações sejam **determinísticos** dado o mesmo estado e parâmetros (R-24).
3. Ações de regra **NÃO DEVEM** excluir dados — apenas criar, reagendar, bloquear e notificar (R-32).
4. Adicione testes unitários em `packages/registries/src/registries.test.ts` (R-22).

---

## 4. Criar um novo Módulo (`modules/<nome>`)

**Esforço:** Médio · **Regras:** R-01 a R-05, R-56.

1. Gere o módulo a partir da estrutura do módulo de referência (`modules/notes` — R-56):
   ```bash
   npm run gen -- module gamificacao
   ```
2. Mantenha a separação estrita:
   - `domain/`: entidades e regras puras (zero imports externos — R-01).
   - `application/`: portas de repositório e casos de uso (zero imports de `adapters/` — R-02).
   - `adapters/`: implementações concretas de repositório e controladores.
   - `index.ts`: única fachada pública importável por outros módulos (R-03).
3. Atualize a matriz de dependências em `tools/fitness/check-architecture.ts` e execute `npm run check:arch`.

---

## 5. Adicionar uma Entidade Nova no Núcleo (§13.3 Checklist)

**Esforço:** Médio a alto · **Regras:** R-10, R-55.

Exige aprovação prévia de ADR em `docs/adr/` e cumprimento integral da checklist:
```bash
npm run gen -- core-entity SessaoEstudo
```
- [ ] ADR aprovado justificando que **todo perfil de estudante** precisa da entidade (R-10)
- [ ] Módulo dono definido e matriz de dependências atualizada
- [ ] Tabela com `id` (UUIDv7), `workspace_id`, `created_at`, `updated_at`, `deleted_at` (R-34, R-39)
- [ ] Repositório com `workspace_id` obrigatório (R-35)
- [ ] Eventos de domínio versionados (R-09)
- [ ] Autorização por papel nos casos de uso (R-48)
- [ ] Inclusão na exportação e importação do workspace (R-41)
- [ ] Suporte no cache offline e fila de mutações (R-46)
- [ ] Testes de isolamento por workspace (R-35)
