"""Testes do gerador linear determinístico e das views HTMX do módulo study."""

from django.test import Client
from django.urls import reverse

from estudos.modules.study.api import (
    generate_linear_schedule,
    get_study_progress,
    list_study_items,
    toggle_study_item,
)
from estudos.modules.workspaces.api import get_active_workspace


def test_linear_generator_is_deterministic_given_same_inputs():
    subjects = [
        ("Disciplina A", [("t1", "Tópico 1", 2), ("t2", "Tópico 2", 3)]),
        ("Disciplina B", [("t3", "Tópico 3", 1)]),
    ]
    run_a = generate_linear_schedule(
        workspace_id="ws-1",
        subjects_with_topics=subjects,
        items_per_week=2,
        item_type_key="leitura",
        item_type_label="Leitura",
    )
    run_b = generate_linear_schedule(
        workspace_id="ws-1",
        subjects_with_topics=subjects,
        items_per_week=2,
        item_type_key="leitura",
        item_type_label="Leitura",
    )
    assert run_a == run_b
    assert [item.week_number for item in run_a] == [1, 1, 2]


def test_toggle_study_item_updates_workspace_progress():
    ws = get_active_workspace()
    items = list_study_items(ws)
    assert len(items) > 0
    first_id = items[0].id
    initial_done, total = get_study_progress(ws)

    toggle_study_item(ws, first_id)
    after_done, _ = get_study_progress(ws)
    assert after_done != initial_done
    assert total == len(items)


def test_study_views_render_page_and_htmx_fragment():
    client = Client()
    res = client.get(reverse("study:index"))
    assert res.status_code == 200

    htmx_res = client.get(reverse("study:index"), headers={"HX-Request": "true"})
    assert htmx_res.status_code == 200
