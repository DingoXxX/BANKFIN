from pydantic_settings import BaseSettings
from pydantic import PostgresDsn, HttpUrl
import os

class Settings(BaseSettings):
    DATABASE_URL: PostgresDsn
    JWT_SECRET: str
    KYC_API_URL: HttpUrl
    KYC_API_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEBUG: bool = False
    ADMIN_TOKEN_EXPIRY: int = 24  # hours
    DEFAULT_ADMIN_EMAIL: str = "admin@bankfin.com"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"  # Change this in production!
    UPLOAD_DIR: str = "uploads"
    UPLOAD_DIR: str = os.path.join(os.getcwd(), "uploads")  # Default to ./uploads directory

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()