"""Script executor using exec() for sandboxed code execution."""
import asyncio
import re
import time
import traceback

from sandbox.globals import create_sandbox_globals
from utils.mask import mask_state


_JS_COMMENT_RE = re.compile(r'^\s*//', re.MULTILINE)

_JS_PATTERNS: list[tuple[re.Pattern | str, str]] = [
    (_JS_COMMENT_RE, "// comment → use # for Python comments"),
    (r'===', "=== (JS strict equality) → use == in Python"),
    (r'!==', "!== (JS strict inequality) → use != in Python"),
    (r'(?<!\w)let\s+\w+\s*=', "let → remove it (Python assignment needs no keyword)"),
    (r'(?<!\w)const\s+\w+\s*=', "const → remove it (Python assignment needs no keyword)"),
    (r'(?<!\w)var\s+\w+\s*=', "var → remove it (Python assignment needs no keyword)"),
    (r'(?<!\w)function\s+\w+\s*\(', "function → use def in Python"),
]


def _check_js_patterns(script: str, output: list[dict]) -> None:
    """Scan for common JavaScript syntax in Python scripts and emit warnings."""
    seen: set[str] = set()
    for pattern, hint in _JS_PATTERNS:
        if isinstance(pattern, re.Pattern):
            match = pattern.search(script)
        else:
            match = re.search(pattern, script)
        if match and hint not in seen:
            output.append({
                "timestamp": int(time.time() * 1000),
                "type": "warn",
                "args": [f"JS syntax detected: {hint}"],
            })
            seen.add(hint)


async def execute_script(
    script: str,
    cell_state: dict[str, object],
    env: dict[str, str],
    secrets_obj: dict[str, str],
    props: dict[str, object],
    enqueue_fn,
    emit_fn,
    timeout: float = 0.0,
) -> dict:
    """Execute a Python script in a sandbox with optional timeout. Returns ExecutionResult-compatible dict."""
    secrets_set = set(v for v in (secrets_obj or {}).values() if v)

    globals_dict, output, state_ref = create_sandbox_globals(
        cell_state, env, secrets_obj, props, enqueue_fn, emit_fn
    )

    _check_js_patterns(script, output)

    success = True
    error = None

    if timeout and timeout > 0:
        compiled = compile(script, "<script>", "exec")
        try:
            await asyncio.wait_for(
                asyncio.to_thread(exec, compiled, globals_dict),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            success = False
            error = f"Timed out after {timeout}s"
            output.append({
                "timestamp": int(time.time() * 1000),
                "type": "error",
                "args": [f"Script timed out after {timeout}s"],
            })
        except Exception as e:
            success = False
            tb = traceback.format_exc()
            error = f"{type(e).__name__}: {e}"
            output.append({
                "timestamp": int(time.time() * 1000),
                "type": "error",
                "args": [tb],
            })
    else:
        try:
            compiled = compile(script, "<script>", "exec")
            exec(compiled, globals_dict)
        except Exception as e:
            success = False
            tb = traceback.format_exc()
            error = f"{type(e).__name__}: {e}"
            output.append({
                "timestamp": int(time.time() * 1000),
                "type": "error",
                "args": [tb],
            })

    final_state = globals_dict.get("state", state_ref)
    if final_state is None or not isinstance(final_state, dict):
        final_state = {}

    masked = mask_state(final_state, secrets_set)

    return {
        "success": success,
        "error": error,
        "output": output,
        "state": masked,
    }
