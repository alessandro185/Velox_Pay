# =============================================================================
# ENTREGA 1 — PROTÓTIPO BASE (Ciclo RAD - Sprint 1)
# Projeto: API de Pagamentos — Lanchonete "Sabor Rápido"
# Objetivo: Implementar a estrutura fundamental da API com os dois endpoints
#           principais exigidos pelos Requisitos Funcionais RF1 a RF4.
#
# Endpoints entregues neste ciclo:
#   POST /pagamentos  → Registra e processa um novo pagamento
#   GET  /pagamentos/{id_pedido} → Consulta o status de um pagamento existente
#
# Pré-requisitos para execução:
#   1. MySQL rodando localmente na porta 3306
#   2. Banco de dados criado conforme script SQL da Fase 3 do enunciado
#   3. Dependências instaladas: pip install fastapi uvicorn pymysql pydantic
#
# Como executar:
#   uvicorn entrega_1:app --reload
#   Acesse a documentação interativa em: http://127.0.0.1:8000/docs
# =============================================================================

import random
from typing import Dict, Any

import pymysql
import pymysql.cursors
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Inicialização da aplicação FastAPI
# O título, descrição e versão aparecem automaticamente no Swagger UI (/docs)
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Sabor Rápido — API de Pagamentos",
    description=(
        "Protótipo funcional (Entrega 1) desenvolvido com metodologia RAD. "
        "Cobre os requisitos RF1, RF2, RF3 e RF4 da sessão JAD."
    ),
    version="1.0.0",
)

# -----------------------------------------------------------------------------
# Configurações de conexão com o banco de dados MySQL
# ATENÇÃO: em projetos reais, utilize variáveis de ambiente (.env) para
# armazenar credenciais — nunca escreva senhas diretamente no código-fonte.
# -----------------------------------------------------------------------------
DB_CONFIG: Dict[str, Any] = {
    "host": "127.0.0.1",
    "user": "root",        # Substitua pelo seu usuário do MySQL
    "password": "",        # Substitua pela sua senha do MySQL
    "database": "sabor_rapido_db",
    "port": 3306,
    "cursorclass": pymysql.cursors.DictCursor,  # Retorna linhas como dicionários
}


def obter_conexao() -> pymysql.connections.Connection | None:
    """
    Estabelece e retorna uma conexão ativa com o banco de dados MySQL.

    Retorna None em caso de falha, permitindo que os endpoints tratem o erro
    com um HTTP 500 adequado em vez de deixar a exceção propagar sem controle.
    """
    try:
        return pymysql.connect(**DB_CONFIG)
    except pymysql.MySQLError as erro:
        # Registra o erro no console do servidor para fins de diagnóstico
        print(f"[ERRO] Falha ao conectar ao MySQL: {erro}")
        return None


# -----------------------------------------------------------------------------
# Modelo Pydantic — Validação dos dados de entrada (RF1)
# O FastAPI usa este modelo para:
#   • Validar automaticamente o JSON recebido no corpo da requisição
#   • Rejeitar campos ausentes ou com tipos incorretos (HTTP 422)
#   • Gerar a documentação interativa do Swagger com os campos e restrições
# -----------------------------------------------------------------------------
class SolicitacaoPagamento(BaseModel):
    id_pedido: int = Field(
        ...,
        description="Identificador numérico único do pedido na lanchonete",
        gt=0,  # Deve ser maior que zero (gt = greater than)
    )
    valor_total: float = Field(
        ...,
        description="Valor monetário total da transação (ex: 49.90)",
        gt=0.0,
    )
    metodo_pagamento: str = Field(
        ...,
        description="Forma de pagamento utilizada. Valores aceitos: Cartão, Pix, Dinheiro",
    )


# -----------------------------------------------------------------------------
# ENDPOINT POST /pagamentos — Processar Pagamento (RF1, RF2, RF3)
# -----------------------------------------------------------------------------
@app.post(
    "/pagamentos",
    status_code=status.HTTP_201_CREATED,
    summary="Registrar e processar um novo pagamento",
    tags=["Pagamentos"],
)
def processar_pagamento(pagamento: SolicitacaoPagamento) -> Dict[str, Any]:
    """
    Recebe os dados de um pedido, simula o processamento financeiro e
    persiste a transação no banco de dados.

    Regra de negócio (simulação do adquirente):
    - Pagamentos em **Dinheiro** são sempre aprovados.
    - Demais métodos têm 90% de chance de aprovação e 10% de recusa,
      simulando o comportamento real de uma operadora de pagamentos.
    """
    id_pedido = pagamento.id_pedido
    valor_total = pagamento.valor_total
    metodo_pagamento = pagamento.metodo_pagamento

    # --- Simulação da aprovação financeira (RF3) ---
    # Dinheiro: aprovação garantida (sem dependência de rede/operadora)
    # Cartão/Pix: simulam a resposta probabilística de um gateway real
    if metodo_pagamento.lower() == "dinheiro":
        status_simulado = "Aprovado"
    else:
        status_simulado = random.choices(
            ["Aprovado", "Recusado"],
            weights=[90, 10],  # 90% aprovado, 10% recusado
        )[0]

    # --- Persistência no banco de dados (RF2 + RF3) ---
    conexao = obter_conexao()
    if not conexao:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível estabelecer conexão com o banco de dados.",
        )

    try:
        cursor = conexao.cursor()

        # Parametrização segura: os valores são passados separadamente da query,
        # impedindo ataques de SQL Injection (RNF de segurança implícito)
        sql_insert = """
            INSERT INTO PAGAMENTO (id_pedido, valor_total, metodo_pagamento, status_pagamento)
            VALUES (%s, %s, %s, %s);
        """
        cursor.execute(sql_insert, (id_pedido, valor_total, metodo_pagamento, status_simulado))

        # commit() confirma a transação DML no banco; sem ele, o INSERT é revertido
        conexao.commit()
        cursor.close()
        conexao.close()

        # Retorna resumo da transação processada ao cliente
        return {
            "mensagem": "Pagamento processado com sucesso!",
            "id_pedido": id_pedido,
            "status": status_simulado,
            "valor_total": valor_total,
            "metodo_pagamento": metodo_pagamento,
        }

    except pymysql.IntegrityError:
        # A constraint UNIQUE no campo id_pedido impede registros duplicados (RF2)
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
# ENDPOINT GET /pagamentos/{id_pedido} — Consultar Pagamento (RF4)
# -----------------------------------------------------------------------------
@app.get(
    "/pagamentos/{id_pedido}",
    summary="Consultar dados de um pagamento existente",
    tags=["Pagamentos"],
)
def consultar_pagamento(id_pedido: int) -> Dict[str, Any]:
    """
    Retorna todos os dados de um pagamento registrado, identificado pelo
    número do pedido original.

    Retorna HTTP 404 caso nenhum registro seja encontrado para o id_pedido
    informado.
    """
    conexao = obter_conexao()
    if not conexao:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível estabelecer conexão com o banco de dados.",
        )

    try:
        cursor = conexao.cursor()  # DictCursor já configurado em DB_CONFIG
        sql_select = "SELECT * FROM PAGAMENTO WHERE id_pedido = %s;"
        cursor.execute(sql_select, (id_pedido,))
        registro = cursor.fetchone()  # Retorna um dict ou None
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