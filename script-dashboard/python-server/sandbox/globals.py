"""Sandbox globals provided to user scripts."""
import json
import time
import uuid as _uuid
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, List

# Import common libraries available to user scripts
import requests


def create_sandbox_globals(
    cell_state: Dict[str, Any],
    env: Dict[str, str],
    secrets_obj: Dict[str, str],
    props: Dict[str, Any],
    api_base: str,
):
    """Create globals dict for exec() that provides state, props, env, etc."""

    output: List[dict] = []

    def log_entry(entry_type, args):
        output.append({
            "timestamp": int(time.time() * 1000),
            "type": entry_type,
            "args": [str(a) for a in args],
        })

    state = cell_state.copy() if isinstance(cell_state, dict) else {}

    globals_dict = {
        "__builtins__": __builtins__,
        "print": _Print(log_entry),
        "console": _Console(log_entry),
        "requests": requests,
        "state": state,
        "props": props if isinstance(props, dict) else {},
        "env": env if isinstance(env, dict) else {},
        "secrets": secrets_obj if isinstance(secrets_obj, dict) else {},
        "queue": _Queue(api_base, log_entry),
        "pubsub": _PubSub(api_base, log_entry),
        "True": True,
        "False": False,
        "None": None,
    }

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
        self._log("log", args)


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
