import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

# docker-compose pasa DATABASE_URL; si no existe se usa el MySQL local de siempre.
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:Pepo12345678910@localhost:3306/mka_db",
)

# Si MySQL no está encendido o rechaza la clave, la API arranca igual con esta base local.
# Para desactivar el respaldo: set MKA_SIN_SQLITE=1
SQLITE_RESPALDO = "sqlite:///" + Path(__file__).with_name("mka_local.db").as_posix()


def _crear_engine(url: str):
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


engine = _crear_engine(SQLALCHEMY_DATABASE_URL)

if not SQLALCHEMY_DATABASE_URL.startswith("sqlite") and os.getenv("MKA_SIN_SQLITE") != "1":
    try:
        with engine.connect():
            pass
        print(f"[database] Conectado a {SQLALCHEMY_DATABASE_URL.split('@')[-1]}")
    except OperationalError as error:
        print("=" * 70)
        print(f"[database] No se pudo usar MySQL ({SQLALCHEMY_DATABASE_URL.split('@')[-1]}):")
        print(f"           {getattr(error, 'orig', error)}")
        print("[database] La API sigue funcionando con SQLite: backend/mka_local.db")
        print("[database] Corrige la clave en backend/database.py para volver a MySQL.")
        print("=" * 70)
        engine.dispose()
        SQLALCHEMY_DATABASE_URL = SQLITE_RESPALDO
        engine = _crear_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
