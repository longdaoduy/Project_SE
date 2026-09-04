import os
import ssl
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load the primary backend configuration. Older checkouts kept the database
# settings in app_beta/.env, so retain that as a local compatibility fallback.
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")
if not os.getenv("DATABASE_URL"):
    load_dotenv(BACKEND_DIR.parent / "app_beta" / ".env")

# 1. URL kết nối Aiven – bắt buộc khai báo trong .env
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. "
        "Copy backend/.env.example to backend/.env and fill in the values."
    )

# 2. Cấu hình SSL bỏ qua kiểm tra thời gian (Đã test thành công)
DB_SSL_CA = os.getenv("DB_SSL_CA", "ca.pem")
ctx = ssl.create_default_context(cafile=DB_SSL_CA)
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
CONNECT_ARGS = {"ssl": ctx}

# 3. Khởi tạo Engine
# pool_size=10, max_overflow=20: tăng số connection tối đa để giảm thời gian chờ
# pool_recycle=1800: recycle connection sau 30 phút để tránh MySQL server-side timeout
# pool_timeout=30: timeout khi chờ connection từ pool
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    pool_timeout=30,
    connect_args=CONNECT_ARGS,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
