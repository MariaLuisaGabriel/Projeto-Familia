"""Lint dos templates HTML e do código de interface.

- R-49: o autoescape não é desligado (`|safe`, `mark_safe`, `{% autoescape off %}`).
- R-65: URLs vêm de `{% url %}`, nunca de caminho escrito à mão (inclusive `hx-*`).
"""

import re

from django.conf import settings

from ._paths import REPO_ROOT, SRC, iter_files

UNSAFE = re.compile(r"\|\s*safe\b|mark_safe\s*\(|{%\s*autoescape\s+off")
# href/action/hx-get... cujo valor começa com "/" literal (e não com {% url %}).
LITERAL_URL = re.compile(r"""\b(?:href|action|hx-(?:get|post|put|patch|delete))\s*=\s*["']/""")

# Exceções explícitas, com justificativa. Formato: "caminho/relativo:padrão".
UNSAFE_ALLOWLIST: set[str] = set()


def _lines(suffixes: tuple[str, ...]):
    for path in iter_files(SRC, *suffixes):
        rel = str(path.relative_to(REPO_ROOT))
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            yield rel, lineno, line


def test_autoescape_is_never_disabled():
    offenders = [
        f"{rel}:{lineno}: {line.strip()}"
        for rel, lineno, line in _lines((".html", ".py"))
        if UNSAFE.search(line) and rel not in UNSAFE_ALLOWLIST and not rel.startswith("tests/")
    ]

    assert not offenders, "Autoescape desligado para conteúdo (R-49):\n" + "\n".join(offenders)


def test_autoescape_not_disabled_in_settings():
    for engine in settings.TEMPLATES:
        assert engine.get("OPTIONS", {}).get("autoescape", True) is True


def test_urls_are_generated_by_name():
    offenders = [
        f"{rel}:{lineno}: {line.strip()}"
        for rel, lineno, line in _lines((".html",))
        if LITERAL_URL.search(line)
    ]

    assert not offenders, "URL escrita à mão; use {% url %} (R-65):\n" + "\n".join(offenders)
