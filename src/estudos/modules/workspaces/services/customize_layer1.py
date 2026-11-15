"""Caso de uso: customizar configurações da Camada 1 do workspace (§8.1)."""

from ..domain.template_loader import WorkspaceSnapshot
from .get_active_workspace import get_active_workspace

AVAILABLE_UI_MODULES = ("workspaces", "agenda", "study")


def update_workspace_layer1(
    workspace_id: str | None,
    *,
    new_name: str | None = None,
    active_modules: list[str] | None = None,
) -> WorkspaceSnapshot:
    """Atualiza o nome do workspace e os módulos visíveis na navegação (Camada 1 — §8.1)."""
    ws = get_active_workspace(workspace_id)
    if new_name and new_name.strip():
        ws.name = new_name.strip()[:120]
    if active_modules is not None:
        valid = [m for m in active_modules if m in AVAILABLE_UI_MODULES]
        if "workspaces" not in valid:
            valid.insert(0, "workspaces")
        ws.active_modules = valid
    return ws
