# app/routes/accounts.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app import database, models, schemas
from app.auth.jwt import get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])

@router.get("/profile")
def get_profile(user: dict = Depends(get_current_user)):
    return {"msg": f"Welcome, user #{user['sub']}"}

@router.post("/", response_model=schemas.AccountResponse)
def create_account(
    req: schemas.AccountCreateRequest,
    db: Session = Depends(database.get_db)
):
    account = models.Account(owner=str(req.user_id), balance=req.initial_deposit)
    db.add(account)
    db.commit()
    db.refresh(account)
    return schemas.AccountResponse(
        account_id=account.id,
        user_id=int(account.owner),
        balance=account.balance
    )

@router.get("/{account_id}", response_model=schemas.AccountResponse)
def get_account(
    account_id: int,
    db: Session = Depends(database.get_db)
):
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return schemas.AccountResponse(
        account_id=account.id,
        user_id=int(account.owner),
        balance=account.balance
    )

