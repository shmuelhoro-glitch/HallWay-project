import os

from fastapi import Header, HTTPException


# Only our main server may call this service. It sends the shared secret in the
# "X-Internal-Key" header. FastAPI turns x_internal_key into that header name by itself.
def require_internal_key(x_internal_key: str | None = Header(default=None)):
    expected_key = os.environ.get("INTERNAL_API_KEY")

    # No key configured = nobody gets in (instead of everybody)
    if not expected_key or x_internal_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid internal key")
