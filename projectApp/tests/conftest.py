import os
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.config import settings
from app.config import settings

# Use in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def temp_uploads_dir():
    """Create a temporary uploads directory for tests"""
    temp_dir = tempfile.mkdtemp()
    # Override the upload path in settings
    original_upload_path = settings.UPLOAD_DIR
    settings.UPLOAD_DIR = temp_dir
    yield temp_dir
    # Clean up
    shutil.rmtree(temp_dir)
    settings.UPLOAD_DIR = original_upload_path

def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

@pytest.fixture(scope="session", autouse=True)
def test_app(temp_uploads_dir):
    """Create test app with overridden dependencies"""
    app.dependency_overrides[get_db] = override_get_db
    return app

@pytest.fixture(autouse=True, scope="function")
def test_db():
    """Create test database for each test"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(test_app, test_db, temp_uploads_dir):
    """Create test client"""
    with TestClient(test_app) as test_client:
        yield test_client
