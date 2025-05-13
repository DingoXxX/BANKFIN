# app/database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

# Pull the DATABASE_URL from .env via Pydantic BaseSettings
DATABASE_URL = str(settings.DATABASE_URL)

# Create the SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    # SQLite needs this extra arg; other DBs ignore it
    connect_args={"check_same_thread": False}
                 if DATABASE_URL.startswith("sqlite") else {}
)

# Create a session factory bound to this engine
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for ORM models
Base = declarative_base()

# Dependency to get a database session for each request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
