# =============================================================================
# ENTREGA 2 — EVOLUÇÃO RAD: Regra de Incentivo Financeiro (Sprint 2)
# Projeto: API de Pagamentos — Lanchonete "Sabor Rápido"
#
# Incremento implementado neste ciclo:
#   → Desafio 1: Desconto automático de 10% para pagamentos via Pix.
#     O campo "valor_total" armazenado no banco já reflete o valor descontado.
#     A resposta da API informa tanto o valor original quanto o valor cobrado.
#
# Motivação de negócio:
#   Incentivar o uso do Pix reduz as taxas cobradas pelas operadoras de cartão,
#   aumentando a margem da lanchonete em cada transação.
#
# O restante da API permanece idêntico à Entrega 1 (sem regressão).
#
# Como executar:
#   uvicorn entrega_2:app --reload
#   Documentação: http://127.0.0.1:8000/docs
# =============================================================================

import random
from typing import Dict, Any

import pymysql
import pymysql.cursors
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

app = FastAPI(
    title="Sabor Rápido — API de Pagamentos",
    description=(
        "Entrega 2 (RAD Sprint 2): inclui desconto de 10% para pagamentos via Pix. "
        "Base: Entrega 1 (RF1–RF4) sem alterações."
    ),
    version="1.1.0",
)

DB_CONFIG: Dict[str, Any] = {
    "host": "127.0.0.1",
    "user": "root",        # Substitua pelo seu usuário do MySQL
    "password": "",        # Substitua pela sua senha do MySQL
    "database": "sabor_rapido_db",
    "port": 3306,
    "cursorclass": pymysql.cursors.DictCursor,
}

# Constante nomeada para facilitar ajuste futuro da taxa de desconto.
# Usar uma constante (em vez de 0.90 solto no código) torna a regra explícita
# e evita o antipadrão de "números mágicos".
DESCONTO_PIX: float = 0.10  # 10% de desconto
FATOR_PIX: float = 1.0 - DESCONTO_PIX  # Multiplicador = 0.90


def obter_conexao() -> pymysql.connections.Connection | None:
    """Estabelece e retorna uma conexão ativa com o banco de dados MySQL."""
    try:
        return pymysql.connect(**DB_CONFIG)
    except pymysql.MySQLError as erro:
        print(f"[ERRO] Falha ao conectar ao MySQL: {erro}")
        return None


class SolicitacaoPagamento(BaseModel):
    id_pedido: int = Field(
        ...,
        description="Identificador numérico único do pedido",
        gt=0,
    )
    valor_total: float = Field(
        ...,
        description="Valor original do pedido, antes de qualquer desconto (ex: 49.90)",
        gt=0.0,
    )
    metodo_pagamento: str = Field(
        ...,
        description="Forma de pagamento. Valores aceitos: Cartão, Pix, Dinheiro",
    )


@app.post(
    "/pagamentos",
    status_code=status.HTTP_201_CREATED,
    summary="Registrar e processar um pagamento (com desconto Pix)",
    tags=["Pagamentos"],
)
def processar_pagamento(pagamento: SolicitacaoPagamento) -> Dict[str, Any]:
    """
    Processa o pagamento aplicando a seguinte lógica incremental (Sprint 2):

    **Regra de Desconto Pix:**
    - Se `metodo_pagamento` for "Pix" (insensível a maiúsculas/minúsculas),
      o `valor_total` é reduzido em **10%** antes de ser gravado no banco.
    - O valor original é preservado na resposta para transparência ao cliente.

    **Regra de Aprovação (mantida da Entrega 1):**
    - Dinheiro → sempre Aprovado.
    - Outros métodos → 90% Aprovado / 10% Recusado (simulação do adquirente).
    """
    id_pedido = pagamento.id_pedido
    valor_original = pagamento.valor_total      # Valor bruto informado pelo cliente
    metodo_pagamento = pagamento.metodo_pagamento

    # -------------------------------------------------------------------------
    # NOVO — Cálculo do desconto para pagamentos via Pix (Desafio 1)
    # A comparação é feita em minúsculas para aceitar "Pix", "PIX", "pix" etc.
    # O resultado é arredondado a 2 casas decimais, pois DECIMAL(10,2) no MySQL
    # truncaria valores com mais casas sem aviso — arredondar aqui mantém
    # consistência entre o valor retornado pela API e o valor persistido.
    # -------------------------------------------------------------------------
    if metodo_pagamento.lower() == "pix":
        valor_cobrado = round(valor_original * FATOR_PIX, 2)
        desconto_aplicado = round(valor_original * DESCONTO_PIX, 2)
    else:
        valor_cobrado = valor_original
        desconto_aplicado = 0.0

    # Simulação do adquirente financeiro (inalterada em relação à Entrega 1)
    if metodo_pagamento.lower() == "dinheiro":
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

        # Grava o VALOR COM DESCONTO (valor_cobrado) no banco, conforme a
        # especificação do desafio: "salvar o valor já descontado na tabela".
        sql_insert = """
            INSERT INTO PAGAMENTO (id_pedido, valor_total, metodo_pagamento, status_pagamento)
            VALUES (%s, %s, %s, %s);
        """
        cursor.execute(sql_insert, (id_pedido, valor_cobrado, metodo_pagamento, status_simulado))
        conexao.commit()
        cursor.close()
        conexao.close()

        # A resposta inclui tanto o valor original quanto o valor efetivamente
        # cobrado, garantindo rastreabilidade e transparência ao consumidor da API.
        resposta: Dict[str, Any] = {
            "mensagem": "Pagamento processado com sucesso!",
            "id_pedido": id_pedido,
            "status": status_simulado,
            "metodo_pagamento": metodo_pagamento,
            "valor_original": valor_original,
            "valor_cobrado": valor_cobrado,
        }

        # Adiciona campo informativo apenas quando desconto for aplicado
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


@app.get(
    "/pagamentos/{id_pedido}",
    summary="Consultar dados de um pagamento existente",
    tags=["Pagamentos"],
)
def consultar_pagamento(id_pedido: int) -> Dict[str, Any]:
    """
    Retorna os dados completos de um pagamento identificado pelo id_pedido.
    O campo `valor_total` refletirá o valor já descontado (caso Pix).
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