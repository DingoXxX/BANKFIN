# app/main.py

import time
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError
from .database import engine, Base
from .routes.auth import router as auth_router
from .routes.accounts import router as accounts_router
from .routes.deposit import router as deposit_router

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
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
from .routes.transactions import router as transactions_router
app.include_router(transactions_router)

# Health check endpoint
@app.get("/", tags=["health"])
async def health_check():
    return {"status": "OK"}
