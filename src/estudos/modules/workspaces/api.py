"""Interface pública do módulo workspaces. Única coisa importável por outros módulos (R-03)."""

from .domain.template_loader import (
    EventTypeSpec,
    FieldSpec,
    GeneratorConfigSpec,
    ItemTypeSpec,
    SubjectSeedSpec,
    TopicSeedSpec,
    WidgetCardView,
    WorkspaceSnapshot,
)
from .services.customize_layer1 import update_workspace_layer1
from .services.get_active_workspace import (
    build_dashboard_widgets,
    get_active_workspace,
    list_workspaces,
)

__all__ = [
    "EventTypeSpec",
    "FieldSpec",
    "GeneratorConfigSpec",
    "ItemTypeSpec",
    "SubjectSeedSpec",
    "TopicSeedSpec",
    "WidgetCardView",
    "WorkspaceSnapshot",
    "build_dashboard_widgets",
    "get_active_workspace",
    "list_workspaces",
    "update_workspace_layer1",
]
