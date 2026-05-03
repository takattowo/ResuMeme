import secrets


def generate_id() -> str:
    # secrets.token_urlsafe(6) produces 8 chars from 6 random bytes,
    # using the base64url alphabet (A-Z, a-z, 0-9, _, -).
    return secrets.token_urlsafe(6)
