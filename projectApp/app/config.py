from pydantic_settings import BaseSettings
from pydantic import PostgresDsn, HttpUrl

class Settings(BaseSettings):
    DATABASE_URL: PostgresDsn
    JWT_SECRET: str
    KYC_API_URL: HttpUrl
    KYC_API_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()