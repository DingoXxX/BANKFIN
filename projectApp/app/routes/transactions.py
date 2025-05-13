from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, models, database
from ..auth.jwt import get_current_user

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"]
)

@router.post("/", response_model=schemas.TransactionResponse)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Session = Depends(database.get_db),
    current_user: dict = Depends(get_current_user)
):
    # Check if account exists and belongs to user
    account = db.query(models.Account).filter(
        models.Account.id == transaction.account_id
    ).first()
    
    if not account or str(account.owner) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Validate sufficient funds for withdrawals
    if transaction.transaction_type == "withdrawal" and account.balance < transaction.amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    # Update account balance
    if transaction.transaction_type == "withdrawal":
        account.balance -= transaction.amount
    elif transaction.transaction_type == "deposit":
        account.balance += transaction.amount
    
    # Create transaction record
    db_transaction = models.Transaction(
        account_id=transaction.account_id,
        transaction_type=transaction.transaction_type,
        amount=transaction.amount,
        description=transaction.description
    )
    
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.get("/{account_id}", response_model=List[schemas.TransactionResponse])
def get_account_transactions(
    account_id: int,
    db: Session = Depends(database.get_db),
    current_user: dict = Depends(get_current_user)
):
    # Check if account exists and belongs to user
    account = db.query(models.Account).filter(
        models.Account.id == account_id
    ).first()
    
    if not account or str(account.owner) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Account not found")
    
    transactions = db.query(models.Transaction).filter(
        models.Transaction.account_id == account_id
    ).all()
    
    return transactions
