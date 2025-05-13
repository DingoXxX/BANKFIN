"""Authentication package initialization"""
from passlib.context import CryptContext

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# Import after defining the functions to avoid circular imports
from .jwt import create_access_token, get_current_user

__all__ = ['get_password_hash', 'verify_password', 'create_access_token', 'get_current_user']
