"""Aislamiento entre cuentas: un padre nunca ve ni toca datos de otro."""

from __future__ import annotations

from tests.conftest import Client, make_client, register


def _setup_family(c: Client) -> tuple[str, str, str]:
    child = c.post("/api/children", json={"nickname": "Tomi", "avatar": "reno_brasita"}).json()
    letter = c.post(
        "/api/letters",
        json={"child_id": child["id"], "deseos": ["pelota"], "mensaje": "Hola Viejito"},
    ).json()
    sh = c.get(f"/api/children/{child['id']}/shipment").json()
    return child["id"], letter["id"], sh["id"]


def test_other_parent_cannot_access(parent: Client) -> None:
    child_id, letter_id, shipment_id = _setup_family(parent)

    with make_client() as intruso:
        register(intruso, "otro@example.com")
        assert intruso.get("/api/children").json() == []
        assert intruso.get("/api/letters").json() == []
        assert intruso.get(f"/api/letters/{letter_id}").status_code == 404
        assert (
            intruso.patch(
                f"/api/letters/{letter_id}", json={"texto_original": "hackeado"}
            ).status_code
            == 404
        )
        assert intruso.delete(f"/api/letters/{letter_id}").status_code == 404
        assert intruso.get(f"/api/children/{child_id}/shipment").status_code == 404
        assert (
            intruso.post(f"/api/shipments/{shipment_id}/stops", json={"nombre": "X"}).status_code
            == 404
        )
        r = intruso.post("/api/letters", json={"child_id": child_id, "mensaje": "hola"})
        assert r.status_code == 404

    letter = parent.get(f"/api/letters/{letter_id}").json()
    assert letter["texto_original"] != "hackeado"


def test_anonymous_gets_401(client: Client) -> None:
    for path in ("/api/children", "/api/letters", "/api/auth/me"):
        assert client.get(path).status_code == 401


def test_public_tracking_hides_private_data(parent: Client) -> None:
    child_id, _, _ = _setup_family(parent)
    sh = parent.get(f"/api/children/{child_id}/shipment").json()
    with make_client() as anon:
        r = anon.get(f"/api/tracking/{sh['share_code']}")
        assert r.status_code == 200
        body = r.json()
        assert set(body) == {"nickname", "avatar", "arrival_at", "server_time", "stops"}
        assert "mama@example.com" not in r.text
        assert anon.get("/api/tracking/no-existe").status_code == 404
