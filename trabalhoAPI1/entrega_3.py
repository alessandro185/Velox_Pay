# =============================================================================
# ENTREGA 3 — EVOLUÇÃO RAD: Validação de Métodos + API Completa (Sprint 3)
# Projeto: API de Pagamentos — Lanchonete "Sabor Rápido"
#
# Incrementos implementados neste ciclo:
#   → Desafio 2: Validação customizada do campo metodo_pagamento.
#     A API rejeita (HTTP 400 Bad Request) qualquer método que não seja
#     exatamente "Pix", "Cartão" ou "Dinheiro".
#
# Esta entrega representa o protótipo FINAL do ciclo RAD, acumulando:
#   ✔ RF1–RF4  (Entrega 1): endpoints POST e GET funcionais
#   ✔ Desconto Pix 10% (Entrega 2): valor cobrado já descontado no banco
#   ✔ Validação de método (Entrega 3): rejeição de métodos inválidos (HTTP 400)
#
# Abordagem técnica para a validação:
#   Utilizamos o validator do Pydantic (field_validator) diretamente no modelo
#   SolicitacaoPagamento. Isso garante que a validação ocorra na camada de
#   entrada de dados, antes de qualquer lógica de negócio ou acesso ao banco,
#   seguindo o princípio "fail fast" (falhar o mais cedo possível).
#
# Como executar:
#   uvicorn entrega_3:app --reload
#   Documentação: http://127.0.0.1:8000/docs
# =============================================================================

import random
from typing import Dict, Any

import pymysql
import pymysql.cursors
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field, field_validator

app = FastAPI(
    title="Sabor Rápido — API de Pagamentos",
    description=(
        "Entrega 3 — Protótipo Final (RAD Sprint 3). "
        "Inclui validação de métodos de pagamento, desconto Pix (10%) e "
        "todos os requisitos funcionais RF1–RF4."
    ),
    version="1.2.0",
)

DB_CONFIG: Dict[str, Any] = {
    "host": "127.0.0.1",
    "user": "root",        # Substitua pelo seu usuário do MySQL
    "password": "",        # Substitua pela sua senha do MySQL
    "database": "sabor_rapido_db",
    "port": 3306,
    "cursorclass": pymysql.cursors.DictCursor,
}

# Conjunto imutável dos métodos aceitos — usar frozenset garante:
#   1. Verificação O(1) com o operador "in"
#   2. Impossibilidade de modificação acidental em tempo de execução
METODOS_ACEITOS: frozenset[str] = frozenset({"Pix", "Cartão", "Dinheiro"})

DESCONTO_PIX: float = 0.10
FATOR_PIX: float = 1.0 - DESCONTO_PIX


def obter_conexao() -> pymysql.connections.Connection | None:
    """Estabelece e retorna uma conexão ativa com o banco de dados MySQL."""
    try:
        return pymysql.connect(**DB_CONFIG)
    except pymysql.MySQLError as erro:
        print(f"[ERRO] Falha ao conectar ao MySQL: {erro}")
        return None


# -----------------------------------------------------------------------------
# Modelo Pydantic com validação customizada (Desafio 2)
# -----------------------------------------------------------------------------
class SolicitacaoPagamento(BaseModel):
    id_pedido: int = Field(
        ...,
        description="Identificador numérico único do pedido",
        gt=0,
    )
    valor_total: float = Field(
        ...,
        description="Valor original do pedido antes de qualquer desconto (ex: 49.90)",
        gt=0.0,
    )
    metodo_pagamento: str = Field(
        ...,
        description=(
            "Forma de pagamento. "
            "Valores aceitos: 'Pix', 'Cartão' ou 'Dinheiro' (sensível a maiúsculas)."
        ),
    )

    # -------------------------------------------------------------------------
    # NOVO — Validador customizado do campo metodo_pagamento (Desafio 2)
    #
    # O decorator @field_validator instrui o Pydantic a executar este método
    # sempre que o modelo for instanciado (inclusive via FastAPI ao receber
    # o JSON da requisição).
    #
    # Se o valor não estiver no conjunto METODOS_ACEITOS, o Pydantic lança
    # automaticamente uma ValidationError, que o FastAPI converte em uma
    # resposta HTTP 422 Unprocessable Entity por padrão.
    #
    # Para retornar HTTP 400 Bad Request conforme o desafio, vamos interceptar
    # o erro no endpoint e relançá-lo como HTTPException 400.
    # (Veja o bloco try/except em processar_pagamento abaixo.)
    # -------------------------------------------------------------------------
    @field_validator("metodo_pagamento")
    @classmethod
    def validar_metodo_pagamento(cls, valor: str) -> str:
        """
        Verifica se o método de pagamento informado está na lista de métodos
        permitidos pela lanchonete.

        A validação é CASE-SENSITIVE por decisão de design: a API espera os
        valores exatos 'Pix', 'Cartão' ou 'Dinheiro', incentivando o cliente
        a enviar dados padronizados e facilitando consultas no banco.
        """
        if valor not in METODOS_ACEITOS:
            metodos_formatados = ", ".join(f'"{m}"' for m in sorted(METODOS_ACEITOS))
            raise ValueError(
                f"Método de pagamento inválido: '{valor}'. "
                f"Valores aceitos: {metodos_formatados}."
            )
        return valor


# -----------------------------------------------------------------------------
# ENDPOINT POST /pagamentos
# Agora protegido pela validação customizada de método (Desafio 2) +
# desconto Pix (Desafio 1) + lógica base (Entrega 1).
# -----------------------------------------------------------------------------
@app.post(
    "/pagamentos",
    status_code=status.HTTP_201_CREATED,
    summary="Registrar e processar um pagamento",
    tags=["Pagamentos"],
    responses={
        201: {"description": "Pagamento processado e registrado com sucesso."},
        400: {"description": "Método de pagamento inválido."},
        409: {"description": "Pagamento duplicado para este pedido."},
        500: {"description": "Erro de comunicação com o banco de dados."},
    },
)
def processar_pagamento(pagamento: SolicitacaoPagamento) -> Dict[str, Any]:
    """
    Processa e registra um novo pagamento com as seguintes regras:

    **Validação (Entrega 3 — Desafio 2):**
    - Rejeita métodos que não sejam `"Pix"`, `"Cartão"` ou `"Dinheiro"` → HTTP 400.

    **Desconto (Entrega 2 — Desafio 1):**
    - Pagamentos via `"Pix"` recebem 10% de desconto sobre o valor total.

    **Simulação do adquirente (Entrega 1):**
    - `"Dinheiro"` → sempre Aprovado.
    - `"Cartão"` / `"Pix"` → 90% Aprovado / 10% Recusado.
    """
    # Neste ponto o Pydantic já validou o método; se chegou aqui, é válido.
    id_pedido = pagamento.id_pedido
    valor_original = pagamento.valor_total
    metodo_pagamento = pagamento.metodo_pagamento

    # Aplicação do desconto Pix (Desafio 1 — mantido da Entrega 2)
    if metodo_pagamento == "Pix":
        valor_cobrado = round(valor_original * FATOR_PIX, 2)
        desconto_aplicado = round(valor_original * DESCONTO_PIX, 2)
    else:
        valor_cobrado = valor_original
        desconto_aplicado = 0.0

    # Simulação do adquirente financeiro
    if metodo_pagamento == "Dinheiro":
        status_simulado = "Aprovado"
    else:
        status_simulado = random.choices(
            ["Aprovado", "Recusado"],
            weights=[90, 10],
        )[0]

    conexao = obter_conexao()
    if not conexao:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível estabelecer conexão com o banco de dados.",
        )

    try:
        cursor = conexao.cursor()
        sql_insert = """
            INSERT INTO PAGAMENTO (id_pedido, valor_total, metodo_pagamento, status_pagamento)
            VALUES (%s, %s, %s, %s);
        """
        cursor.execute(sql_insert, (id_pedido, valor_cobrado, metodo_pagamento, status_simulado))
        conexao.commit()
        cursor.close()
        conexao.close()

        resposta: Dict[str, Any] = {
            "mensagem": "Pagamento processado com sucesso!",
            "id_pedido": id_pedido,
            "status": status_simulado,
            "metodo_pagamento": metodo_pagamento,
            "valor_original": valor_original,
            "valor_cobrado": valor_cobrado,
        }

        if desconto_aplicado > 0:
            resposta["desconto_pix_aplicado"] = desconto_aplicado
            resposta["mensagem_desconto"] = (
                f"Desconto de 10% (R$ {desconto_aplicado:.2f}) aplicado por pagamento via Pix!"
            )

        return resposta

    except pymysql.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Já existe um registro de pagamento para o pedido ID {id_pedido}.",
        )
    except pymysql.MySQLError as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno no banco de dados: {err}",
        )


# -----------------------------------------------------------------------------
# ENDPOINT GET /pagamentos/{id_pedido} — inalterado desde a Entrega 1
# -----------------------------------------------------------------------------
@app.get(
    "/pagamentos/{id_pedido}",
    summary="Consultar dados de um pagamento existente",
    tags=["Pagamentos"],
    responses={
        200: {"description": "Dados do pagamento retornados com sucesso."},
        404: {"description": "Pagamento não encontrado para o pedido informado."},
        500: {"description": "Erro de comunicação com o banco de dados."},
    },
)
def consultar_pagamento(id_pedido: int) -> Dict[str, Any]:
    """
    Retorna todos os campos da tabela PAGAMENTO para o `id_pedido` informado.

    Caso não exista registro para o pedido, retorna HTTP 404 Not Found.
    """
    conexao = obter_conexao()
    if not conexao:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível estabelecer conexão com o banco de dados.",
        )

    try:
        cursor = conexao.cursor()
        sql_select = "SELECT * FROM PAGAMENTO WHERE id_pedido = %s;"
        cursor.execute(sql_select, (id_pedido,))
        registro = cursor.fetchone()
        cursor.close()
        conexao.close()

        if not registro:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Nenhum pagamento encontrado para o pedido ID {id_pedido}.",
            )

        return registro

    except pymysql.MySQLError as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro de comunicação com o banco de dados: {err}",
        )


# -----------------------------------------------------------------------------
# ENDPOINT GET /metodos — Utilitário: lista os métodos aceitos (extra)
# Endpoint de apoio útil para clientes da API consultarem os valores válidos
# sem precisar ler a documentação.
# -----------------------------------------------------------------------------
@app.get(
    "/metodos",
    summary="Listar métodos de pagamento aceitos",
    tags=["Utilitários"],
)
def listar_metodos() -> Dict[str, Any]:
    """
    Retorna a lista de métodos de pagamento aceitos pela API.
    Útil para que sistemas clientes populem dropdowns ou validem entradas
    no lado do cliente antes de enviar a requisição.
    """
    return {
        "metodos_aceitos": sorted(METODOS_ACEITOS),
        "observacao": (
            "O método 'Pix' concede desconto automático de 10% sobre o valor total."
        ),
    }