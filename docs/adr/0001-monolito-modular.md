# ADR-0001: Estilo Arquitetural — Monolito Modular com Arquitetura Hexagonal

- **Status:** Aceito
- **Contexto:** Precisamos de fronteiras claras entre domínios (`identity`, `workspaces`, `calendar`, `study`, `practice`, `notes`, `rules`, `analytics`) mantendo simplicidade operacional (P6: um deploy, um banco).
- **Decisão:** Adotar um **monolito modular** onde cada módulo segue **arquitetura hexagonal** (`domain/`, `application/`, `adapters/`, `index.ts`) e se comunica apenas pela interface pública ou por eventos de domínio.
- **Consequências:** Fronteiras verificadas em CI (`npm run check:arch`) sem custo operacional de microsserviços distribuídos.
