"""Tests for JSON parsing utilities."""
import pytest
from utils.parse import parse_params, parse_message_body


def test_parse_params_valid_json():
    assert parse_params('{"key": "value"}') == {"key": "value"}


def test_parse_params_invalid_json():
    assert parse_params("not json") == {}


def test_parse_params_empty_string():
    assert parse_params("") == {}


def test_parse_params_none():
    assert parse_params(None) == {}


def test_parse_params_array():
    assert parse_params("[1, 2, 3]") == {}


def test_parse_message_body_dict():
    assert parse_message_body({"a": 1}) == {"a": 1}


def test_parse_message_body_json_string():
    assert parse_message_body('{"a": 1}') == {"a": 1}


def test_parse_message_body_plain_string():
    assert parse_message_body("hello") == {}


def test_parse_message_body_none():
    assert parse_message_body(None) == {}
