from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, DateTime
from database import Base

class Pagamento(Base):
    __tablename__ = "pagamentos"

    id_pedido = Column(Integer, primary_key=True, index=True, autoincrement=False)
    valor_original = Column(Numeric(10, 2), nullable=False)
    desconto = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    valor_total = Column(Numeric(10, 2), nullable=False)
    metodo_pagamento = Column(String(50), nullable=False)
    status_pagamento = Column(String(50), nullable=False)
    criado_em = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<Pagamento(id_pedido={self.id_pedido}, metodo='{self.metodo_pagamento}', status='{self.status_pagamento}', total={self.valor_total})>"
