# ADR-0007: Repetição Espaçada com Algoritmo FSRS

- **Status:** Aceito
- **Contexto:** Todo estudante se beneficia de revisão espaçada baseada em memória (estabilidade e dificuldade).
- **Decisão:** Adotar o algoritmo FSRS (Free Spaced Repetition Scheduler) no módulo `modules/practice` sobre as entidades `Card` e `ReviewLog`.
- **Consequências:** Agendamento moderno e determinístico de revisões de cartões.
