import json
from types import SimpleNamespace

import pytest

from shared import llm_client


def test_ai_request_is_bounded_and_not_retried(monkeypatch):
    client_options = {}
    request = {}
    calls = []
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"hero": {"bio": "ok"}})))],
        usage=None,
    )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            client_options.update(kwargs)

            def create(**create_kwargs):
                calls.append(create_kwargs)
                request.update(create_kwargs)
                return response

            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

    monkeypatch.setattr(llm_client, "AzureOpenAI", FakeOpenAI)
    monkeypatch.setattr(llm_client, "_SDK_OK", True)
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.test")
    monkeypatch.setenv("AZURE_OPENAI_KEY", "test-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-test")

    result = llm_client.generate_portfolio(
        "x" * 10_000,
        "n" * 10_000,
        [{"heading": "Experience", "canonical": "experience", "body": "b" * 10_000}],
        "modern",
    )

    policy, source_prompt = request["messages"]
    assert result is not None
    assert len(calls) == 1
    assert client_options["timeout"] == 25
    assert client_options["max_retries"] == 0
    assert client_options["api_version"] == "2025-04-01-preview"
    assert policy["role"] == "system"
    assert source_prompt["role"] == "user"
    assert "n" * 200 in source_prompt["content"] and "n" * 201 not in source_prompt["content"]
    source = source_prompt["content"].split("<<<BEGIN CV SOURCE>>>\n", 1)[1].split(
        "\n<<<END CV SOURCE>>>", 1
    )[0]
    assert len(source) == 6000
    assert source.startswith("RAW CV HEADER EXCERPT:\n" + "x" * 2000)
    assert "PARSED CV SECTIONS:\n### Experience" in source
    assert request["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize(
    ("mode", "voice"),
    [
        ("modern", "concise, confident contemporary portfolio"),
        ("professional", "restrained executive and editorial portfolio"),
        ("chaos", "fabrication is part of the satire"),
    ],
)
def test_prompt_has_mode_specific_guidance(monkeypatch, mode, voice):
    request = {}
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content='{"hero":{"bio":"ok"}}'))],
        usage=None,
    )

    def create(**kwargs):
        request.update(kwargs)
        return response

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(llm_client, "_client", lambda: client)
    monkeypatch.setattr(llm_client, "_deployment", lambda: "test-model")

    result = llm_client.generate_portfolio(
        "Jane Doe\nSoftware Engineer\nExperience at Example Corp",
        "Jane Doe",
        None,
        mode=mode,
    )

    policy = request["messages"][0]["content"].lower()
    source_prompt = request["messages"][1]["content"].lower()
    assert result is not None
    assert request["messages"][0]["role"] == "system"
    assert request["messages"][1]["role"] == "user"
    assert "untrusted cv data" in source_prompt
    assert f"mode: {mode}" in policy
    assert voice in policy
    if mode in ("modern", "professional"):
        assert "actual human name and actual professional title" in policy
        assert "page numbers, revision dates, confidentiality notices, copyright headers" in policy
        assert "never invent employers, projects, dates, degrees, credentials, metrics" in policy
        assert "availability, rates, quotes, testimonials, or contact data" in policy
        assert "stats only for explicit source facts" in policy
        assert "selectedwork only from real source work or projects" in policy
    else:
        assert "you may invent client names, project names, metrics" in policy
        assert "fake awards" in policy
        assert "must not reuse any person or organization from the cv" in policy


def test_null_and_container_scalars_normalize_to_empty_strings(monkeypatch):
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
            "identity": {"name": None, "title": ["not", "text"]},
            "hero": {"bio": "Valid profile"},
            "contact": {"availability": None, "rate": {}, "blurb": ""},
        })))],
        usage=None,
    )
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **_kwargs: response
    )))
    monkeypatch.setattr(llm_client, "_client", lambda: client)
    monkeypatch.setattr(llm_client, "_deployment", lambda: "test-model")

    result = llm_client.generate_portfolio("Jane Doe", "Jane Doe", None, "modern")

    assert result["identity"]["name"] == ""
    assert result["identity"]["title"] == ""
    assert result["contact"] == {"availability": "", "rate": "", "blurb": ""}
