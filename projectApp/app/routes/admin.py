from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Transaction, KYCRequest, SystemLog
from ..schemas import UserResponse, TransactionResponse, KYCResponse, SystemLogResponse, AdminStats
from ..auth.jwt import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(db: Session = Depends(get_db), _: dict = Depends(get_admin_user)):
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    
    stats = {
        "totalUsers": db.query(User).count(),
        "transactionsLast24h": db.query(Transaction).filter(Transaction.created_at >= day_ago).count(),
        "pendingKYC": db.query(KYCRequest).filter(KYCRequest.status == "pending").count(),
        "systemHealth": "Healthy"  # You can implement more sophisticated health checks
    }
    return stats

@router.get("/transactions/chart")
async def get_transaction_chart(db: Session = Depends(get_db), _: dict = Depends(get_admin_user)):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    
    transactions = db.query(Transaction).filter(Transaction.created_at >= week_ago).all()
    
    # Group by day
    daily_counts = {}
    for tx in transactions:
        day = tx.created_at.date()
        daily_counts[day] = daily_counts.get(day, 0) + 1
    
    # Sort by date
    sorted_days = sorted(daily_counts.keys())
    return {
        "labels": [day.strftime("%Y-%m-%d") for day in sorted_days],
        "values": [daily_counts[day] for day in sorted_days]
    }

@router.get("/users", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.get("/users/search", response_model=List[UserResponse])
async def search_users(
    q: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    users = db.query(User).filter(
        User.email.ilike(f"%{q}%") | User.name.ilike(f"%{q}%")
    ).all()
    return users

@router.get("/users/activity")
async def get_user_activity(db: Session = Depends(get_db), _: dict = Depends(get_admin_user)):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    
    # Get daily active users (users who made transactions)
    active_users = db.query(Transaction.created_at, Transaction.user_id)\
        .filter(Transaction.created_at >= week_ago)\
        .distinct(Transaction.user_id)\
        .all()
    
    # Group by day
    daily_users = {}
    for tx_date, _ in active_users:
        day = tx_date.date()
        daily_users[day] = daily_users.get(day, 0) + 1
    
    # Sort by date
    sorted_days = sorted(daily_users.keys())
    return {
        "labels": [day.strftime("%Y-%m-%d") for day in sorted_days],
        "values": [daily_users[day] for day in sorted_days]
    }

@router.get("/kyc", response_model=List[KYCResponse])
async def get_kyc_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    query = db.query(KYCRequest)
    if status:
        query = query.filter(KYCRequest.status == status)
    return query.all()

@router.post("/kyc/{request_id}/approve")
async def approve_kyc(
    request_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    kyc_request = db.query(KYCRequest).filter(KYCRequest.id == request_id).first()
    if not kyc_request:
        raise HTTPException(status_code=404, detail="KYC request not found")
    
    kyc_request.status = "approved"
    kyc_request.reviewed_at = datetime.utcnow()
    db.commit()
    return {"message": "KYC request approved"}

@router.get("/logs", response_model=List[SystemLogResponse])
async def get_system_logs(
    level: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    query = db.query(SystemLog)
    if level:
        query = query.filter(SystemLog.level == level)
    if start_date:
        query = query.filter(SystemLog.timestamp >= start_date)
    if end_date:
        query = query.filter(SystemLog.timestamp <= end_date)
    
    return query.order_by(SystemLog.timestamp.desc()).all()

@router.post("/settings")
async def update_settings(
    settings: dict,
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user)
):
    # Update system settings in database or cache
    return {"message": "Settings updated successfully"}
