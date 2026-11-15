"""Views e fragmentos HTMX do módulo study (cronograma, tópicos e gerador linear — R-61, R-65)."""

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

from estudos.modules.workspaces.api import get_active_workspace, list_workspaces

from .services.list_study_plan import (
    get_study_progress,
    list_study_items,
    run_linear_generator,
)
from .services.toggle_study_item import toggle_study_item

SESSION_WORKSPACE_KEY = "active_workspace_id"


def _resolve_workspace(request: HttpRequest):
    ws_id = request.GET.get("ws") or request.session.get(SESSION_WORKSPACE_KEY)
    if request.GET.get("ws"):
        request.session[SESSION_WORKSPACE_KEY] = ws_id
    return get_active_workspace(ws_id)


def _build_study_context(request: HttpRequest) -> dict[str, object]:
    workspace = _resolve_workspace(request)
    items = list_study_items(workspace)
    completed, total = get_study_progress(workspace)
    pct = round((completed / total) * 100) if total > 0 else 0
    default_gen = workspace.generators[0] if workspace.generators else None
    return {
        "active_module": "study",
        "workspace": workspace,
        "all_workspaces": list_workspaces(),
        "study_items": items,
        "completed_count": completed,
        "total_count": total,
        "progress_pct": pct,
        "default_items_per_week": default_gen.items_per_week if default_gen else 4,
    }


@require_GET
def index(request: HttpRequest) -> HttpResponse:
    """Exibe a tela completa de Estudos ou devolve o fragmento HTMX (R-61)."""
    context = _build_study_context(request)
    if request.headers.get("HX-Request") == "true":
        return render(request, "study/partials/study_content.html", context)
    return render(request, "study/index.html", context)


@require_POST
def toggle_item_view(request: HttpRequest, item_id: str) -> HttpResponse:
    """Alterna a conclusão de um item de estudo e atualiza a lista via HTMX."""
    workspace = _resolve_workspace(request)
    toggle_study_item(workspace, item_id)
    context = _build_study_context(request)
    if request.headers.get("HX-Request") == "true":
        return render(request, "study/partials/study_content.html", context)
    return render(request, "study/index.html", context)


@require_POST
def run_generator_view(request: HttpRequest) -> HttpResponse:
    """Executa o gerador linear com o ritmo semanal escolhido pelo usuário."""
    workspace = _resolve_workspace(request)
    raw_rate = request.POST.get("items_per_week", "4")
    try:
        per_week = max(1, min(int(raw_rate), 30))
    except ValueError:
        per_week = 4
    run_linear_generator(workspace, items_per_week=per_week)
    context = _build_study_context(request)
    if request.headers.get("HX-Request") == "true":
        return render(request, "study/partials/study_content.html", context)
    return render(request, "study/index.html", context)
