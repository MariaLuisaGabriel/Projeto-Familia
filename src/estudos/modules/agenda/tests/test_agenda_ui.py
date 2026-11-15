"""Testes de casos de uso e fragmentos HTMX do módulo agenda."""

from django.test import Client
from django.urls import reverse

from estudos.modules.agenda.api import create_event, list_events
from estudos.modules.workspaces.api import get_active_workspace


def test_create_event_validates_and_prepends_to_workspace_agenda():
    ws = get_active_workspace()
    first_type = ws.event_types[0]
    initial_count = len(list_events(ws))

    custom_values = {f.key: f.options[0] for f in first_type.fields if f.options}
    created = create_event(
        ws,
        event_type_key=first_type.key,
        title="Compromisso de Teste",
        start_date="2026-11-20",
        start_time="10:00",
        custom_fields=custom_values,
    )
    assert created.title == "Compromisso de Teste"
    assert len(list_events(ws)) == initial_count + 1


def test_agenda_views_render_full_page_and_dynamic_type_fields():
    client = Client()
    ws = get_active_workspace()
    first_type = ws.event_types[0]

    index_res = client.get(reverse("agenda:index"))
    assert index_res.status_code == 200

    fields_res = client.get(
        reverse("agenda:event_type_fields"),
        {"event_type_key": first_type.key},
        headers={"HX-Request": "true"},
    )
    assert fields_res.status_code == 200
