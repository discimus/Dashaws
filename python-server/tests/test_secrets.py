"""Tests for secrets encryption/decryption."""
import pytest
from crypto.secrets import encrypt_secrets, decrypt_secrets, hash_password


def test_encrypt_and_decrypt():
    values = {"API_KEY": "my-secret-key-123"}
    password = "strong-password"
    blob = encrypt_secrets(values, password)
    assert "iv" in blob
    assert "data" in blob
    assert "salt" in blob
    assert "hash" in blob

    decrypted = decrypt_secrets(blob, password)
    assert decrypted == values


def test_decrypt_wrong_password():
    values = {"KEY": "value"}
    blob = encrypt_secrets(values, "correct-password")
    with pytest.raises(Exception):
        decrypt_secrets(blob, "wrong-password")


def test_encrypt_empty_dict():
    blob = encrypt_secrets({}, "password")
    assert "iv" in blob
    decrypted = decrypt_secrets(blob, "password")
    assert decrypted == {}


def test_hash_password():
    h1 = hash_password("password")
    h2 = hash_password("password")
    h3 = hash_password("different")
    assert h1 == h2
    assert h1 != h3
    assert len(h1) == 64  # SHA-256 hex


def test_encrypt_multiple_values():
    values = {"KEY1": "val1", "KEY2": "val2", "KEY3": "val3"}
    blob = encrypt_secrets(values, "pw")
    decrypted = decrypt_secrets(blob, "pw")
    assert decrypted == values
