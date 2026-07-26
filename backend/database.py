import ssl
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. URL kết nối thẳng tới Aiven (Đã thêm pymysql)
DATABASE_URL = ""

# 2. Cấu hình SSL bỏ qua kiểm tra thời gian (Đã test thành công)
ctx = ssl.create_default_context(cafile="ca.pem")
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
CONNECT_ARGS = {"ssl": ctx}

# 3. Khởi tạo Engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=CONNECT_ARGS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()