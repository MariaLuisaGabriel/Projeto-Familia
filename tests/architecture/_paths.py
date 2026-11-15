"""Caminhos usados pelas verificações de arquitetura."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SRC = REPO_ROOT / "src" / "estudos"
MODULES = SRC / "modules"

# Pastas que não são código do app (dependências, caches, material de referência).
IGNORED_DIRS = {".venv", ".git", "node_modules", "__pycache__", "staticfiles", ".ruff_cache"}


def iter_files(root: Path, *suffixes: str):
    for path in root.rglob("*"):
        if path.is_file() and path.suffix in suffixes and not IGNORED_DIRS & set(path.parts):
            yield path
