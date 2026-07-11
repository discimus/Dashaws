"""JSON parsing utilities."""
import json


def parse_params(params_str: str | None) -> dict:
    """Parse params JSON string, returning empty dict on failure."""
    try:
        parsed = json.loads(params_str) if params_str else {}
        if isinstance(parsed, dict):
            return parsed
        return {}
    except (json.JSONDecodeError, TypeError):
        return {}


def parse_message_body(body) -> dict:
    """Parse a message body string, returning dict on success or the string itself."""
    if body is None:
        return {}
    if isinstance(body, dict):
        return body
    if not isinstance(body, str):
        return {}
    try:
        parsed = json.loads(body)
        if isinstance(parsed, dict):
            return parsed
        return {}
    except (json.JSONDecodeError, TypeError):
        return {}
