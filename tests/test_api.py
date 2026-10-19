import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models import Pagamento

# Banco SQLite em memória dedicado aos testes com StaticPool para compartilhar a mesma conexão
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine_test = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine_test)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine_test)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_status_endpoint(client):
    """Testa se o endpoint /status retorna ativo e informações da aplicação."""
    response = client.get("/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ativo"
    assert data["app"] == "VeloxPay"
    assert "database" in data


def test_criar_pagamento_pix_aplica_desconto_10_porcento(client):
    """Valida regra de negócio: Pix ganha 10% de desconto e status Aprovado."""
    payload = {
        "id_pedido": 101,
        "valor_total": 100.00,
        "metodo_pagamento": "Pix"
    }
    response = client.post("/pagamentos", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id_pedido"] == 101
    assert data["valor_original"] == 100.00
    assert data["desconto"] == 10.00
    assert data["valor_total"] == 90.00
    assert data["metodo_pagamento"] == "Pix"
    assert data["status_pagamento"] == "Aprovado"


def test_criar_pagamento_dinheiro_sem_desconto_aprovado(client):
    """Valida regra de negócio: Dinheiro não tem desconto e é sempre Aprovado."""
    payload = {
        "id_pedido": 102,
        "valor_total": 50.00,
        "metodo_pagamento": "Dinheiro"
    }
    response = client.post("/pagamentos", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id_pedido"] == 102
    assert data["desconto"] == 0.00
    assert data["valor_total"] == 50.00
    assert data["status_pagamento"] == "Aprovado"


def test_criar_pagamento_duplicado_retorna_409(client):
    """Valida prevenção de duplicidade de pedido com código HTTP 409 Conflict."""
    payload = {
        "id_pedido": 200,
        "valor_total": 45.00,
        "metodo_pagamento": "Cartão"
    }
    res1 = client.post("/pagamentos", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/pagamentos", json=payload)
    assert res2.status_code == 409
    assert "já existe" in res2.json()["detail"]


def test_validacao_valor_negativo_ou_zero_rejeitado(client):
    """Garante que pagamentos com valor <= 0 sejam rejeitados com HTTP 422."""
    payload_negativo = {
        "id_pedido": 301,
        "valor_total": -25.00,
        "metodo_pagamento": "Pix"
    }
    res_negativo = client.post("/pagamentos", json=payload_negativo)
    assert res_negativo.status_code == 422

    payload_zero = {
        "id_pedido": 302,
        "valor_total": 0.00,
        "metodo_pagamento": "Pix"
    }
    res_zero = client.post("/pagamentos", json=payload_zero)
    assert res_zero.status_code == 422


def test_consultar_pagamento_por_id_existente_e_inexistente(client):
    """Testa consulta por ID do pedido e retorno 404 quando não encontrado."""
    client.post("/pagamentos", json={
        "id_pedido": 500,
        "valor_total": 75.50,
        "metodo_pagamento": "Cartão"
    })

    # Consulta existente
    res_ok = client.get("/pagamentos/500")
    assert res_ok.status_code == 200
    assert res_ok.json()["id_pedido"] == 500

    # Consulta inexistente
    res_404 = client.get("/pagamentos/999999")
    assert res_404.status_code == 404
    assert "não foi encontrado" in res_404.json()["detail"]


def test_listar_pagamentos_com_paginacao_e_cabecalhos(client):
    """Testa endpoint de listagem com parâmetros limit e cabeçalhos X-Total-Count."""
    for i in range(1, 6):
        client.post("/pagamentos", json={
            "id_pedido": 1000 + i,
            "valor_total": 20.00 * i,
            "metodo_pagamento": "Pix"
        })

    response = client.get("/pagamentos?limit=3&offset=0")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 3
    assert response.headers.get("X-Total-Count") == "5"
    assert response.headers.get("X-Limit") == "3"


def test_resumo_metricas_estatisticas(client):
    """Testa se as métricas consolidadas refletem os pagamentos criados."""
    client.post("/pagamentos", json={"id_pedido": 801, "valor_total": 100.00, "metodo_pagamento": "Pix"})
    client.post("/pagamentos", json={"id_pedido": 802, "valor_total": 50.00, "metodo_pagamento": "Dinheiro"})

    res = client.get("/pagamentos/stats/resumo")
    assert res.status_code == 200
    metricas = res.json()
    assert metricas["total_transacoes"] == 2
    assert metricas["aprovados"] == 2
    assert metricas["economia_pix"] == 10.00
    assert metricas["total_arrecadado"] == 140.00  # 90.00 do Pix + 50.00 do Dinheiro
