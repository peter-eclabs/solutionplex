"""Password hashing utilities using Argon2id via pwdlib."""

from pwdlib import PasswordHash

# Single shared instance — thread-safe, reusable. Argon2id via recommended defaults.
_hasher = PasswordHash.recommended()


def hash_password(plain: str) -> str:
    """Hash a plaintext password with Argon2id.

    Args:
        plain: The plaintext password to hash.

    Returns:
        The Argon2id hash string.
    """
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a stored Argon2id hash.

    Args:
        plain: The plaintext password to verify.
        hashed: The stored hash to verify against.

    Returns:
        True if the password matches, False otherwise.
    """
    return _hasher.verify(plain, hashed)
