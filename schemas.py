from decimal import Decimal
from enum import Enum
from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, ConfigDict, field_validator


class MetodoPagamento(str, Enum):
    PIX = "Pix"
    CARTAO = "Cartão"
    DINHEIRO = "Dinheiro"

    @classmethod
    def normalize(cls, value: str) -> "MetodoPagamento":
        clean = (value or "").strip().lower()
        if clean in ("pix",):
            return cls.PIX
        if clean in ("cartão", "cartao", "cartao de credito", "cartão de crédito", "card"):
            return cls.CARTAO
        if clean in ("dinheiro", "cash"):
            return cls.DINHEIRO
        raise ValueError(f"Método '{value}' inválido. Métodos suportados: Pix, Cartão, Dinheiro.")


class StatusPagamento(str, Enum):
    APROVADO = "Aprovado"
    RECUSADO = "Recusado"
    PENDENTE = "Pendente"


class PagamentoCreate(BaseModel):
    id_pedido: int = Field(..., gt=0, description="Identificador único numérico do pedido (deve ser maior que zero)")
    valor_total: Decimal = Field(..., gt=Decimal("0.00"), decimal_places=2, description="Valor bruto do pedido em reais")
    metodo_pagamento: MetodoPagamento = Field(..., description="Forma de pagamento (Pix, Cartão, Dinheiro)")

    @field_validator("metodo_pagamento", mode="before")
    @classmethod
    def validate_metodo(cls, v):
        if isinstance(v, MetodoPagamento):
            return v
        return MetodoPagamento.normalize(str(v))

    model_config = {
        "json_schema_extra": {
            "example": {
                "id_pedido": 101,
                "valor_total": 49.90,
                "metodo_pagamento": "Pix"
            }
        }
    }


class PagamentoResponse(BaseModel):
    id_pedido: int
    valor_original: float
    desconto: float
    valor_total: float
    metodo_pagamento: str
    status_pagamento: str
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedPagamentos(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[PagamentoResponse]


class ResumoMetricas(BaseModel):
    total_arrecadado: float
    total_transacoes: int
    aprovados: int
    recusados: int
    pendentes: int
    taxa_aprovacao: float
    economia_pix: float
    metodos_percentual: Dict[str, float]
