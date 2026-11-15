"""Views e fragmentos HTMX do módulo workspaces (Painel e Camada 1 — R-61, R-65)."""

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods, require_POST

from .services.customize_layer1 import update_workspace_layer1
from .services.get_active_workspace import (
    build_dashboard_widgets,
    get_active_workspace,
    list_workspaces,
)

SESSION_WORKSPACE_KEY = "active_workspace_id"


def _resolve_workspace_id(request: HttpRequest) -> str | None:
    requested = request.GET.get("ws") or request.POST.get("workspace_id")
    if requested:
        request.session[SESSION_WORKSPACE_KEY] = requested
        return requested
    return request.session.get(SESSION_WORKSPACE_KEY)


def _build_context(request: HttpRequest) -> dict[str, object]:
    ws_id = _resolve_workspace_id(request)
    workspace = get_active_workspace(ws_id)
    all_workspaces = list_workspaces()
    total_topics = sum(len(s.topics) for s in workspace.taxonomy)
    widgets = build_dashboard_widgets(
        workspace,
        completed_items=0,
        total_items=total_topics,
    )
    return {
        "active_module": "workspaces",
        "workspace": workspace,
        "all_workspaces": all_workspaces,
        "widgets": widgets,
        "total_topics": total_topics,
    }


@require_http_methods(["GET"])
def dashboard(request: HttpRequest) -> HttpResponse:
    """Exibe o painel principal do workspace ou devolve apenas o fragmento HTMX (R-61)."""
    context = _build_context(request)
    if request.headers.get("HX-Request") == "true":
        return render(request, "workspaces/partials/dashboard_content.html", context)
    return render(request, "workspaces/dashboard.html", context)


@require_POST
def switch_workspace(request: HttpRequest) -> HttpResponse:
    """Troca o workspace ativo na sessão e re-renderiza o painel."""
    context = _build_context(request)
    if request.headers.get("HX-Request") == "true":
        return render(request, "workspaces/partials/dashboard_content.html", context)
    return render(request, "workspaces/dashboard.html", context)


@require_POST
def customize_layer1_view(request: HttpRequest) -> HttpResponse:
    """Salva customizações da Camada 1 (nome e módulos visíveis no menu — §8.1)."""
    ws_id = _resolve_workspace_id(request)
    new_name = request.POST.get("workspace_name")
    selected_modules = request.POST.getlist("active_modules")
    update_workspace_layer1(ws_id, new_name=new_name, active_modules=selected_modules)
    context = _build_context(request)
    if request.headers.get("HX-Request") == "true":
        return render(request, "workspaces/partials/dashboard_content.html", context)
    return render(request, "workspaces/dashboard.html", context)
