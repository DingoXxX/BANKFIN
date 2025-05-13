# app/schemas.py

from pydantic import BaseModel, EmailStr
from typing import Literal, Optional
from datetime import datetime

class ErrorResponse(BaseModel):
    code: int
    message: str

# ——— Auth / KYC ———

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class RegisterResponse(BaseModel):
    user_id: int
    kyc_status: Literal["pending", "verified", "failed"]
    access_token: str

class KycStatusResponse(BaseModel):
    kyc_status: Literal["pending", "verified", "failed"]

# ——— Accounts ———

class AccountCreateRequest(BaseModel):
    user_id: int
    initial_deposit: float

class AccountResponse(BaseModel):
    account_id: int
    user_id: int
    balance: float

class DepositRequest(BaseModel):
    account_id: int
    amount: float

class DepositResponse(BaseModel):
    account_id: int
    new_balance: float
    amount: float

class DepositResponse(BaseModel):
    account_id: int
    new_balance: float

# ——— Transactions ———

class TransactionBase(BaseModel):
    amount: float
    description: Optional[str] = None

class TransactionCreate(TransactionBase):
    account_id: int
    transaction_type: Literal["deposit", "withdrawal", "transfer"]

class TransactionResponse(TransactionBase):
    id: int
    account_id: int
    transaction_type: str
    created_at: datetime

    class Config:
        from_attributes = True
