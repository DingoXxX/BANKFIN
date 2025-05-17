# app/main.py

import time
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError
from app.database import engine, Base, get_db
from app.models import SystemLog  # Add this import
from app.routes.auth import router as auth_router
from app.routes.accounts import router as accounts_router
from app.routes.deposit import router as deposit_router
from app.routes.transactions import router as transactions_router
from app.routes.admin import router as admin_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="BankFin API",
    version="0.1.0",
    description="Your banking app endpoints"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    # Log incoming request
    path = request.url.path
    method = request.method
    
    # Skip logging for certain paths (e.g. health checks)
    if not path.startswith(("/health", "/static", "/favicon.ico")):
        db = next(get_db())
        log = SystemLog(
            level="INFO",
            service="api",
            message=f"{method} {path}"
        )
        db.add(log)
        db.commit()
    
    response = await call_next(request)
    
    # Log errors
    if response.status_code >= 400:
        db = next(get_db())
        log = SystemLog(
            level="ERROR",
            service="api",
            message=f"Error {response.status_code} on {method} {path}"
        )
        db.add(log)
        db.commit()
    
    return response

# Event: On startup, wait for DB & create tables
@app.on_event("startup")
def on_startup():
    max_retries = 10
    for i in range(max_retries):
        try:
            with engine.connect():
                logger.info("✅ Database is up!")
                break
        except OperationalError:
            wait = 2
            logger.warning(f"⏳ Database not ready, retrying in {wait}s… ({i+1}/{max_retries})")
            time.sleep(wait)
    else:
        raise RuntimeError(f"❌ Could not connect to database after {max_retries} retries")

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("📦 Tables ensured (create_all done).")
    except OperationalError as e:
        logger.error(f"Failed to create database tables: {e}")
        # Wait for database to be ready
        time.sleep(5)
        Base.metadata.create_all(bind=engine)

# Mount routers
app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(deposit_router)
app.include_router(transactions_router)
app.include_router(admin_router)

# Health check endpoint
@app.get("/", tags=["health"])
async def health_check():
    return {"status": "OK"}
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Serve static files (frontend)
frontend_path = os.path.join(os.path.dirname(__file__), '..', 'banking-App')
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# Serve index.html at root
@app.get("/index.html")
async def serve_frontend():
    return FileResponse(os.path.join(frontend_path, "index.html"))
