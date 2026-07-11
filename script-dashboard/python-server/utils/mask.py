"""Secret masking utilities."""


def mask_value(value, secrets_set: set[str]):
    """Mask secret values in an arbitrary structure."""
    if secrets_set is None or len(secrets_set) == 0:
        return value
    if isinstance(value, str):
        return mask_string(value, secrets_set)
    if isinstance(value, dict):
        return {k: mask_value(v, secrets_set) for k, v in value.items()}
    if isinstance(value, list):
        return [mask_value(v, secrets_set) for v in value]
    return value


def mask_string(text: str, secrets_set: set[str]) -> str:
    """Replace secret values with bullet characters."""
    if not text:
        return text
    result = text
    for secret in secrets_set:
        if secret and len(secret) > 0:
            result = result.replace(secret, "\u2022" * min(len(secret), 12))
    return result


def mask_state(state: dict, secrets_set: set[str]) -> dict:
    """Mask all secret values in a state dict."""
    if not isinstance(state, dict):
        return state
    return {k: mask_value(v, secrets_set) for k, v in state.items()}
