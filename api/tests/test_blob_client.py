import pytest

from shared.blob_client import BlobClient

CONN = "UseDevelopmentStorage=true"
CONTAINER = "cv-uploads-test"


@pytest.fixture
def client() -> BlobClient:
    bc = BlobClient(connection_string=CONN, container=CONTAINER)
    bc.ensure_container()
    return bc


def test_write_and_read_json(client: BlobClient):
    payload = {"id": "abc12345", "hello": "world"}
    client.write_json("abc12345.json", payload)
    got = client.read_json("abc12345.json")
    assert got == payload


def test_write_image_returns_blob_path(client: BlobClient):
    path = client.write_image("abc12345/img_0", b"\x89PNG\r\n\x1a\nfake", "image/png")
    assert path == "abc12345/img_0"


def test_generate_read_sas_returns_url(client: BlobClient):
    client.write_image("abc12345/img_sas", b"data", "image/png")
    url = client.generate_read_sas("abc12345/img_sas", minutes=10)
    assert url.startswith("http")
    assert "sig=" in url


def test_read_json_missing_blob_raises(client: BlobClient):
    with pytest.raises(FileNotFoundError):
        client.read_json("does-not-exist.json")
