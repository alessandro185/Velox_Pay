import os
import logging
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

# Configuração do banco de dados: lê DATABASE_URL com fallback para SQLite
DEFAULT_SQLITE_URL = "sqlite:///./veloxpay.db"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL).strip()

def get_engine(db_url: str):
    connect_args = {}
    if db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    try:
        return create_engine(db_url, connect_args=connect_args)
    except Exception as e:
        logger.warning(f"Falha ao conectar em '{db_url}': {e}. Utilizando SQLite fallback.")
        return create_engine(DEFAULT_SQLITE_URL, connect_args={"check_same_thread": False})

engine = get_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Cria tabelas e insere dados iniciais se o banco estiver vazio."""
    from models import Pagamento
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(Pagamento).count() == 0:
            seed_data = [
                Pagamento(
                    id_pedido=1,
                    valor_original=Decimal("49.90"),
                    desconto=Decimal("4.99"),
                    valor_total=Decimal("44.91"),
                    metodo_pagamento="Pix",
                    status_pagamento="Aprovado",
                    criado_em=datetime.now(timezone.utc)
                ),
                Pagamento(
                    id_pedido=2,
                    valor_original=Decimal("89.90"),
                    desconto=Decimal("0.00"),
                    valor_total=Decimal("89.90"),
                    metodo_pagamento="Cartão",
                    status_pagamento="Aprovado",
                    criado_em=datetime.now(timezone.utc)
                ),
                Pagamento(
                    id_pedido=3,
                    valor_original=Decimal("32.00"),
                    desconto=Decimal("0.00"),
                    valor_total=Decimal("32.00"),
                    metodo_pagamento="Dinheiro",
                    status_pagamento="Aprovado",
                    criado_em=datetime.now(timezone.utc)
                ),
                Pagamento(
                    id_pedido=4,
                    valor_original=Decimal("57.50"),
                    desconto=Decimal("0.00"),
                    valor_total=Decimal("57.50"),
                    metodo_pagamento="Cartão",
                    status_pagamento="Recusado",
                    criado_em=datetime.now(timezone.utc)
                ),
                Pagamento(
                    id_pedido=5,
                    valor_original=Decimal("24.90"),
                    desconto=Decimal("2.49"),
                    valor_total=Decimal("22.41"),
                    metodo_pagamento="Pix",
                    status_pagamento="Pendente",
                    criado_em=datetime.now(timezone.utc)
                ),
            ]
            db.add_all(seed_data)
            db.commit()
    finally:
        db.close()
