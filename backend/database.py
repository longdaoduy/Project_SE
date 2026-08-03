import os
import ssl
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load biến môi trường từ backend/.env (xem backend/.env.example)
load_dotenv(Path(__file__).resolve().parent / ".env")

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
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=CONNECT_ARGS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
