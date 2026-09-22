"""Unit tests for the deterministic parts of backend/social_poster/tools.py.

Anything that hits the network (image generation, GCS, URL fetches) is
faked out — these tests never make a real HTTP or GCP call.
"""

from backend.social_poster import tools


# --- check_text_length -------------------------------------------------------


def test_check_text_length_within_limit():
    result = tools.check_text_length("hello", limit=280)

    assert result == {
        "status": "success",
        "length": 5,
        "limit": 280,
        "within_limit": True,
        "over_by": 0,
    }


def test_check_text_length_over_limit():
    result = tools.check_text_length("x" * 300, limit=280)

    assert result["within_limit"] is False
    assert result["over_by"] == 20


def test_check_text_length_exactly_at_limit():
    result = tools.check_text_length("x" * 280, limit=280)

    assert result["within_limit"] is True
    assert result["over_by"] == 0


# --- use_provided_image_url --------------------------------------------------


def test_use_provided_image_url_rejects_non_http_scheme():
    result = tools.use_provided_image_url("ftp://example.com/image.png")

    assert result["status"] == "error"
    assert "not a valid http(s) url" in result["error"].lower()


def test_use_provided_image_url_rejects_relative_path():
    result = tools.use_provided_image_url("/local/path/image.png")

    assert result["status"] == "error"


# --- generate_image: the candidates[0] guard ---------------------------------


class _FakePart:
    def __init__(self, inline_data=None):
        self.inline_data = inline_data


class _FakeContent:
    def __init__(self, parts):
        self.parts = parts


class _FakeCandidate:
    def __init__(self, parts):
        self.content = _FakeContent(parts)


class _FakeResponse:
    def __init__(self, candidates):
        self.candidates = candidates


class _FakeModels:
    def __init__(self, response):
        self._response = response

    def generate_content(self, **kwargs):
        return self._response


class _FakeClient:
    def __init__(self, response):
        self.models = _FakeModels(response)


def test_generate_image_returns_error_when_no_candidates(monkeypatch):
    monkeypatch.setattr(tools.genai, "Client", lambda: _FakeClient(_FakeResponse(candidates=[])))

    result = tools.generate_image("a picture of a cat")

    assert result["status"] == "error"
    assert "no candidates" in result["error"].lower()


def test_generate_image_returns_error_when_candidate_has_no_image_part(monkeypatch):
    response = _FakeResponse(candidates=[_FakeCandidate(parts=[_FakePart(inline_data=None)])])
    monkeypatch.setattr(tools.genai, "Client", lambda: _FakeClient(response))

    result = tools.generate_image("a picture of a cat")

    assert result["status"] == "error"
    assert "no image data" in result["error"].lower()
