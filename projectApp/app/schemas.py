# app/schemas.py

from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Literal, Optional
from datetime import datetime
from app.models import KycStatusEnum

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

# ——— Admin ———

class AdminStats(BaseModel):
    totalUsers: int
    transactionsLast24h: int
    pendingKYC: int
    systemHealth: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    kyc_status: str
    join_date: datetime
    model_config = ConfigDict(from_attributes=True)

class KYCResponse(BaseModel):
    id: int
    user_id: int
    status: str
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class SystemLogResponse(BaseModel):
    id: int
    timestamp: datetime
    level: str
    service: str
    message: str
    model_config = ConfigDict(from_attributes=True)
