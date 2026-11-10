# ADR-0003: PostgreSQL com Campos Customizados em JSONB

- **Status:** Aceito
- **Contexto:** Entidades do núcleo possuem colunas fixas universais, mas templates definem campos específicos de cada área de estudo. O modelo EAV é complexo e lento (R-38).
- **Decisão:** Utilizar PostgreSQL com tabelas relacionais para o núcleo e coluna `custom_fields JSONB` validada contra o schema do tipo (`FieldTypeRegistry`), criando índices de expressão apenas para campos marcados como `analyzable` (R-36, R-37).
- **Consequências:** Consultas rápidas com isolamento por `workspace_id` e flexibilidade declarativa por template.
