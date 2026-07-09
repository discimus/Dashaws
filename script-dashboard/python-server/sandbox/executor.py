"""Script executor using exec() for sandboxed code execution."""
import asyncio
import re
import traceback
from typing import Dict, Any, List

from sandbox.globals import create_sandbox_globals
from utils.mask import mask_state


_JS_COMMENT_RE = re.compile(r'^\s*//', re.MULTILINE)

_JS_PATTERNS = [
    (_JS_COMMENT_RE, "// comment → use # for Python comments"),
    (r'===', "=== (JS strict equality) → use == in Python"),
    (r'!==', "!== (JS strict inequality) → use != in Python"),
    (r'(?<!\w)let\s+\w+\s*=', "let → remove it (Python assignment needs no keyword)"),
    (r'(?<!\w)const\s+\w+\s*=', "const → remove it (Python assignment needs no keyword)"),
    (r'(?<!\w)var\s+\w+\s*=', "var → remove it (Python assignment needs no keyword)"),
    (r'(?<!\w)function\s+\w+\s*\(', "function → use def in Python"),
]


def _check_js_patterns(script: str, output: list):
    """Scan for common JavaScript syntax in Python scripts and emit warnings."""
    seen = set()
    for pattern, hint in _JS_PATTERNS:
        if isinstance(pattern, re.Pattern):
            match = pattern.search(script)
        else:
            match = re.search(pattern, script)
        if match and hint not in seen:
            output.append({
                "timestamp": int(__import__("time").time() * 1000),
                "type": "warn",
                "args": ["JS syntax detected: {}".format(hint)],
            })
            seen.add(hint)


async def execute_script(
    script: str,
    cell_state: Dict[str, Any],
    env: Dict[str, str],
    secrets_obj: Dict[str, str],
    props: Dict[str, Any],
    api_base: str,
    timeout: float = 0.0,
) -> dict:
    """Execute a Python script in a sandbox with optional timeout. Returns ExecutionResult-compatible dict."""
    secrets_set = set(v for v in (secrets_obj or {}).values() if v)

    globals_dict, output, state_ref = create_sandbox_globals(
        cell_state, env, secrets_obj, props, api_base
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
            error = "Timed out after {}s".format(timeout)
            output.append({
                "timestamp": int(__import__("time").time() * 1000),
                "type": "error",
                "args": ["Script timed out after {}s".format(timeout)],
            })
        except Exception as e:
            success = False
            tb = traceback.format_exc()
            error = "{}: {}".format(type(e).__name__, str(e))
            output.append({
                "timestamp": int(__import__("time").time() * 1000),
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
            error = "{}: {}".format(type(e).__name__, str(e))
            output.append({
                "timestamp": int(__import__("time").time() * 1000),
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
