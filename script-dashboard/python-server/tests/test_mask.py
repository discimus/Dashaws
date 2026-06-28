"""Tests for secret masking."""
import pytest
from utils.mask import mask_string, mask_state, mask_value


def test_mask_string_replaces_secret():
    result = mask_string("token: secret123", {"secret123"})
    assert "secret123" not in result
    assert "\u2022" in result


def test_mask_string_no_secrets():
    result = mask_string("hello world", set())
    assert result == "hello world"


def test_mask_string_empty_input():
    assert mask_string("", {"secret"}) == ""
    assert mask_string(None, {"secret"}) is None


def test_mask_state_recursive():
    state = {
        "token": "secret123",
        "nested": {"key": "secret123"},
        "list": ["a", "secret123"],
    }
    result = mask_state(state, {"secret123"})
    assert "secret123" not in str(result)
    assert "\u2022" in str(result)


def test_mask_value_handles_primitives():
    assert mask_value(42, {"secret"}) == 42
    assert mask_value(True, {"secret"}) is True
    assert mask_value(None, {"secret"}) is None


def test_mask_value_empty_set():
    result = mask_value("hello", set())
    assert result == "hello"


def test_mask_multiple_secrets():
    result = mask_string("a: sec1, b: sec2", {"sec1", "sec2"})
    assert "sec1" not in result
    assert "sec2" not in result
