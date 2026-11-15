"""Testes do módulo workspaces e carregamento declarativo de templates de área."""

from django.test import Client
from django.urls import reverse

from estudos.modules.workspaces.api import (
    build_dashboard_widgets,
    get_active_workspace,
    list_workspaces,
)


def test_loads_all_area_templates_into_isolated_snapshots():
    workspaces = list_workspaces()
    assert len(workspaces) >= 3
    ws = get_active_workspace(workspaces[0].workspace_id)
    assert ws.template_version == "1.0.0"
    assert len(ws.event_types) >= 1


def test_builds_dashboard_widgets_from_workspace_metadata():
    ws = get_active_workspace()
    widgets = build_dashboard_widgets(ws, completed_items=2, total_items=8)
    assert len(widgets) == len(ws.dashboard_specs)
    assert any(w.base_key == "progress" and w.metric_value == "25%" for w in widgets)


def test_dashboard_view_renders_full_page_and_htmx_fragment():
    client = Client()
    url = reverse("workspaces:dashboard")

    full_res = client.get(url)
    assert full_res.status_code == 200
    html = full_res.content.decode("utf-8")
    assert "<html" in html
    assert "workspace-stage" in html

    htmx_res = client.get(url, headers={"HX-Request": "true"})
    assert htmx_res.status_code == 200
    fragment = htmx_res.content.decode("utf-8")
    assert "<html" not in fragment
    assert "module-shell" in fragment
