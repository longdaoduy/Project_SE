import os
import ssl
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# Load biến môi trường từ backend/.env
load_dotenv(Path(__file__).resolve().parent / ".env")



DATABASE_URL = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. "
        "Please create backend/.env and configure DATABASE_URL."
    )



DB_USE_SSL = os.getenv("DB_USE_SSL", "0") == "1"

CONNECT_ARGS = {}

if DB_USE_SSL:
    DB_SSL_CA = os.getenv("DB_SSL_CA", "ca.pem")

    ctx = ssl.create_default_context(cafile=DB_SSL_CA)

    # Dùng cho Aiven / remote MySQL
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    CONNECT_ARGS = {
        "ssl": ctx
    }


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=CONNECT_ARGS
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()