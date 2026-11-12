# Arquitetura da Plataforma de Estudos

> **Status:** rascunho v0.3 · **Escopo:** estágio inicial (MVP até templates compartilháveis)
>
> Este documento define **como** o sistema é organizado, **quais regras** todo código deve seguir e **quais limites** a customização tem. Mudanças nele exigem um ADR (ver [§15](#15-processo-de-mudança)).
>
> **Como ler:** para uma visão rápida, leia §1 a §3, §8 e §17. As demais seções são referência para quando a implementação chegar naquela parte. As mudanças em relação à v0.2 estão resumidas no [Apêndice A](#apêndice-a--mudanças-da-v02-para-a-v03).

As palavras **DEVE**, **NÃO DEVE**, **DEVERIA** e **PODE** seguem o sentido da RFC 2119: *DEVE* é obrigatório e verificado em CI sempre que possível; *DEVERIA* é o padrão, com exceções justificadas em ADR.

A numeração das regras (R-xx) e dos limites (L-xx) é estável: regras alteradas mantêm o número, regras novas recebem números novos e regras removidas não têm o número reaproveitado.

---

## Sumário

1. [Propósito e visão](#1-propósito-e-visão)
2. [Princípios](#2-princípios)
3. [Visão geral da arquitetura](#3-visão-geral-da-arquitetura)
4. [Módulos e fronteiras](#4-módulos-e-fronteiras)
5. [Núcleo de domínio](#5-núcleo-de-domínio)
6. [Metadados e templates de área](#6-metadados-e-templates-de-área)
7. [Registros (pontos de extensão)](#7-registros-pontos-de-extensão)
8. [Camadas de customização e limites](#8-camadas-de-customização-e-limites)
9. [Motor de regras](#9-motor-de-regras)
10. [Dados e persistência](#10-dados-e-persistência)
11. [Interface, PWA e offline](#11-interface-pwa-e-offline)
12. [Segurança e privacidade](#12-segurança-e-privacidade)
13. [Extensibilidade](#13-extensibilidade)
14. [Ferramentas de desenvolvimento](#14-ferramentas-de-desenvolvimento)
15. [Processo de mudança](#15-processo-de-mudança)
16. [Verificação automática (fitness functions)](#16-verificação-automática-fitness-functions)
17. [Implementação por fases](#17-implementação-por-fases)
18. [Fora de escopo](#18-fora-de-escopo)
19. [Glossário](#19-glossário)
- [Apêndice A — Mudanças da v0.2 para a v0.3](#apêndice-a--mudanças-da-v02-para-a-v03)

---

## 1. Propósito e visão

A plataforma ajuda pessoas a organizar a vida de estudos: compromissos de aula, revisões, prática de questões, anotações e metas. O diferencial é se adaptar à área de cada pessoa por meio de **templates de área**: um estudante de medicina marca plantões, um concurseiro marca simulados e acompanha o edital, um estudante de biologia marca saídas de campo.

A origem do projeto é o cronograma de estudos para a residência SES-DF (HTML único com `localStorage`). Nele, "plantão" e "revisão" estão fixos no código. **A tese desta arquitetura é que esses conceitos viram dados**, definidos por templates, sobre um núcleo genérico.

**Contexto da equipe:** 2 desenvolvedores, com clientes reais desde o primeiro deploy. Por isso a arquitetura prioriza poucas peças, uma só linguagem e ferramentas que entregam pronto o que não diferencia o produto (contas, permissões, migrações, administração).

---

## 2. Princípios

**P1 — Núcleo pequeno, metadados ricos.** O núcleo conhece apenas conceitos que servem a qualquer estudante. Tudo que é específico de uma área vive em templates.

**P2 — Customização por combinação, nunca por programação.** Usuários combinam peças de catálogos fechados (tipos de campo, geradores, gatilhos, ações, widgets). Usuários não escrevem código.

**P3 — Aberto para extensão, fechado para modificação.** Adicionar um tipo de campo, gerador ou ação é criar uma implementação e registrá-la. Nenhum outro arquivo do sistema deveria precisar mudar.

**P4 — Fronteiras explícitas e verificadas.** Módulos só se comunicam por interface pública ou evento de domínio. Violações quebram o build.

**P5 — Os dados do usuário são dele.** Nenhuma atualização de template sobrescreve customizações. Nada é apagado sem ação explícita. Tudo é exportável.

**P6 — Simplicidade operacional.** Um deploy, um banco, nenhuma infraestrutura extra até que uma métrica real justifique.

**P7 — Uma linguagem.** O sistema é escrito em Python. JavaScript só existe onde o navegador o exige (ver R-60).

---

## 3. Visão geral da arquitetura

**Estilo:** monolito modular em Django, com "hexagonal leve" dentro de cada módulo (domínio puro onde há lógica real, serviços com os casos de uso, models do Django como persistência), orientado a metadados e com pontos de extensão baseados em registros. A interface é renderizada no servidor, com HTMX para atualizações parciais.

```
┌──────────────────────────────────────────────────────────────┐
│  Navegador (PWA instalável)                                  │
│  HTML renderizado no servidor + HTMX + service worker        │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTP (páginas e fragmentos HTML)
┌───────────────▼──────────────────────────────────────────────┐
│  Django (ASGI)  ── views → services → domain ──┐             │
│  worker*        ── Procrastinate: outbox,      │ mesmo código│
│                    regras, geradores, avisos ──┤ entrypoints │
│                                                │ diferentes  │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ │             │
│  │identity │ │workspaces│ │ agenda │ │ study │…┘             │
│  └─────────┘ └──────────┘ └────────┘ └───────┘               │
│      core · registries · template_schema · ui                │
└───────────────┬──────────────────────────────────────────────┘
                │
        ┌───────▼────────┐
        │  PostgreSQL    │  tabelas dos módulos + JSONField + outbox* + fila*
        └────────────────┘
                                   * a partir da Fase 2 (ver §17)
```

### Decisões de base

ADRs aceitos não são reescritos: quando uma decisão muda, o ADR antigo recebe o status *Substituído por ADR-NNNN* e a nova decisão ganha um ADR com número novo. Assim o histórico do motivo de cada troca fica preservado.

| Decisão | Escolha | ADR |
|---|---|---|
| Estilo | Monolito modular (apps Django) | ADR-0001 |
| Organização interna dos módulos | Hexagonal leve (§4.2) | ADR-0012 (complementa ADR-0001) |
| Linguagem | Python 3.14+ em todo o sistema | ADR-0009 (substitui ADR-0002) |
| Banco | PostgreSQL, campos customizados em `JSONField` | ADR-0003 |
| Interface | Templates Django + HTMX, renderização no servidor | ADR-0010 |
| Comunicação interna assíncrona | Eventos de domínio + Transactional Outbox (Fase 2) | ADR-0004 |
| Fila de jobs | Procrastinate sobre o próprio Postgres (Fase 2) | ADR-0011 (substitui ADR-0005) |
| Instanciação de template | Cópia versionada (não referência viva) | ADR-0006 |
| Repetição espaçada | FSRS (biblioteca `fsrs`) | ADR-0007 |
| Recorrência de eventos | RRULE (RFC 5545) + exceções, via `dateutil.rrule` | ADR-0008 |

### Stack

| Camada | Ferramenta |
|---|---|
| Web e telas | Django 5, templates Django, HTMX |
| Contas | `django.contrib.auth` com model de usuário próprio + `django-allauth` (login por e-mail, verificação, recuperação de senha) |
| Validação | Pydantic v2 e `jsonschema` |
| Banco e migrações | PostgreSQL, migrações do Django |
| Fila e worker | Procrastinate (a partir da Fase 2) |
| Domínio | `fsrs`, `python-dateutil` |
| Markdown | `markdown-it-py` + sanitização com `nh3` |
| Pacotes e ambiente | uv |
| Qualidade | ruff, pyright (com `django-types`), pytest, pytest-django, Hypothesis, import-linter |
| Acessibilidade e e2e | Playwright para Python + axe-core |
| Scaffolding | Copier (a partir da Fase 3) |
| API JSON (futuro) | Django Ninja, apenas quando houver cliente nativo |

### Estrutura do repositório

```
estudos/
├── README.md                    # o que é, como rodar em 5 minutos
├── CONTRIBUTING.md              # fluxo de branch, PR, revisão, commits
├── pyproject.toml               # dependências + ruff, pyright, pytest, import-linter
├── uv.lock
├── .env.example
├── docker-compose.yml           # Postgres local
├── Makefile                     # make dev, make test, make lint, make check
├── .github/
│   ├── workflows/ci.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│
├── src/estudos/
│   ├── config/                  # settings/{base,dev,prod}.py, urls.py, asgi.py
│   ├── core/                    # Python puro: ids (UUIDv7), erros, tipos base
│   ├── registries/              # catálogos fechados
│   │   ├── field_types/         # text.py, select.py, date.py... (validador + HTML)
│   │   ├── generators/          # linear.py, weighted.py...
│   │   ├── triggers/            # (Fase 4)
│   │   ├── conditions/          # (Fase 4)
│   │   ├── actions/             # (Fase 4)
│   │   └── widgets/
│   ├── template_schema/         # meta_schema.json + validação de templates
│   ├── modules/
│   │   ├── identity/
│   │   ├── workspaces/          # inclui templates, instanciação, membros e papéis
│   │   ├── agenda/
│   │   └── study/
│   │   # practice/, notes/, rules/, analytics/: criados quando a fase deles começar (§17)
│   ├── worker/                  # entrypoint do Procrastinate (Fase 2)
│   └── ui/                      # layout base, componentes, CSS, sw.js, ícones
│       ├── templates/ui/
│       └── static/ui/
│
├── area_templates/              # templates de área (dados, não código)
│   ├── residencia-medica/
│   │   ├── template.json
│   │   └── fixtures/
│   │       ├── prototipo.html          # protótipo original, intocado (fonte da verdade da paridade)
│   │       ├── cronograma.json         # exportado do protótipo
│   │       └── semanas-esperadas.json  # saída esperada do gerador linear
│   ├── concurso-publico/
│   └── graduacao/
│
├── tests/                       # testes que atravessam módulos
│   ├── architecture/            # fronteiras e termos proibidos
│   ├── contracts/               # todo template valida e instancia
│   ├── parity/                  # paridade com o protótipo original
│   └── e2e/                     # Playwright + axe
│
├── tools/
│   ├── scripts/                 # importação, seed, manutenção
│   └── scaffolding/             # modelos Copier (a partir da Fase 3)
│
├── docs/
│   ├── ARQUITETURA.md
│   ├── EXTENDING.md             # receitas de extensão
│   ├── GLOSSARIO.md
│   ├── adr/                     # 0000-modelo.md, 0001-monolito-modular.md...
│   ├── produto/                 # visão, clientes, requisitos, roadmap
│   ├── guias/                   # setup-local.md, deploy.md, backup.md, release.md
│   ├── diagramas/               # fontes em Mermaid (.mmd), versionadas
│   └── assets/                  # imagens usadas dentro dos documentos
│
└── assets/                      # material-fonte, fora do app
    ├── brand/                   # logo, paleta, fontes
    ├── icons-source/            # SVGs originais antes de exportar
    └── screenshots/
```

**Convenções de nomes:**

- Templates de área ficam em `area_templates/`, porque no Django `templates/` significa HTML.
- O módulo de calendário se chama `agenda`, para não ser confundido com o módulo `calendar` da biblioteca padrão.
- `assets/` na raiz guarda material-fonte (logo em alta, SVGs editáveis, prints para clientes). `ui/static/` guarda só o que o app serve, já exportado. Imagens de documentação ficam em `docs/assets/`.
- **Língua:** código (identificadores, models, tabelas, chaves de registro) em inglês; interface, documentação, ADRs e mensagens de commit em português. Nomes de módulo já definidos (`agenda`) são mantidos. O glossário (§19 e `docs/GLOSSARIO.md`) faz a ponte entre o termo de domínio e o nome no código. Demais convenções de código ficam em `CONTRIBUTING.md`.
- Pastas de módulos, registros e ferramentas de fases futuras **não** são criadas vazias antecipadamente. Pasta vazia com contrato de fronteira é custo sem benefício; cada uma nasce no primeiro PR que a usa.

---

## 4. Módulos e fronteiras

### 4.1 Responsabilidades

| Módulo | Responsável por | Não é responsável por |
|---|---|---|
| `identity` | Contas (model de usuário próprio), autenticação, sessão, verificação de e-mail, exclusão de conta | Preferências de estudo, papéis no workspace |
| `workspaces` | Workspaces, membros e papéis (`owner`, `editor`, `viewer`), templates, versões, instanciação, metadados (tipos, campos, widgets), model abstrato de dados de usuário (R-34) | Os dados que os tipos descrevem |
| `agenda` | Eventos, recorrência, bloqueios de período, exportação `.ics` | Decidir quando estudar |
| `study` | Disciplinas, tópicos, itens de estudo (revisões, leituras), geradores de cronograma | Questões e tentativas |
| `practice` | Questões, tentativas, cartões e agendamento FSRS | Estatísticas agregadas |
| `notes` | Anotações em Markdown e vínculos com outras entidades | Conteúdo de questões |
| `rules` | Avaliação e execução de regras do usuário | Lógica de negócio dos outros módulos |
| `analytics` | Projeções e agregações para widgets e relatórios | Escrita em dados de outros módulos |

Os papéis no workspace ficam em `workspaces`, e não em `identity`, porque a relação de membro precisa referenciar o workspace e `identity` não pode depender de nenhum módulo (matriz da §4.3).

### 4.2 Estrutura interna de cada módulo

Cada módulo é um app Django com a mesma forma:

```
modules/<nome>/
├── __init__.py      # vazio (ver nota abaixo)
├── api.py           # interface pública: a única coisa importável de fora
├── apps.py
├── domain/          # Python puro: entidades, objetos de valor, regras, eventos
├── services/        # casos de uso (criar item, concluir revisão...)
├── models.py        # persistência Django
├── migrations/
├── views.py         # páginas e fragmentos HTMX
├── urls.py
├── templates/<nome>/
├── events.py        # eventos de domínio versionados
└── tests/
```

**Por que `api.py` e não `__init__.py`:** o Django importa o `__init__.py` de cada app durante o carregamento do registro de apps, antes de os models estarem prontos. Se o `__init__.py` reexportar serviços ou models, o projeto quebra com `AppRegistryNotReady`. Por isso o `__init__.py` fica vazio e a interface pública vive em `api.py`, que reexporta funções de serviço, DTOs e eventos, nunca models.

"Hexagonal leve" significa: `domain/` é isolado e testável sem banco, e existe onde há lógica que merece isso (geradores, FSRS, motor de regras, validação de templates). Módulos sem lógica relevante PODEM ter `domain/` vazio ou ausente. `services/` usa os models do Django diretamente; não há repositórios abstratos por padrão.

### 4.3 Regras de dependência

- **R-01** `domain/` e `core/` **NÃO DEVEM** importar `django`, `procrastinate`, `models`, `services` ou `views`.
- **R-02** `services/` **NÃO DEVE** importar `views`, `urls` ou templates. Views chamam serviços; serviços nunca conhecem HTTP.
- **R-03** Um módulo **NÃO DEVE** importar arquivos internos de outro módulo. Apenas o `api.py` público.
- **R-04** Um módulo **NÃO DEVE** ler ou escrever tabelas pertencentes a outro módulo. Cada tabela tem exatamente um módulo dono. `ForeignKey` para model de outro módulo só é permitida quando a matriz abaixo permite a dependência, e é declarada por referência textual (`"workspaces.Workspace"`, `settings.AUTH_USER_MODEL`), sem importar o model. O acesso aos dados continua passando pela interface pública: atravessar a relação (`item.workspace.members...`) dentro de serviços conta como leitura de tabela alheia.
- **R-05** O grafo de dependências entre módulos **DEVE** ser acíclico e seguir a matriz abaixo.
- **R-06** `core`, `registries` e `template_schema` **NÃO DEVEM** depender de nenhum módulo.

Matriz de dependências permitidas (linha pode depender de coluna):

| | identity | workspaces | agenda | study | practice | notes | rules | analytics |
|---|---|---|---|---|---|---|---|---|
| **identity** | — | | | | | | | |
| **workspaces** | ✓ | — | | | | | | |
| **agenda** | ✓ | ✓ | — | | | | | |
| **study** | ✓ | ✓ | ✓ | — | | | | |
| **practice** | ✓ | ✓ | | ✓ | — | | | |
| **notes** | ✓ | ✓ | | | | — | | |
| **rules** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | |
| **analytics** | ✓ | ✓ | | | | | | — |

Observações: `analytics` consome apenas **eventos de domínio** dos demais módulos, nunca suas interfaces de escrita. Nenhum módulo depende de `rules` ou de `analytics`; eles reagem por eventos. `notes` referencia outras entidades apenas por `(tipo, id)`, sem chamar seus módulos. `ui` é compartilhado e PODE ser usado por qualquer módulo, mas não importa nenhum.

### 4.4 Comunicação entre módulos

- **R-07** Chamadas síncronas entre módulos **DEVEM** passar pela interface pública e acontecer dentro do mesmo processo.
- **R-08** Efeitos colaterais em outro módulo (ex.: uma tentativa errada gerar revisão) **DEVEM** acontecer por evento de domínio, não por chamada direta do módulo de origem. Django signals **NÃO DEVEM** ser usados para isso, porque não passam pela outbox.
- **R-09** Eventos de domínio **DEVEM** ser imutáveis, versionados (`AttemptRegistered.v1`) e carregar `workspace_id`, `occurred_at`, `causation_id` e `correlation_id`. Em código, são `dataclass(frozen=True)` ou modelos Pydantic congelados.

Até a Fase 2 não há outbox nem worker. Enquanto isso, um efeito em outro módulo que precise acontecer na Fase 0 ou 1 é feito por chamada síncrona à interface pública dentro da mesma transação, e registrado como dívida a migrar para evento quando a outbox existir.

---

## 5. Núcleo de domínio

O núcleo é o conjunto fixo de entidades. **Todo** recurso do produto precisa ser expresso com elas.

| Entidade | Descrição | Customizável por template |
|---|---|---|
| `Workspace` | Unidade de organização ("Residência SES-DF 2027"). Dono dos demais dados | Nome, configurações, módulos ativos |
| `EventType` | Tipo de compromisso (Aula, Plantão, Simulado, Saída de campo) | Totalmente |
| `Event` | Ocorrência na agenda, com início, fim, recorrência e campos customizados | Campos, via `EventType` |
| `Subject` / `Topic` | Árvore de conteúdo (disciplina → tópico) | Estrutura e campos |
| `ItemType` | Tipo de item de estudo (Revisão, Leitura, Lista de exercícios) | Totalmente |
| `StudyItem` | Unidade de trabalho com status e data prevista | Campos, via `ItemType` |
| `Question` / `Attempt` | Questão e cada resposta dada a ela | Campos da questão |
| `Card` / `ReviewLog` | Cartão de repetição espaçada e seu histórico | Não |
| `Note` | Anotação em Markdown com vínculos | Não |
| `Goal` | Meta mensurável (horas, questões, itens concluídos) | Métrica e período |

- **R-10** Uma nova entidade no núcleo **SÓ PODE** ser criada se for necessária a **todos** os perfis de estudante (ver régua em [§15.2](#152-onde-um-requisito-novo-entra)) e exige ADR.
- **R-11** O núcleo **NÃO DEVE** conter nomes, enums ou condicionais de áreas específicas (`'plantao'`, `'medicina'`, `'edital'`). Esses termos só podem existir em `area_templates/` e em `docs/`.

---

## 6. Metadados e templates de área

### 6.1 O que é um template de área

Um template de área é um pacote **declarativo** e **versionado** (SemVer) contendo:

- tipos de evento e de item, com seus campos;
- taxonomia inicial (disciplinas e tópicos);
- configuração de geradores de cronograma;
- regras sugeridas (desativadas por padrão);
- composição do painel (widgets);
- rótulos e ícones.

Exemplo resumido (`area_templates/residencia-medica/template.json`):

```json
{
  "id": "residencia-medica",
  "version": "1.0.0",
  "name": "Residência Médica",
  "eventTypes": [
    {
      "key": "plantao",
      "label": "Plantão",
      "icon": "hospital",
      "defaultDurationMin": 720,
      "fields": [
        { "key": "local", "type": "select", "options": ["HRC", "HRAN", "HBDF"] },
        { "key": "turno", "type": "select", "options": ["diurno", "noturno", "24h"] }
      ]
    }
  ],
  "generators": [{ "kind": "linear", "params": { "itemsPerWeek": 4 } }],
  "dashboard": ["progress", "events-of-type:plantao", "upcoming:aula"]
}
```

Em código, o formato é descrito por modelos Pydantic em `template_schema/`, e o `meta_schema.json` é gerado a partir deles. O JSON Schema publicado serve para validar templates fora do Python (editores, revisão de PR).

### 6.2 Regras de templates

- **R-12** Todo template **DEVE** validar contra o meta-schema em `template_schema/` antes de ser publicado ou instanciado.
- **R-13** Um template **NÃO DEVE** conter código executável, expressões avaliáveis, HTML ou CSS. Apenas dados que referenciam entradas de registros.
- **R-14** Toda referência em um template (`"type": "select"`, `"kind": "linear"`) **DEVE** apontar para uma entrada existente no registro correspondente. Referência desconhecida invalida o template.
- **R-15** Instanciar um template **DEVE** copiar seus metadados para o workspace e gravar `template_id` + `template_version` de origem. O workspace nunca lê o template ao vivo.
- **R-16** Uma nova versão de template **NÃO DEVE** ser aplicada automaticamente. A atualização é oferecida ao usuário como diff, aceito campo a campo.
- **R-17** Remover um tipo ou campo que já possui dados **DEVE** arquivá-lo (soft delete). Os valores existentes são preservados e continuam exportáveis.
- **R-18** Templates compartilhados entre usuários **NÃO DEVEM** levar dados do workspace de origem (eventos, tentativas, notas). Apenas metadados e taxonomia.
- **R-19** Mudanças incompatíveis no meta-schema **DEVEM** vir com migração automática dos workspaces existentes.

---

## 7. Registros (pontos de extensão)

Registros são catálogos fechados de implementações. São o **único** lugar onde o comportamento de algo customizável é definido.

| Registro | Exemplos de entradas iniciais |
|---|---|
| `FieldTypeRegistry` | `text`, `long-text`, `number`, `select`, `multi-select`, `date`, `boolean`, `duration`, `checklist`, `attachment`, `ref-topic`, `ref-event` |
| `GeneratorRegistry` | `linear`, `weighted`, `cycle`, `until-exam`, `by-performance` |
| `TriggerRegistry` | `event.created`, `event.finished`, `item.completed`, `attempt.registered`, `date.approaching` |
| `ConditionRegistry` | `field-equals`, `field-in`, `rate-below`, `count-above`, `type-is` |
| `ActionRegistry` | `create-item`, `block-period`, `notify`, `reschedule`, `run-generator` |
| `WidgetRegistry` | `progress`, `hours-by-subject`, `events-of-type`, `countdown`, `accuracy-by-topic` |

A tabela mostra o catálogo-alvo. Cada entrada é implementada quando a fase que a usa começa; na Fase 0 existem apenas os tipos de campo `text`, `number`, `select`, `date` e `boolean`, o gerador `linear` e os widgets do painel inicial.

### 7.1 Contrato de um tipo de campo

Domínio e interface ficam na mesma entrada de registro, porque a interface é renderizada no servidor.

```python
from typing import Any, ClassVar, Generic, Protocol, TypeVar
from pydantic import BaseModel

C = TypeVar("C", bound=BaseModel)   # configuração do campo (ex.: opções de um select)
V = TypeVar("V")                    # valor salvo


class FieldType(Protocol, Generic[C, V]):
    key: ClassVar[str]                       # "select"
    config_model: ClassVar[type[BaseModel]]  # valida a configuração vinda do template
    is_analyzable: ClassVar[bool]            # pode virar dimensão de análise

    def validate_value(self, config: C, raw: Any) -> V: ...       # levanta ValidationError
    def value_schema(self, config: C) -> dict[str, Any]: ...      # JSON Schema, para exportação
    def default_value(self, config: C) -> V | None: ...
    def index_expression(self, field_path: str) -> str | None: ...  # SQL do índice, se analisável

    # Interface (templates Django em registries/field_types/templates/)
    editor_template: ClassVar[str]           # "field_types/select/editor.html"
    display_template: ClassVar[str]
    filter_template: ClassVar[str | None]
```

Registro de uma entrada:

```python
# registries/field_types/__init__.py
from .registry import FieldTypeRegistry
from .select import SelectField

field_types = FieldTypeRegistry()
field_types.register(SelectField())
```

### 7.2 Regras de registros

- **R-20** Toda entrada de registro **DEVE** ter `key` única, estável e imutável após o primeiro release. Renomear exige nova chave e migração.
- **R-21** A validação de um valor **DEVE** ser definida uma única vez, na entrada de registro em Python. Formulários, importação, regras e API (se existir) chamam o mesmo `validate_value`. **NÃO DEVE** existir validação paralela em JavaScript além de atributos HTML de conveniência (`required`, `maxlength`).
- **R-22** Toda entrada de registro **DEVE** ter testes cobrindo validação de configuração, validação de valor e casos-limite.
- **R-23** Adicionar uma entrada de registro **NÃO DEVERIA** exigir alteração em nenhum outro arquivo além do próprio arquivo, seus templates HTML e a linha de registro.
- **R-24** Geradores e ações **DEVEM** ser determinísticos dado o mesmo estado e os mesmos parâmetros, para permitir pré-visualização e testes.

---

## 8. Camadas de customização e limites

### 8.1 As três camadas

| Camada | O usuário pode | Disponível em |
|---|---|---|
| **1 — Configuração** | Escolher template, renomear rótulos, trocar cores e ícones, ocultar módulos, editar a taxonomia | Fase 0 (MVP) |
| **2 — Tipos e campos** | Criar e editar tipos de evento e de item, com campos do catálogo; marcar campos como analisáveis; configurar widgets | Fase 3 |
| **3 — Geradores e regras** | Configurar parâmetros de geradores; ativar regras sugeridas; criar regras com gatilhos, condições e ações do catálogo | Geradores: Fase 0 · Regras: Fase 4 |

### 8.2 Limites quantitativos (valores iniciais)

Os valores abaixo ficam em configuração (`config/settings/base.py`, seção `ESTUDOS_LIMITS`) e podem ser revistos com dados reais de uso, por ADR.

| Recurso | Limite por workspace |
|---|---|
| Tipos de evento | 50 |
| Tipos de item | 30 |
| Campos por tipo | 30 |
| Campos analisáveis por tipo | 5 |
| Opções em `select` / `multi-select` | 100 |
| Itens em `checklist` | 50 |
| Texto curto | 2.000 caracteres |
| Nota (Markdown) | 100.000 caracteres |
| Anexo | 10 MB por arquivo · 500 MB por workspace |
| Regras ativas | 50 |
| Condições por regra | 5 |
| Ações por regra | 5 |
| Profundidade de encadeamento de regras | 3 |
| Widgets no painel | 12 |
| Horizonte de um gerador | 104 semanas |
| Itens/eventos criados por execução de gerador | 5.000 |

- **R-25** Os limites **DEVEM** ser verificados nos serviços (`services/`). Atributos HTML no formulário são apenas experiência de uso.
- **R-26** Ao atingir um limite, o sistema **DEVE** recusar a operação com mensagem clara. **NÃO DEVE** truncar ou descartar dados silenciosamente.

### 8.3 Limites qualitativos

O que a customização **não** permite, em nenhuma camada:

- **L-01 Entidades novas.** Usuários não criam novos tipos de entidade com relações próprias. Tudo é evento, item, tópico, questão ou nota.
- **L-02 Código de usuário.** Sem scripts, fórmulas livres, expressões avaliadas ou plugins de terceiros. Campos calculados se limitam a agregações prontas (soma, média, contagem, taxa).
- **L-03 Tipos de campo novos.** Usuários combinam tipos do catálogo; não definem tipos novos.
- **L-04 Algoritmos novos.** Geradores, condições e ações novos são trabalho da equipe, entregues como entradas de registro.
- **L-05 Layout livre.** Painéis são compostos por widgets do catálogo, em grade responsiva. Sem HTML/CSS de usuário.
- **L-06 Análise sobre qualquer campo.** Apenas campos marcados como analisáveis entram em gráficos e agregações. Os demais servem para exibição e filtro simples.
- **L-07 Dados sensíveis de terceiros.** Nenhum template ou tipo pode ser desenhado para registrar dados de pacientes ou outras pessoas identificáveis (ver [§12](#12-segurança-e-privacidade)).

---

## 9. Motor de regras

> Esta seção descreve a Fase 4. Até lá ela serve apenas como direção, para que as decisões das fases anteriores não fechem esse caminho.

### 9.1 Formato

```json
{
  "id": "r_01",
  "enabled": true,
  "when": { "trigger": "event.created" },
  "if": [
    { "condition": "type-is", "params": { "eventType": "plantao" } },
    { "condition": "field-equals", "params": { "field": "turno", "value": "noturno" } }
  ],
  "then": [
    { "action": "block-period", "params": { "offset": "PT0H", "anchor": "end", "duration": "PT8H" } }
  ]
}
```

Condições em `if` são combinadas por **E**. Para **OU**, cria-se outra regra. Em código, o formato é um modelo Pydantic em `modules/rules/domain/`.

### 9.2 Execução

1. O serviço grava a mudança e o evento de domínio na tabela `outbox`, **na mesma transação** (`transaction.atomic()`).
2. O worker (Procrastinate) lê a outbox, encontra regras do workspace cujo gatilho corresponde e avalia as condições.
3. As ações são executadas pelas interfaces públicas dos módulos donos, propagando `causation_id` e `depth + 1`.
4. Cada execução é registrada em `rule_executions` (regra, evento de origem, ações, resultado).

### 9.3 Regras do motor

- **R-27** O processamento de eventos **DEVE** usar o padrão Transactional Outbox. Nenhuma regra roda sobre uma mudança que não foi persistida. Jobs que dependem de uma mudança **DEVEM** ser enfileirados com `transaction.on_commit` ou a partir da outbox, nunca antes do commit.
- **R-28** Handlers **DEVEM** ser idempotentes. Processar o mesmo evento duas vezes não pode duplicar efeitos.
- **R-29** Uma execução com `depth` acima do limite (3) **DEVE** ser interrompida e registrada como bloqueada.
- **R-30** Uma regra **NÃO DEVE** disparar a si mesma, direta ou indiretamente, dentro da mesma cadeia de `correlation_id`.
- **R-31** Toda entidade criada ou alterada por regra **DEVE** registrar a regra de origem, e a interface **DEVE** exibir essa informação ("criado pela regra *Descanso pós-plantão*").
- **R-32** Ações de regra **NÃO DEVEM** excluir dados. Apenas criar, reagendar, bloquear e notificar.
- **R-33** Uma regra que falhar 5 vezes seguidas **DEVE** ser desativada automaticamente, com aviso ao usuário.

---

## 10. Dados e persistência

- **R-34** Toda tabela de dados de usuário **DEVE** ter `id` (UUIDv7), `workspace_id`, `created_at`, `updated_at` e `deleted_at` (soft delete). Esses campos vêm de um model abstrato único, definido em `modules/workspaces/` e exportado pela sua interface pública (ele não pode ficar em `core`, que não importa Django por R-01). UUIDv7 é gerado por `uuid.uuid7()` da biblioteca padrão, encapsulado em `core.ids.new_id`.
- **R-35** Toda consulta a dados de usuário **DEVE** filtrar por `workspace_id`. Serviços recebem o workspace como parâmetro obrigatório, e o model abstrato da R-34 fornece um queryset com `for_workspace(workspace)`, que é o ponto de partida obrigatório de toda consulta em `services/`. Consultas sem esse filtro só são aceitas em migrações, comandos de manutenção e no admin restrito à equipe.
- **R-36** Campos customizados **DEVEM** ficar em uma coluna `custom_fields` (`JSONField`, `jsonb` no Postgres), validada no serviço pelo `FieldTypeRegistry` antes de qualquer escrita.
- **R-37** Campos marcados como analisáveis **DEVEM** ter índice de expressão criado pelo sistema (a partir de `index_expression`). Índices sobre JSON não analisável **NÃO DEVEM** ser criados ad hoc.
- **R-38** O modelo EAV (tabela genérica chave/valor) **NÃO DEVE** ser usado.
- **R-39** Migrações **DEVEM** ficar no `migrations/` do módulo dono, ser reversíveis quando possível e aplicadas pelo pipeline, nunca manualmente em produção.
- **R-40** Datas e horas **DEVEM** ser armazenadas em UTC (`USE_TZ = True`, `timestamptz`), com o fuso do workspace salvo à parte (padrão `America/Sao_Paulo`). Recorrências usam RRULE no fuso do workspace.
- **R-41** O workspace **DEVE** ser exportável por completo em JSON versionado, incluindo metadados, e reimportável. O importador **DEVE** aceitar o formato `cronograma.json` do protótipo original.
- **R-63** O projeto **DEVE** usar um model de usuário próprio (`AUTH_USER_MODEL = "identity.User"`) desde a primeira migração, mesmo que ele não acrescente nenhum campo ao `AbstractUser`. Trocar o model de usuário depois de haver dados em produção é uma das migrações mais caras do Django.
- **R-64** O banco de produção **DEVE** ter backup automático diário com retenção documentada, e a restauração **DEVE** ser testada antes do primeiro deploy com clientes e depois a cada mudança de infraestrutura. O procedimento fica em `docs/guias/backup.md`.

---

## 11. Interface, PWA e offline

- **R-42** Formulários, filtros e exibições de tipos customizados **DEVEM** ser gerados a partir dos metadados e dos templates HTML registrados no `FieldTypeRegistry`. **NÃO DEVE** haver telas específicas por template de área.
- **R-43** Templates HTML e código Python de interface **NÃO DEVEM** conter condicionais por template ou área (`{% if template == ... %}`).
- **R-44** A aplicação **DEVE** ser uma PWA instalável, com acessibilidade mínima WCAG 2.1 AA: alvos de toque de 44 px, contraste adequado, navegação por teclado e rótulos ARIA (o protótipo original já segue esse padrão e serve de referência).
- **R-45** Na Fase 0, IDs de novas entidades são gerados no servidor (UUIDv7). A geração no cliente só volta a ser exigida quando o offline de escrita for aprovado por ADR.
- **R-46** No estágio inicial, o suporte offline **DEVE** se limitar a: PWA instalável, cache do *app shell* (layout, CSS, ícones, HTMX) e cache de leitura de uma lista explícita de páginas (inicialmente a agenda da semana e a lista de itens do dia). O service worker **NÃO DEVE** guardar fragmentos HTMX nem respostas de rotas fora dessa lista, e **DEVE** apagar o cache de dados no logout, para que um dispositivo compartilhado não exponha dados de outra pessoa. Criação e edição sem conexão estão fora de escopo até um ADR específico. Se esse ADR for aprovado, a solução preferida é uma tela isolada com JavaScript mínimo e fila local de mutações, não a reescrita da interface.
- **R-47** Quando houver escrita concorrente (vários dispositivos ou, no futuro, offline), conflitos **DEVEM** ser resolvidos por *last-write-wins* por campo, usando `updated_at`. Sincronização local-first completa (CRDT) está fora de escopo.
- **R-60** JavaScript no repositório **DEVE** se limitar a: o service worker (`ui/static/ui/sw.js`), o HTMX copiado para `ui/static/` com versão fixada e pequenos scripts de interface sem build. Qualquer biblioteca JS adicional, bundler ou framework de frontend exige ADR. O protótipo original em `area_templates/residencia-medica/fixtures/` é material de referência, não código do app, e fica fora dessa verificação.
- **R-61** Respostas HTMX **DEVEM** reutilizar os mesmos templates das páginas completas (fragmentos via `{% include %}` ou blocos), sem duplicar HTML entre versão parcial e completa.
- **R-65** URLs em templates HTML **DEVEM** ser geradas com `{% url %}` (e em Python com `reverse()`), inclusive em atributos HTMX (`hx-get`, `hx-post` etc.). Caminhos escritos à mão quebram em silêncio quando a rota muda e não são encontrados por busca pelo nome da rota.

---

## 12. Segurança e privacidade

- **R-48** Autorização **DEVE** ser verificada por caso de uso, nos serviços, com base no papel do usuário no workspace (`owner`, `editor`, `viewer`). Decoradores em views são camada adicional, não substituta. Se o banco suportar, Row Level Security por `workspace_id` também é camada adicional.
- **R-49** Texto livre de usuário (notas, campos) **DEVE** ser escapado na renderização. O autoescape do Django **NÃO DEVE** ser desligado (`|safe`, `mark_safe`) para conteúdo de usuário. Markdown é convertido com `markdown-it-py` e sanitizado com `nh3` antes de exibir.
- **R-50** Anexos **DEVEM** ser servidos por URLs assinadas e temporárias, com verificação de tipo e tamanho no upload.
- **R-51** Templates oficiais **NÃO DEVEM** sugerir campos para dados de saúde, identificação ou contato de terceiros. A interface de criação de campos **DEVE** exibir aviso sobre dados pessoais de terceiros.
- **R-52** O usuário **DEVE** poder excluir sua conta e todos os seus workspaces, com remoção definitiva após o período de retenção documentado (LGPD). A política de privacidade e o período de retenção (inclusive nos backups da R-64) **DEVEM** estar publicados antes do primeiro deploy com clientes.
- **R-53** Logs **NÃO DEVEM** conter conteúdo de notas, campos customizados ou anexos. Apenas identificadores e metadados técnicos.
- **R-62** Proteção CSRF do Django **DEVE** permanecer ativa, inclusive para requisições HTMX (token enviado no cabeçalho `X-CSRFToken`, configurado uma vez no layout base).

---

## 13. Extensibilidade

A arquitetura foi desenhada para que **ampliar seja, na maioria dos casos, adicionar, e não modificar**. Ela é deliberadamente barata em algumas direções e deliberadamente mais cara em outras.

### 13.1 Tipos de extensão

| Tipo de extensão | Onde entra | Esforço | Toca código existente? | Exemplo |
|---|---|---|---|---|
| Template novo | `area_templates/` | Baixo | Não (só dados) | Vestibular, Residência em Odontologia |
| Tipo de campo | `FieldTypeRegistry` | Baixo | Só a linha de registro | Avaliação em estrelas |
| Widget | `WidgetRegistry` + projeção em `analytics` | Baixo | Só a linha de registro | Sequência de dias estudados |
| Gerador, gatilho, condição ou ação | Registro correspondente | Baixo a médio | Só a linha de registro | Gerador "ciclo de estudos" |
| Integração externa | Novo adaptador no módulo dono | Baixo a médio | Não (o domínio não muda) | Google Calendar, notificações push |
| Módulo que reage a fatos existentes | Módulo novo consumindo eventos | Médio | Não | Gamificação, conquistas |
| API JSON para app nativo | Django Ninja chamando os mesmos serviços | Médio | Não (serviços e domínio não mudam) | App mobile |
| Entidade nova no núcleo | Novo módulo ou módulo existente + ADR | Médio a alto | Sim, em vários pontos | Sessões de estudo (cronômetro) |
| Mudança no formato de template | `template_schema` + migração | Alto | Sim | Metas sugeridas por template |
| Offline de escrita | ADR + tela com JS isolado | Alto | Sim | Registrar revisão sem sinal |
| Colaboração em tempo real | ADR de sincronização | Alto | Sim | Grupos de estudo editando juntos |

### 13.2 Pontos de atenção conhecidos

- **Indireção.** O comportamento de um conceito de área (ex.: plantão) fica distribuído entre template, registros e regras. Não existe um `PlantaoService`. O `EXTENDING.md` e o scaffolding existem para compensar isso.
- **Entidades novas atravessam muitas camadas.** Por isso seguem uma checklist obrigatória ([§13.3](#133-checklist-para-entidade-nova-no-núcleo)).
- **Evolução do meta-schema** é a mudança mais cara do sistema, porque exige migrar workspaces existentes (R-19). Deveria ser rara e agrupada.
- **Lógica escorrendo para models e views.** É o risco típico de Django. Regra prática: se um método de model ou uma view toma uma decisão de negócio, ele pertence a `services/` ou `domain/`.
- **Atravessar relações entre módulos.** Com `ForeignKey` entre módulos (R-04), é fácil escrever `item.workspace.members.filter(...)` num serviço de `study` e ler tabela alheia sem perceber. A revisão de PR deve olhar para isso até existir verificação automática.

### 13.3 Checklist para entidade nova no núcleo

Uma entidade nova só está concluída quando todos os itens abaixo estiverem feitos no mesmo PR (ou em PRs ligados ao mesmo ADR):

- [ ] ADR aprovado justificando a entrada no núcleo (R-10)
- [ ] Módulo dono definido e matriz de dependências atualizada, se necessário
- [ ] Model herdando o model abstrato com `id`, `workspace_id`, `created_at`, `updated_at`, `deleted_at` (R-34) e migração (R-39)
- [ ] Serviços com `workspace` obrigatório e consultas via `for_workspace` (R-35)
- [ ] Funções públicas expostas em `api.py` (R-03)
- [ ] Eventos de domínio versionados (R-09)
- [ ] Autorização por papel nos serviços (R-48)
- [ ] Inclusão na exportação e na importação do workspace (R-41)
- [ ] Testes de isolamento por workspace
- [ ] Gatilhos e widgets do catálogo atualizados, se a entidade deve ser usável por regras ou painéis
- [ ] Receita ou seção correspondente no `EXTENDING.md`

### 13.4 Regras de extensibilidade

- **R-54** Toda extensão de um tipo listado em §13.1 **DEVE** seguir a receita correspondente em `docs/EXTENDING.md`. Se a receita não existir, ela **DEVE** ser escrita no mesmo PR da primeira extensão daquele tipo.
- **R-55** Entidades novas no núcleo **DEVEM** cumprir a checklist da §13.3.
- **R-56** Módulos novos **DEVERIAM** partir da estrutura do módulo de referência, mantido simples e comentado para esse fim. Na Fase 0 o módulo de referência é `modules/agenda`; ele pode ser trocado por ADR quando houver um módulo mais representativo.

---

## 14. Ferramentas de desenvolvimento

### 14.1 Comandos do dia a dia

```bash
make dev        # sobe Postgres (docker compose) e o servidor Django
make test       # pytest
make lint       # ruff check + ruff format --check + pyright
make arch       # import-linter (fronteiras)
make check      # lint + arch + test, igual ao CI
make worker     # sobe o worker Procrastinate (a partir da Fase 2)
```

### 14.2 Fronteiras com import-linter

Trecho do `pyproject.toml` (a versão vigente é sempre a do arquivo):

```toml
[tool.importlinter]
root_package = "estudos"
include_external_packages = true   # necessário para proibir django/procrastinate

[[tool.importlinter.contracts]]
name = "domain e core não dependem de infraestrutura (R-01)"
type = "forbidden"
source_modules = ["estudos.core", "estudos.modules.*.domain"]
forbidden_modules = ["django", "allauth", "procrastinate"]
allow_indirect_imports = true

[[tool.importlinter.contracts]]
name = "camadas dentro de cada módulo (R-01, R-02)"
type = "layers"
containers = [
  "estudos.modules.identity",
  "estudos.modules.workspaces",
  "estudos.modules.agenda",
  "estudos.modules.study",
]
# Camadas entre parênteses são opcionais (o módulo pode não tê-las).
layers = ["(views)", "(api)", "(services)", "(models)", "(domain)"]

[[tool.importlinter.contracts]]
name = "pacotes compartilhados não dependem de módulos (R-06)"
type = "forbidden"
source_modules = ["estudos.core", "estudos.registries", "estudos.template_schema"]
forbidden_modules = ["estudos.modules"]
```

A lista de `containers` cresce junto com os módulos: cada módulo novo entra nela no mesmo PR que o cria.

A matriz da §4.3 (R-03 e R-05) é verificada por um teste em `tests/architecture/` que lê os imports de cada módulo, confere que imports de outro módulo só apontam para `<módulo>.api` e compara as dependências com a matriz declarada no próprio teste. O mesmo teste confere que referências textuais de `ForeignKey` (`"app.Model"`) respeitam a matriz, já que elas não aparecem como import (R-04).

### 14.3 Scaffolding

Scaffolding é a geração automática da estrutura inicial de arquivos a partir de modelos. O projeto usa Copier (em `tools/scaffolding/`) para que o caminho que segue a arquitetura seja também o caminho mais fácil.

```bash
make gen-field-type   # domínio + templates HTML + testes + linha de registro
make gen-widget
make gen-generator
make gen-action
make gen-template     # pasta em area_templates/ com template mínimo válido
make gen-module       # estrutura domain/services/models/views/api.py
make gen-core-entity  # todos os pontos da checklist §13.3, com TODOs
```

Os arquivos gerados já implementam o contrato correspondente pela metade e trazem os casos de teste obrigatórios (R-22) esperando implementação.

### 14.4 Regras

- **R-57** Um modelo de scaffolding **DEVERIA** ser criado apenas depois de existirem de dois a três exemplos feitos à mão do mesmo tipo, para não congelar um padrão ainda imaturo.
- **R-58** Quando um contrato de registro ou a estrutura de módulo mudar, o modelo de scaffolding correspondente **DEVE** ser atualizado no mesmo PR.
- **R-59** O código gerado por scaffolding **DEVE** passar no lint, no pyright e nas verificações de fronteira sem edição manual.

---

## 15. Processo de mudança

### 15.1 ADRs

Decisões que afetam este documento são registradas em `docs/adr/NNNN-titulo.md`, a partir do modelo `docs/adr/0000-modelo.md`, com contexto, decisão, alternativas consideradas e consequências (meia página é o tamanho esperado). São obrigatórias para: nova entidade no núcleo, novo módulo, mudança na matriz de dependências, alteração de limites, mudança de tecnologia de base, nova dependência JavaScript (R-60) e exceções a regras **DEVE**.

ADRs aceitos são imutáveis. Para mudar uma decisão, escreve-se um ADR novo e o antigo passa a ter o status *Substituído por ADR-NNNN*. Correções de redação que não mudam a decisão podem ser feitas no próprio ADR.

### 15.2 Onde um requisito novo entra

| Pergunta | Se sim | Exemplo |
|---|---|---|
| Todo perfil de estudante precisa? | **Núcleo** (código + ADR) | Repetição espaçada |
| Uma área inteira precisa? | **Template de área** (dados) | Plantão, simulado, saída de campo |
| Precisa de um comportamento que o catálogo não tem? | **Nova entrada de registro** (código) | Gerador "ciclo de estudos" |
| Só uma pessoa precisa? | **Customização do usuário** (campo, tag, nota) | Campo "bancada" no laboratório |
| Exige entidade nova ou código de usuário? | **Fora de escopo** (reavaliar por ADR) | Prontuário de pacientes |

### 15.3 Critérios para extrair um módulo para serviço próprio

Só por ADR, e apenas se houver ao menos um destes sinais medidos: necessidade de escalar independentemente (ex.: worker saturado), requisito de isolamento de falha comprovado, ou equipe dedicada ao módulo. A extração natural prevista é o worker, que já roda em processo separado.

### 15.4 Fluxo de trabalho da equipe

Kanban no GitHub Projects, em ciclos de duas semanas que terminam com uma demonstração curta para os clientes. Trunk-based development com branches curtas; todo PR é revisado pelo outro desenvolvedor e cita as regras envolvidas (ex.: "atende R-35"). Detalhes em `CONTRIBUTING.md`.

Com duas pessoas, as regras valem principalmente como lista de verificação na revisão. Apenas o que está na §16 bloqueia o build; o restante é cobrado no PR, sem cerimônia adicional.

---

## 16. Verificação automática (fitness functions)

Regras sem verificação se perdem. O CI **DEVE** executar (cada verificação só passa a bloquear o build na fase indicada na §17):

| Verificação | Ferramenta | Regras cobertas |
|---|---|---|
| Fronteiras entre camadas e módulos | import-linter + teste da matriz em `tests/architecture/` | R-01 a R-06 |
| Termos de área fora de `area_templates/` | teste com lista de termos proibidos em `src/` (Python e templates HTML) | R-11, R-43 |
| Validação de todos os templates de área | teste contra o meta-schema | R-12 a R-14 |
| Contrato de templates | instanciar cada template e comparar com snapshot esperado | R-15, R-24 |
| Paridade com o protótipo | o template `residencia-medica` com gerador `linear` gera as mesmas semanas que o HTML original | R-41 |
| Model de usuário próprio | teste que confere `AUTH_USER_MODEL` | R-63 |
| Propriedades do motor de regras | Hypothesis: combinações aleatórias nunca excedem a profundidade nem entram em laço | R-29, R-30 |
| Idempotência de handlers | reprocessar eventos e comparar estado | R-28 |
| Isolamento por workspace | testes que tentam ler dados de outro workspace | R-35, R-48 |
| Acessibilidade | Playwright + axe-core nas telas principais | R-44 |
| JavaScript permitido | teste que lista arquivos `.js` do repositório contra a lista permitida | R-60 |
| Autoescape e CSRF | lint de templates procurando `|safe`/`mark_safe` em conteúdo de usuário; teste de CSRF em rota HTMX | R-49, R-62 |
| URLs nomeadas | lint de templates procurando `href`, `action` e `hx-*` com caminho literal começando por `/` | R-65 |
| Scaffolding válido | gerar uma entrada de cada tipo no CI e rodar lint e testes | R-58, R-59 |
| Qualidade básica | ruff, pyright | todas |

---

## 17. Implementação por fases

A arquitetura completa não precisa existir no primeiro dia. Cada fase define o escopo de produto e quais regras passam a ser verificadas em CI. Regras de fases futuras valem como direção desde já, mas só bloqueiam o build quando sua fase começar.

| Fase | Escopo | Regras verificadas em CI a partir desta fase |
|---|---|---|
| **0 — MVP** | `identity`, `workspaces`, `agenda`, `study`; template `residencia-medica` portado do protótipo; gerador `linear`; customização da camada 1; PWA com cache de leitura; importação do `cronograma.json`; deploy com clientes reais, backup e política de privacidade | R-01 a R-03, R-11 a R-15, R-34 a R-36, R-41, R-44, R-48, R-49, R-60 a R-63, R-65, paridade com o protótipo, isolamento por workspace |
| **1 — Segundo template** | Template `concurso-publico`, gerador `weighted`, convites e papéis no workspace | R-04 a R-06 (matriz completa), R-47 |
| **2 — Prática** | `practice` (questões, tentativas, FSRS), `analytics`, widgets de desempenho, outbox e worker | R-07 a R-09, R-27, R-28, R-37 |
| **3 — Customização avançada** | Camada 2 (tipos e campos do usuário), `notes`, templates compartilháveis, exportação `.ics`, scaffolding | R-16 a R-26, R-54 a R-59 |
| **4 — Automação** | `rules`, motor de regras (camada 3 completa) | R-29 a R-33 |

O template `concurso-publico` na Fase 1 é intencional: o segundo template é o que revela o que ainda está específico demais no núcleo. O offline de escrita não tem fase fixa; entra quando um ADR justificar com base no uso real (ver R-46).

### 17.1 Etapas da Fase 0

| # | Etapa | Entrega verificável |
|---|---|---|
| 0 | Fundação | Estrutura de pastas da Fase 0, `pyproject.toml`, Docker Compose com Postgres, `Makefile`, CI com ruff, pyright, pytest e import-linter; app `identity` com model de usuário próprio e allauth (R-63); `docs/adr/0000-modelo.md`; ADRs 0009 a 0012 escritos e ADRs 0002 e 0005 marcados como substituídos |
| 1 | Especificação executável | Protótipo original copiado para `area_templates/residencia-medica/fixtures/`, `cronograma.json` e `semanas-esperadas.json` extraídos dele, e teste de paridade que falha até o gerador `linear` produzir as mesmas semanas do HTML original |
| 2 | Template-schema e registros | Meta-schema, `FieldTypeRegistry` com `text`, `number`, `select`, `date` e `boolean`; template `residencia-medica` validando |
| 3 | Workspaces | Model abstrato com `for_workspace` (R-34, R-35), membros e papéis, instanciação por cópia versionada (R-15) e importador do `cronograma.json` (R-41) |
| 4 | Agenda e study | Telas HTMX com autenticação, serviços com `workspace` obrigatório e testes de isolamento |
| 5 | Interface e PWA | Formulários gerados pelos metadados, layout base acessível, manifest e service worker com cache de leitura limitado e limpo no logout (R-46) |
| 6 | Deploy | Hospedagem escolhida e documentada em `docs/guias/deploy.md`, backup diário com restauração testada (R-64), política de privacidade publicada (R-52) e primeira cliente usando a versão real no celular e no computador |

A etapa 1 vem antes de quase todo o código de propósito: ela transforma o protótipo num teste que diz quando o MVP está pronto. Divisão sugerida: uma pessoa nas etapas 1 a 3 (domínio e geradores), a outra na etapa 0 e no layout base; as duas se encontram na etapa 4.

---

## 18. Fora de escopo

Nesta fase, explicitamente **não** faremos:

- microsserviços ou múltiplos bancos;
- scripts, fórmulas livres ou plugins de usuário;
- frontend SPA, bundlers ou frameworks JavaScript (React, Vue etc.) sem ADR;
- criação e edição offline;
- sincronização local-first com CRDT;
- colaboração em tempo real na mesma nota;
- marketplace público de templates com moderação;
- banco de questões com conteúdo de plataformas comerciais;
- aplicativos nativos (o caminho previsto é a PWA e, depois, uma API Django Ninja sobre os mesmos serviços).

---

## 19. Glossário

| Termo | Significado |
|---|---|
| **Workspace** | Espaço de estudo de um objetivo, com seu template, metadados e dados |
| **Template de área** | Pacote declarativo e versionado de metadados para uma área de estudo, em `area_templates/`. Não confundir com template HTML do Django |
| **Metadados** | Definições que descrevem os dados: tipos, campos, regras, widgets |
| **Registro** | Catálogo fechado de implementações (tipos de campo, geradores, ações...) |
| **Gerador** | Estratégia que cria itens ou eventos a partir de parâmetros (ex.: 4 tópicos por semana) |
| **Regra** | Automação *quando → se → então* montada com peças dos registros |
| **Campo analisável** | Campo customizado indexado e disponível como dimensão em widgets e relatórios |
| **Hexagonal leve** | Domínio em Python puro onde há lógica real, serviços com casos de uso e models do Django como persistência, sem repositórios abstratos por padrão |
| **Interface pública** | O `api.py` de cada módulo: funções de serviço, DTOs e eventos que outros módulos podem importar |
| **Serviço** | Função ou classe em `services/` que implementa um caso de uso, verifica autorização e limites |
| **HTMX** | Biblioteca que permite trocar trechos da página por HTML vindo do servidor, sem escrever JavaScript |
| **App shell** | Partes estáticas da interface (layout, CSS, ícones, scripts) que o service worker guarda para a PWA abrir sem rede |
| **Outbox** | Tabela onde eventos de domínio são gravados na mesma transação da mudança |
| **Procrastinate** | Fila de jobs em Python que usa o próprio PostgreSQL |
| **Causation / correlation id** | Identificadores que ligam um efeito ao evento que o causou e à cadeia inteira |
| **Scaffolding** | Geração automática da estrutura inicial de arquivos a partir de modelos |
| **Módulo de referência** | Módulo mantido simples e comentado para servir de modelo a módulos novos |
| **ADR** | *Architecture Decision Record*: registro curto de uma decisão arquitetural, com contexto e alternativas |

---

## Apêndice A — Mudanças da v0.2 para a v0.3

**Motivo:** equipe de 2 desenvolvedores com clientes reais e preferência por Python em todo o sistema.

- **Linguagem e stack:** TypeScript ponta a ponta foi substituído por Python. React + Vite deu lugar a templates Django + HTMX; Fastify/NestJS a Django; Drizzle a migrações do Django; pg-boss a Procrastinate; Ajv a Pydantic + `jsonschema`; dependency-cruiser a import-linter; fast-check a Hypothesis; Plop a Copier; pnpm a uv e Make. Contas passam a usar `django.contrib.auth` + `django-allauth`.
- **Novo princípio P7** (uma linguagem) e **novas regras** R-60 (JavaScript permitido), R-61 (fragmentos HTMX reutilizam templates), R-62 (CSRF em HTMX), R-63 (model de usuário próprio desde a primeira migração), R-64 (backup com restauração testada) e R-65 (URLs sempre por nome, inclusive no HTMX).
- **Língua e convenções:** código em inglês, interface e documentação em português (§3). Convenções de legibilidade e rastreabilidade (README por módulo, `api.py` documentado, um caso de uso por arquivo, arquivo de registro com o nome da chave) ficam em `CONTRIBUTING.md`. O cronograma das fases fica em `docs/produto/roadmap.md`.
- **Regras reescritas:** R-01 e R-02 (camadas do hexagonal leve), R-03 (interface pública em `api.py`), R-04 (`ForeignKey` entre módulos por referência textual), R-08 (proibição de Django signals para efeitos entre módulos), R-11 (termos de área também permitidos em `docs/`), R-21 (validação única em Python), R-25, R-27 (`transaction.on_commit`), R-34, R-35 (queryset `for_workspace`), R-36, R-39, R-40, R-42, R-43, R-45, R-46 (offline reduzido a cache de leitura limitado e limpo no logout), R-48, R-49, R-52 (política de privacidade antes do deploy), R-56 (módulo de referência passa a ser `agenda`).
- **Interface pública dos módulos:** passou de `index.ts` para `api.py`, e não `__init__.py`, porque o Django importa o `__init__.py` antes de os models estarem prontos.
- **Papéis no workspace:** saíram de `identity` e foram para `workspaces`, para respeitar a matriz de dependências (`identity` não depende de nenhum módulo).
- **Estrutura:** código em `src/estudos/`; `modules/calendar` renomeado para `modules/agenda`; `templates/` renomeado para `area_templates/`; o protótipo original passa a ficar versionado em `area_templates/residencia-medica/fixtures/`; novas pastas `docs/produto`, `docs/guias`, `docs/diagramas`, `docs/assets` e `assets/` na raiz. Pastas de fases futuras não são criadas antecipadamente.
- **Fases:** `identity` passou da Fase 1 para a Fase 0, porque há clientes desde o primeiro deploy. A outbox e o worker ficam para a Fase 2; `notes` para a Fase 3 e `rules` para a Fase 4. Etapas da Fase 0 detalhadas em §17.1, incluindo backup e política de privacidade no deploy.
- **ADRs:** os ADRs 0001 a 0008 continuam válidos, exceto 0002 (TypeScript) e 0005 (pg-boss), que passam a *Substituído*. Novos: ADR-0009 (Python), ADR-0010 (templates Django + HTMX), ADR-0011 (Procrastinate) e ADR-0012 (hexagonal leve, complementando o 0001).
