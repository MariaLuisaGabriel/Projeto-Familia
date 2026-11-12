## O que muda

<!-- Uma ou duas frases. Link para o item do Kanban. -->

## Regras e ADRs envolvidos

<!-- Ex.: atende R-35 (filtro por workspace), segue ADR-0006. -->

## Como testar

<!-- Passos para o revisor verificar localmente, se não for óbvio pelos testes. -->

## Checklist

- [ ] `make check` passa localmente
- [ ] Testes cobrem o comportamento novo (e isolamento por workspace, se toca dados de usuário)
- [ ] README do módulo e `api.py` atualizados, se a interface mudou
- [ ] URLs por nome (`{% url %}` / `reverse()`), inclusive no HTMX (R-65)
- [ ] Nenhum termo de área fora de `area_templates/` (R-11)
- [ ] ADR escrito, se a mudança exige (ARQUITETURA §15.1)
