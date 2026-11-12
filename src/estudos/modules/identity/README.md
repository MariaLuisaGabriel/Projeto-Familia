# Módulo `identity`

Contas de usuário: cadastro, login por e-mail, verificação de e-mail, recuperação de senha e sessão. As telas e os fluxos vêm do `django-allauth`; este módulo define o model de usuário (R-63).

## Responsável por
- Model de usuário (`identity.User`, login por e-mail, sem username)
- Autenticação e sessão (via django-allauth)
- Exclusão de conta (R-52, ainda não implementada)

## Não é responsável por
- Papéis no workspace (`owner`, `editor`, `viewer`) (→ módulo `workspaces`)
- Preferências de estudo (→ `workspaces`)

## Interface pública (`api.py`)
Nenhuma função ainda. Outros módulos referenciam o usuário por `settings.AUTH_USER_MODEL`.

## Tabelas que possui
| Model | Tabela | Observação |
|---|---|---|
| `User` | `identity_user` | PK UUIDv7; `email` único; não tem `workspace_id` (não é dado de workspace) |

As tabelas do allauth (`account_emailaddress`, `account_emailconfirmation`) pertencem a este módulo para efeito da R-04.

## Depende de
Nenhum módulo (matriz da ARQUITETURA §4.3). Usa `estudos.core.ids`.

## Usado por
- Todos os módulos, via `settings.AUTH_USER_MODEL`

## Eventos
- **Emite:** Nenhum.
- **Consome:** Nenhum.

## Registros usados
Nenhum.

## Decisões e regras relevantes
- R-63 (model de usuário próprio desde a primeira migração)
- R-52 (exclusão de conta, LGPD)
- Configuração do allauth em `config/settings/base.py`, seção "contas"

## Onde começar a ler
1. `models.py`: o model de usuário e o manager por e-mail
2. `config/settings/base.py`: configuração do allauth
