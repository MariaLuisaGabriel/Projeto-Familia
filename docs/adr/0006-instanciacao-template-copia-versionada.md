# ADR-0006: Instanciação de Template por Cópia Versionada

- **Status:** Aceito
- **Contexto:** Os dados e customizações do usuário pertencem a ele (P5). Se um template mudar no futuro, isso jamais pode quebrar ou sobrescrever silenciosamente um workspace em andamento.
- **Decisão:** Instanciar um template copia seus metadados para o workspace e grava `template_id` + `template_version` de origem (R-15). Atualizações futuras são oferecidas como diff campo a campo (R-16).
- **Consequências:** Isolamento total do workspace após criação e evolução segura de templates.
