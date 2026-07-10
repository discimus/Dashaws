# AGENTS.md — Dashaws Python Server

## Commands

| Purpose   | Command                                                       |
|-----------|---------------------------------------------------------------|
| Lint      | `ruff check script-dashboard/python-server`                   |
| Typecheck | `pyright script-dashboard/python-server`                      |
| Test      | `pytest script-dashboard/python-server/tests/ -q`             |

## Testing

All tests live in `python-server/tests/` and use `pytest-asyncio` for async endpoint/storage tests.

## Style

- Python 3.12.3+ with modern syntax: `str | None`, `dict[str, Any]` over `typing` equivalents
- f-strings over `.format()`
