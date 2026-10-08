"""The committed OpenAPI spec must match the app (D-062).

The backend generates its ai-service types from ai-service/openapi.json, so a model change
that isn't re-exported would leave Express typed against a contract that no longer exists.
"""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _exporter():
    spec = importlib.util.spec_from_file_location("export_openapi", ROOT / "scripts" / "export_openapi.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_committed_spec_matches_the_app():
    exporter = _exporter()
    committed = (ROOT / "openapi.json").read_text()
    assert committed == exporter.render(), (
        "ai-service/openapi.json is stale: run `python scripts/export_openapi.py`, "
        "then `npm run gen:ai-types` in backend/"
    )


def test_every_endpoint_the_backend_calls_has_a_typed_200():
    paths = _exporter().app.openapi()["paths"]
    called = [
        ("post", "/api/interview/next-question"),
        ("post", "/api/interview/evaluate-answer"),
        ("post", "/api/interview/generate-followup"),
        ("post", "/api/interview/generate-report"),
        ("post", "/api/speech/transcribe"),
        ("post", "/api/speech/evaluate-explanation"),
        ("post", "/api/system-design/analyze"),
        ("post", "/api/code-review/review"),
        ("post", "/api/recommendations/recommend"),
        ("post", "/api/resume/ingest"),
        ("delete", "/api/resume/{user_id}"),
    ]
    for method, path in called:
        schema = paths[path][method]["responses"]["200"]["content"]["application/json"]["schema"]
        assert "$ref" in schema, f"{method.upper()} {path} has an untyped 200"


def test_stream_endpoints_document_their_events():
    """Each event's data is typed, and nothing claims the stream is a plain string."""
    paths = _exporter().app.openapi()["paths"]
    for path in ("/api/interview/next-question/stream", "/api/interview/generate-followup/stream"):
        content = paths[path]["post"]["responses"]["200"]["content"]
        assert list(content) == ["text/event-stream"], path
        assert set(content["text/event-stream"]["schema"]) == {"$ref"}, path
