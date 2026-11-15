# Módulo `workspaces`

Gerencia os espaços de estudo do usuário, a instanciação versionada de templates de área (`area_templates/`), os metadados do workspace (tipos de compromisso, tipos de item, widgets do painel) e a customização de Camada 1 (§8.1).

## Responsável por
- Instanciação por cópia versionada de templates de área (`R-15`)
- Painel principal composto pelos widgets declarados no workspace (`L-05`, `R-42`)
- Customização da Camada 1 (renomear workspace, ocultar/exibir módulos na navegação)
- Papéis no workspace (`owner`, `editor`, `viewer`) e model abstrato de dados de usuário (Etapa 3)

## Não é responsável por
- Autenticação e contas de usuário (→ módulo `identity`)
- Ocorrências de eventos na agenda (→ módulo `agenda`)
- Disciplinas, tópicos e execução de geradores de cronograma (→ módulo `study`)

## Interface pública (`api.py`)
| Função / tipo | Caso de uso |
|---|---|
| `WorkspaceSnapshot` | DTO com a cópia versionada dos metadados do workspace |
| `get_active_workspace` | Obtém o workspace selecionado ou o padrão inicial |
| `list_workspaces` | Lista os workspaces instanciados a partir de `area_templates/` |
| `build_dashboard_widgets` | Monta os cartões de widgets declarados no metadado `dashboard` |
| `update_workspace_layer1` | Atualiza nome e módulos visíveis na navegação do workspace |

## Tabelas que possui
Nenhuma ainda (serão criadas na Etapa 3 da Fase 0).

## Depende de
- `identity` (via `settings.AUTH_USER_MODEL`)

## Usado por
- `agenda` (via `workspaces.api.get_active_workspace`)
- `study` (via `workspaces.api.get_active_workspace`)

## Eventos
- **Emite:** Nenhum (a partir da Fase 2).
- **Consome:** Nenhum.

## Registros usados
- `WidgetRegistry` e `FieldTypeRegistry` (metadados dos tipos do workspace).

## Decisões e regras relevantes
- ADR-0006 (instanciação por cópia versionada, `R-15`)
- R-42 e R-43 (painel e metadados sem condicionais específicas de área)

## Onde começar a ler
1. `api.py`: contratos e casos de uso públicos
2. `services/get_active_workspace.py`: carregamento do workspace e montagem dos widgets
3. `domain/template_loader.py`: leitura declarativa dos arquivos em `area_templates/`
