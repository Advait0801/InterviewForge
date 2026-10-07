"""Write the ai-service OpenAPI spec to ai-service/openapi.json.

    docker compose exec ai-service python scripts/export_openapi.py

The committed file is the contract the backend generates its TypeScript types from
(`npm run gen:ai-types` in backend/). tests/test_openapi_snapshot.py fails until this is
re-run after any change to a request or response model (D-062).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

SNAPSHOT = Path(__file__).resolve().parents[1] / "openapi.json"


def render() -> str:
    return json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    SNAPSHOT.write_text(render())
    print(f"wrote {SNAPSHOT}")
