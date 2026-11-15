"""R-11 e R-43: termos de área específica só podem existir em area_templates/ e docs/."""

import re

from ._paths import REPO_ROOT, SRC, iter_files

FORBIDDEN_TERMS = re.compile(r"plant[aã]o|medicina|edital|residencia|residência", re.IGNORECASE)


def test_no_area_terms_in_source():
    offenders = [
        f"{path.relative_to(REPO_ROOT)}:{lineno}: {line.strip()}"
        for path in iter_files(SRC, ".py", ".html", ".css", ".js")
        if not path.name.endswith(".min.js")
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1)
        if FORBIDDEN_TERMS.search(line)
    ]

    assert not offenders, "Termos de área fora de area_templates/ (R-11):\n" + "\n".join(offenders)
