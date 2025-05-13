from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app import models, schemas, database, auth

router = APIRouter(prefix="/deposit", tags=["Deposit"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/user/login")
SECRET_KEY = "replace_this_with_env_var"
ALGORITHM = "HS256"

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = int(payload.get("sub"))
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/")
def deposit(data: schemas.DepositRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Deposit amount must be positive")
    wallet = db.query(models.Wallet).filter(models.Wallet.user_id == current_user.id).first()
    wallet.balance += data.amount
    db.add(models.Transaction(user_id=current_user.id, amount=data.amount, type="deposit"))
    db.commit()
    return {"msg": f"Deposited ${data.amount:.2f}", "new_balance": wallet.balance}
