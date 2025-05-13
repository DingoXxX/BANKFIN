# app/routes/auth.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import schemas, models, database, auth

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
    db.add(user); db.commit(); db.refresh(user)

    # 3) Save the uploaded file
    filename = f"{user.id}_{id_document.filename}"
    save_path = f"./uploads/{filename}"
    # (ensure uploads/ exists)
    with open(save_path, "wb") as f:
        f.write(await id_document.read())
    file_url = f"{settings.KYC_API_URL}/files/{filename}"  # or your S3 URL

    # 4) Record the KYC document
    kyc_doc = models.KycDocument(
        user_id=user.id,
        doc_type=id_document.content_type,
        file_url=file_url,
        status=models.KycStatus.pending
    )
    db.add(kyc_doc); db.commit()

    # 5) Enqueue a background verification call
    def call_kyc_provider(document_id: int, url: str):
        resp = httpx.post(
            settings.KYC_API_URL,
            headers={"Authorization": f"Bearer {settings.KYC_API_KEY}"},
            json={"user_id": user.id, "document_url": url}
        )
        data = resp.json()
        # update DB based on provider’s response
        db2 = next(database.get_db())
        doc = db2.query(models.KycDocument).get(document_id)
        if resp.status_code == 200 and data.get("status") == "verified":
            doc.status = models.KycStatus.verified
            doc.verified_at = data.get("verified_at")
            # also update the user’s kyc_status
            user_rec = db2.query(models.User).get(user.id)
            user_rec.kyc_status = models.KycStatus.verified
        else:
            doc.status = models.KycStatus.failed
            user_rec = db2.query(models.User).get(user.id)
            user_rec.kyc_status = models.KycStatus.failed
        db2.commit()
        db2.close()

    background_tasks.add_task(call_kyc_provider, kyc_doc.id, file_url)

    # 6) Return immediately
    return schemas.RegisterResponse(user_id=user.id, kyc_status=user.kyc_status.value)


@router.get("/auth/kyc-status", response_model=schemas.KycStatusResponse)
def kyc_status(user_id: int, db: Session = Depends(database.get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return schemas.KycStatusResponse(kyc_status=user.kyc_status.value)
