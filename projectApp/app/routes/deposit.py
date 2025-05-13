# app/routes/deposit.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import schemas, models, database

router = APIRouter(
    prefix="/deposit",
    tags=["deposit"]
)

@router.post("/", response_model=schemas.DepositResponse)
def make_deposit(
    deposit: schemas.DepositRequest,
    db: Session = Depends(database.get_db)
):
    # 1) Look up the account
    account = db.query(models.Account).filter(models.Account.id == deposit.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # 2) Add funds
    account.balance += deposit.amount
    db.add(account)
    db.commit()
    db.refresh(account)

    # 3) Return a response
    return schemas.DepositResponse(
        account_id=account.id,
        new_balance=account.balance
    )
