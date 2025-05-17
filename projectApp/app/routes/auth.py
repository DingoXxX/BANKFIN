# app/routes/auth.py

import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Form, File, UploadFile
from sqlalchemy.orm import Session
import httpx
from app import schemas, models, database
from app.auth import jwt as auth
from app.config import settings

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

@router.post("/login", response_model=schemas.Token)
async def login(
    credentials: schemas.LoginRequest,
    db: Session = Depends(database.get_db)
):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=schemas.RegisterResponse, status_code=201)
async def register_with_kyc(
    background_tasks: BackgroundTasks,
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    id_document: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    # 1) Check for duplicate email
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(400, "Email already registered")
    
    # 2) Create user record with pending KYC
    pw_hash = auth.get_password_hash(password)
    user = models.User(full_name=full_name, email=email, password_hash=pw_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 3) Save the uploaded file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{user.id}_{id_document.filename}"
    save_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    # Save file to disk
    with open(save_path, "wb") as f:
        content = id_document.file.read()
        f.write(content)

    # Create KYC document record
    kyc_doc = models.KycDocument(
        user_id=user.id,
        file_name=filename,
        file_path=save_path,
        file_type=id_document.content_type,
        doc_status=models.KycStatusEnum.pending
    )
    db.add(kyc_doc)
    db.commit()
    db.refresh(kyc_doc)

    # 5) Enqueue a background verification call
    def call_kyc_provider(document_id: int, url: str):
        resp = httpx.post(
            settings.KYC_API_URL,
            headers={"Authorization": f"Bearer {settings.KYC_API_KEY}"},
            json={"user_id": user.id, "document_url": url}
        )
        data = resp.json()
        # update DB based on provider\'s response
        db2 = next(database.get_db())
        doc = db2.query(models.KycDocument).get(document_id)
        if resp.status_code == 200 and data.get("status") == "verified":
            doc.doc_status = models.KycStatusEnum.verified
            doc.verified_at = data.get("verified_at")
            # also update the user\'s kyc_status
            user_rec = db2.query(models.User).get(user.id)
            user_rec.kyc_status = models.KycStatusEnum.verified
        else:
            doc.doc_status = models.KycStatusEnum.failed
            user_rec = db2.query(models.User).get(user.id)
            user_rec.kyc_status = models.KycStatusEnum.failed
        db2.commit()
        db2.close()

    file_url = f"{settings.KYC_API_URL}/files/{filename}"
    background_tasks.add_task(call_kyc_provider, kyc_doc.id, file_url)

    # 6) Return immediately
    return schemas.RegisterResponse(user_id=user.id, kyc_status=user.kyc_status.value)

@router.get("/auth/kyc-status", response_model=schemas.KycStatusResponse)
def kyc_status(user_id: int, db: Session = Depends(database.get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return schemas.KycStatusResponse(kyc_status=user.kyc_status.value)

@router.post("/admin/login", response_model=schemas.Token)
async def admin_login(
    credentials: schemas.LoginRequest,
    db: Session = Depends(database.get_db)
):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="User does not have admin privileges"
        )
    access_token = auth.create_admin_token(user)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/admin/init", response_model=schemas.Token)
async def init_admin(db: Session = Depends(database.get_db)):
    """Initialize the first admin user if none exists"""
    if db.query(models.User).filter(models.User.is_admin == True).first():
        raise HTTPException(400, "Admin user already exists")
    
    pw_hash = auth.get_password_hash(settings.DEFAULT_ADMIN_PASSWORD)
    admin = models.User(
        full_name="System Admin",
        email=settings.DEFAULT_ADMIN_EMAIL,
        password_hash=pw_hash,
        is_admin=True,
        kyc_status=models.KycStatusEnum.verified
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    
    access_token = auth.create_admin_token(admin)
    return {"access_token": access_token, "token_type": "bearer"}
