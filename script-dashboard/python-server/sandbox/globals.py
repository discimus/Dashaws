"""Sandbox globals provided to user scripts with safe builtins."""
import builtins as _builtins
import json
import time
import uuid as _uuid
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, List, Set

# Import common libraries available to user scripts
import requests

# Modules blocked from import — operating-system-level access
_BLOCKED_MODULES: Set[str] = {
    "os", "subprocess", "sys", "shutil", "socket", "ctypes",
    "multiprocessing", "pty", "signal", "threading", "asyncio",
    "concurrent.futures", "gc", "faulthandler", "traceback",
    "pathlib", "glob", "tempfile", "pickle", "marshal", "shelve",
    "code", "codeop", "imp", "importlib", "pkgutil",
    "runpy", "tokenize", "webbrowser", "antigravity",
    "smtpd", "smtplib", "email",
}

# Allowed modules to import — everything except blocked ones,
# plus a curated allowlist for common data-science / web libraries.
# (Users can also import anything that passes the blocklist above.)


def _restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
    """Restricted __import__ that blocks OS-level access modules."""
    root = name.partition(".")[0]
    if root in _BLOCKED_MODULES:
        raise ImportError("Module '{}' is not available in the sandbox".format(name))
    return __import__(name, globals, locals, fromlist, level)


def _safe_open(file, mode="r", *args, **kwargs):
    """Restricted open() — only allows paths under /tmp and DATA_DIR."""
    import os as _os
    from pathlib import Path as _Path

    data_dir = _os.environ.get("DASHAWS_DATA_DIR", _os.path.join(_os.getcwd(), "data-python"))
    allowed_dirs = [
        _os.path.realpath(data_dir),
        _os.path.realpath(_os.environ.get("TMPDIR", _os.environ.get("TMP", "/tmp"))),
    ]
    resolved = _os.path.realpath(_os.path.abspath(str(file)))

    if any(resolved.startswith(d + _os.sep) or resolved == d for d in allowed_dirs):
        return _builtins.open(file, mode, *args, **kwargs)

    raise PermissionError("File access outside data/tmp directories is not allowed: {}".format(file))


def _build_safe_builtins(secrets_set: Set[str]) -> dict:
    """Build a safe subset of builtins with restricted __import__ and open."""
    safe: dict = {}

    # Safe constants
    for name in ("True", "False", "None", "Ellipsis", "NotImplemented"):
        safe[name] = getattr(_builtins, name)

    # Safe type/constructor functions
    for name in (
        "abs", "all", "any", "ascii", "bin", "bool", "bytearray", "bytes",
        "callable", "chr", "classmethod", "complex", "delattr", "dict",
        "dir", "divmod", "enumerate", "filter", "float", "format", "frozenset",
        "getattr", "globals", "hasattr", "hash", "hex", "id", "int",
        "isinstance", "issubclass", "iter", "len", "list", "locals", "map",
        "max", "memoryview", "min", "next", "object", "oct", "ord", "pow",
        "property", "range", "repr", "reversed", "round", "set",
        "setattr", "slice", "sorted", "staticmethod", "str", "sum",
        "super", "tuple", "type", "vars", "zip",
    ):
        safe[name] = getattr(_builtins, name)

    # Safe exception types (needed for try/except)
    for name in (
        "ArithmeticError", "AssertionError", "AttributeError",
        "BaseException", "BrokenPipeError", "BufferError",
        "ChildProcessError", "ConnectionAbortedError", "ConnectionError",
        "ConnectionRefusedError", "ConnectionResetError", "DeprecationWarning",
        "EOFError", "Exception", "FileExistsError", "FileNotFoundError",
        "FloatingPointError", "FutureWarning", "GeneratorExit",
        "ImportError", "ImportWarning", "IndentationError", "IndexError",
        "InterruptedError", "IsADirectoryError", "KeyError",
        "LookupError", "MemoryError", "ModuleNotFoundError",
        "NameError", "NotADirectoryError", "NotImplementedError",
        "OSError", "OverflowError", "PendingDeprecationWarning",
        "PermissionError", "ProcessLookupError", "RecursionError",
        "ReferenceError", "ResourceWarning", "RuntimeError",
        "RuntimeWarning", "StopAsyncIteration", "StopIteration",
        "SyntaxError", "SyntaxWarning", "SystemExit", "TabError",
        "TimeoutError", "TypeError", "UnboundLocalError",
        "UnicodeDecodeError", "UnicodeEncodeError", "UnicodeError",
        "UnicodeTranslateError", "UnicodeWarning", "UserWarning",
        "ValueError", "Warning", "ZeroDivisionError",
    ):
        safe[name] = getattr(_builtins, name)

    safe["__build_class__"] = _builtins.__build_class__
    safe["__import__"] = _restricted_import
    safe["open"] = _safe_open
    safe["print"] = _builtins.print  # Will be overridden in globals_dict

    # Intentionally excluded (dangerous):
    #   eval, exec, compile, breakpoint, input, help,
    #   copyright, credits, license
    return safe


def create_sandbox_globals(
    cell_state: Dict[str, Any],
    env: Dict[str, str],
    secrets_obj: Dict[str, str],
    props: Dict[str, Any],
    api_base: str,
):
    """Create globals dict for exec() that provides safe builtins, state, props, env, etc."""

    output: List[dict] = []
    secrets_set = set(v for v in (secrets_obj or {}).values() if v)

    def _mask_args(args):
        masked = []
        for a in args:
            s = str(a)
            for secret in secrets_set:
                if secret:
                    s = s.replace(secret, "\u2022" * len(secret))
            masked.append(s)
        return masked

    def log_entry(entry_type, args):
        output.append({
            "timestamp": int(time.time() * 1000),
            "type": entry_type,
            "args": _mask_args(args),
        })

    state = cell_state.copy() if isinstance(cell_state, dict) else {}
    safe_builtins = _build_safe_builtins(secrets_set)

    globals_dict: dict = {}
    globals_dict["__builtins__"] = safe_builtins
    globals_dict["print"] = _Print(log_entry)
    globals_dict["console"] = _Console(log_entry)
    globals_dict["requests"] = requests
    globals_dict["state"] = state
    globals_dict["props"] = props if isinstance(props, dict) else {}
    globals_dict["env"] = env if isinstance(env, dict) else {}
    globals_dict["secrets"] = secrets_obj if isinstance(secrets_obj, dict) else {}
    globals_dict["queue"] = _Queue(api_base, log_entry)
    globals_dict["pubsub"] = _PubSub(api_base, log_entry)
    globals_dict["True"] = True
    globals_dict["False"] = False
    globals_dict["None"] = None

    return globals_dict, output, state


class _Console:
    def __init__(self, log_entry_):
        self._log = log_entry_

    def log(self, *args):
        self._log("log", args)

    def warn(self, *args):
        self._log("warn", args)

    def error(self, *args):
        self._log("error", args)

    def info(self, *args):
        self._log("info", args)

    def table(self, *args):
        self._log("table", args)


class _Print:
    def __init__(self, log_entry_):
        self._log = log_entry_

    def __call__(self, *args, **kwargs):
        sep = kwargs.get("sep", " ")
        end = kwargs.get("end", "\n")
        text = sep.join(str(a) for a in args) + end
        # Split by end into individual log entries for proper newline handling
        self._log("log", (text.rstrip("\n"),))


class _Queue:
    def __init__(self, api_base, log_entry):
        self._api = api_base
        self._log = log_entry

    def enqueue(self, name, body):
        try:
            get_req = urllib.request.Request(self._api + "/queues", method="GET")
            with urllib.request.urlopen(get_req, timeout=5) as resp:
                queues = json.loads(resp.read().decode("utf-8"))
            if name not in queues:
                queues[name] = {
                    "name": name,
                    "maxRetries": 3,
                    "subscriberIds": [],
                    "messages": [],
                }
            msg_body = json.dumps(body) if not isinstance(body, str) else body
            queues[name]["messages"].append({
                "id": str(_uuid.uuid4()),
                "body": msg_body,
                "timestamp": int(time.time() * 1000),
                "retries": 0,
            })
            put_data = json.dumps(queues).encode("utf-8")
            req = urllib.request.Request(
                self._api + "/queues",
                data=put_data,
                headers={"Content-Type": "application/json"},
                method="PUT",
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            self._log("warn", ["queue.enqueue failed: {}".format(str(e))])


class _PubSub:
    def __init__(self, api_base, log_entry):
        self._api = api_base
        self._log = log_entry

    def emit(self, name, body):
        try:
            data = json.dumps(body).encode("utf-8")
            req = urllib.request.Request(
                self._api + "/topics/{}/emit".format(urllib.parse.quote(name, safe="")),
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            self._log("warn", ["pubsub.emit failed: {}".format(str(e))])
