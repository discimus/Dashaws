"""Tests for the sandbox globals."""
import pytest
from sandbox.globals import create_sandbox_globals


def test_create_globals_provides_state():
    globals_dict, output, state_ref = create_sandbox_globals(
        {"counter": 5}, {}, {}, {}, "http://localhost:3456/api"
    )
    assert "state" in globals_dict
    assert globals_dict["state"] == {"counter": 5}


def test_create_globals_provides_env():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {"KEY": "value"}, {}, {}, "http://localhost:3456/api"
    )
    assert globals_dict["env"] == {"KEY": "value"}


def test_create_globals_provides_secrets():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {"TOKEN": "secret"}, {}, "http://localhost:3456/api"
    )
    assert globals_dict["secrets"] == {"TOKEN": "secret"}


def test_create_globals_provides_props():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {"dry": True}, "http://localhost:3456/api"
    )
    assert globals_dict["props"] == {"dry": True}


def test_create_globals_provides_console():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {}, "http://localhost:3456/api"
    )
    console = globals_dict["console"]
    assert hasattr(console, "log")
    assert hasattr(console, "warn")
    assert hasattr(console, "error")
    assert hasattr(console, "info")
    assert hasattr(console, "table")


def test_console_log_captures_output():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {}, "http://localhost:3456/api"
    )
    globals_dict["console"].log("test message")
    assert len(output) == 1
    assert output[0]["type"] == "log"
    assert output[0]["args"][0] == "test message"


def test_state_is_mutable_and_returned():
    globals_dict, output, state_ref = create_sandbox_globals(
        {"a": 1}, {}, {}, {}, "http://localhost:3456/api"
    )
    globals_dict["state"]["b"] = 2
    assert state_ref["b"] == 2
    assert state_ref["a"] == 1


def test_create_globals_provides_queue():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {}, "http://localhost:3456/api"
    )
    assert hasattr(globals_dict["queue"], "enqueue")


def test_create_globals_provides_pubsub():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {}, "http://localhost:3456/api"
    )
    assert hasattr(globals_dict["pubsub"], "emit")


def test_create_globals_provides_requests():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {}, "http://localhost:3456/api"
    )
    assert "requests" in globals_dict
    req = globals_dict["requests"]
    assert hasattr(req, "get")
    assert hasattr(req, "post")
    assert hasattr(req, "put")
    assert hasattr(req, "delete")


def test_create_globals_provides_fetch():
    # fetch was removed — requests replaces it
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {}, "http://localhost:3456/api"
    )
    assert "fetch" not in globals_dict


def test_print_is_callable():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {}, "http://localhost:3456/api"
    )
    assert callable(globals_dict["print"])


def test_print_captures_output():
    globals_dict, output, state_ref = create_sandbox_globals(
        {}, {}, {}, {}, "http://localhost:3456/api"
    )
    globals_dict["print"]("hello from print")
    assert len(output) == 1
    assert output[0]["type"] == "log"
    assert output[0]["args"][0] == "hello from print"
