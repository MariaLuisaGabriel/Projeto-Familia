"""Views e fragmentos HTMX do módulo agenda (R-42, R-61, R-65)."""

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

from estudos.modules.workspaces.api import get_active_workspace, list_workspaces

from .services.create_event import create_event
from .services.list_events import list_events

SESSION_WORKSPACE_KEY = "active_workspace_id"


def _resolve_workspace(request: HttpRequest):
    ws_id = request.GET.get("ws") or request.session.get(SESSION_WORKSPACE_KEY)
    if request.GET.get("ws"):
        request.session[SESSION_WORKSPACE_KEY] = ws_id
    return get_active_workspace(ws_id)


def _build_agenda_context(
    request: HttpRequest,
    *,
    filter_type: str | None = None,
    selected_form_type: str | None = None,
) -> dict[str, object]:
    workspace = _resolve_workspace(request)
    active_type_key = selected_form_type or (
        workspace.event_types[0].key if workspace.event_types else ""
    )
    selected_event_type = next(
        (et for et in workspace.event_types if et.key == active_type_key),
        workspace.event_types[0] if workspace.event_types else None,
    )
    events = list_events(workspace, event_type_key=filter_type)
    return {
        "active_module": "agenda",
        "workspace": workspace,
        "all_workspaces": list_workspaces(),
        "events": events,
        "filter_type": filter_type or "",
        "selected_event_type": selected_event_type,
    }


@require_GET
def index(request: HttpRequest) -> HttpResponse:
    """Renderiza a página completa da agenda ou apenas o fragmento HTMX (R-61)."""
    filter_type = request.GET.get("type") or None
    context = _build_agenda_context(request, filter_type=filter_type)
    if request.headers.get("HX-Request") == "true":
        return render(request, "agenda/partials/agenda_content.html", context)
    return render(request, "agenda/index.html", context)


@require_GET
def event_type_fields(request: HttpRequest) -> HttpResponse:
    """Retorna os campos customizados dinâmicos para o EventType selecionado via HTMX (R-42)."""
    workspace = _resolve_workspace(request)
    type_key = request.GET.get("event_type_key", "")
    selected_event_type = next(
        (et for et in workspace.event_types if et.key == type_key),
        workspace.event_types[0] if workspace.event_types else None,
    )
    return render(
        request,
        "agenda/partials/event_form_fields.html",
        {"selected_event_type": selected_event_type},
    )


@require_POST
def create_event_view(request: HttpRequest) -> HttpResponse:
    """Processa a criação de um evento com seus campos customizados e atualiza a agenda."""
    workspace = _resolve_workspace(request)
    type_key = request.POST.get("event_type_key", "")
    title = request.POST.get("title", "")
    start_date = request.POST.get("start_date", "2026-11-16")
    start_time = request.POST.get("start_time", "09:00")

    event_type = next((et for et in workspace.event_types if et.key == type_key), None)
    custom_fields: dict[str, str] = {}
    if event_type:
        for field_spec in event_type.fields:
            raw_val = request.POST.get(f"custom_{field_spec.key}", "")
            if raw_val:
                custom_fields[field_spec.key] = raw_val

    if event_type:
        create_event(
            workspace,
            event_type_key=event_type.key,
            title=title,
            start_date=start_date,
            start_time=start_time,
            custom_fields=custom_fields,
        )

    context = _build_agenda_context(request, selected_form_type=type_key)
    if request.headers.get("HX-Request") == "true":
        return render(request, "agenda/partials/agenda_content.html", context)
    return render(request, "agenda/index.html", context)
