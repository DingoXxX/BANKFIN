# app/models.py

from sqlalchemy import Column, Integer, String, Float, Enum as SQLAlchemyEnum, DateTime, ForeignKey
from sqlalchemy.sql import func
from .database import Base
import enum

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    owner = Column(String, index=True)
    balance = Column(Float, default=0.0)

class KycStatusEnum(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    failed = "failed"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    kyc_status = Column(SQLAlchemyEnum(KycStatusEnum), default=KycStatusEnum.pending)

class TransactionType(str, enum.Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"
    transfer = "transfer"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    transaction_type = Column(SQLAlchemyEnum(TransactionType))
    amount = Column(Float)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
