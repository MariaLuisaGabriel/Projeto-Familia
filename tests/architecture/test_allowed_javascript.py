"""R-60: JavaScript no repositório se limita ao service worker, ao HTMX fixado e a scripts pequenos.

Para permitir um arquivo novo, adicione-o em ALLOWED com a justificativa. Biblioteca nova exige ADR.
"""

import re

from ._paths import REPO_ROOT, iter_files

ALLOWED = [
    re.compile(
        r"src/estudos/ui/static/ui/js/htmx-\d+\.\d+\.\d+\.min\.js"
    ),  # HTMX com versão fixada
    re.compile(r"src/estudos/ui/static/ui/sw\.js"),  # service worker (etapa 5)
]

# Material de referência, não código do app (protótipo original).
REFERENCE_ONLY = re.compile(r"area_templates/[^/]+/fixtures/")


def test_only_allowed_javascript_files():
    found = [
        str(path.relative_to(REPO_ROOT))
        for path in iter_files(REPO_ROOT, ".js", ".mjs", ".ts", ".tsx", ".jsx")
    ]
    unexpected = [
        f for f in found if not REFERENCE_ONLY.match(f) and not any(p.fullmatch(f) for p in ALLOWED)
    ]

    assert not unexpected, "JavaScript não permitido (R-60):\n" + "\n".join(unexpected)
