"""Secrets encryption using PBKDF2 + AES-GCM 256-bit."""
import os
import json
import hashlib
from base64 import b64encode, b64decode

from Crypto.Protocol.KDF import PBKDF2
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Hash import SHA256

PBKDF2_ITERATIONS = 200000
PBKDF2_KEY_LEN = 32  # 256 bits
AES_KEY_LEN = 32
IV_LEN = 12
SALT_LEN = 16


def _derive_key(password: str, salt: bytes) -> bytes:
    """Derive AES key from password using PBKDF2."""
    return PBKDF2(
        password.encode("utf-8"),
        salt,
        dkLen=PBKDF2_KEY_LEN,
        count=PBKDF2_ITERATIONS,
        hmac_hash_module=SHA256,
    )


def encrypt_secrets(values: dict, password: str) -> dict:
    """Encrypt a secrets dict with password. Returns blob dict."""
    if not values:
        values = {}

    salt = get_random_bytes(SALT_LEN)
    key = _derive_key(password, salt)
    iv = get_random_bytes(IV_LEN)

    plaintext = json.dumps(values).encode("utf-8")

    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)

    # Combine ciphertext + tag for transport
    data = b64encode(ciphertext + tag).decode("ascii")

    # Store password hash for verification (SHA-256 of password)
    pw_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()

    return {
        "iv": b64encode(iv).decode("ascii"),
        "data": data,
        "salt": b64encode(salt).decode("ascii"),
        "hash": pw_hash,
    }


def decrypt_secrets(blob: dict, password: str) -> dict:
    """Decrypt a secrets blob with password. Returns values dict."""
    salt = b64decode(blob["salt"])
    iv = b64decode(blob["iv"])
    data = b64decode(blob["data"])

    key = _derive_key(password, salt)

    # Split ciphertext and tag (tag is last 16 bytes)
    tag_len = 16
    ciphertext = data[:-tag_len]
    tag = data[-tag_len:]

    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    plaintext = cipher.decrypt_and_verify(ciphertext, tag)

    return json.loads(plaintext.decode("utf-8"))


def hash_password(password: str) -> str:
    """Return SHA-256 hex digest of password for verification."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()
