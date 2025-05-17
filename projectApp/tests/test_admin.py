import pytest
from app.config import settings

def test_health_check(client):
    """Test the health check endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "OK"

def test_create_admin(client):
    """Test creating the initial admin user"""
    response = client.post("/auth/admin/init")
    assert response.status_code == 200
    assert "access_token" in response.json()
    
    # Try creating another admin - should fail
    response = client.post("/auth/admin/init")
    assert response.status_code == 400

def test_admin_login(client):
    """Test admin login functionality"""
    # First create admin user
    client.post("/auth/admin/init")
    
    # Try logging in with correct credentials
    response = client.post("/auth/admin/login", json={
        "email": settings.DEFAULT_ADMIN_EMAIL,
        "password": settings.DEFAULT_ADMIN_PASSWORD
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
    
    # Try logging in with incorrect password
    response = client.post("/auth/admin/login", json={
        "email": settings.DEFAULT_ADMIN_EMAIL,
        "password": "wrong_password"
    })
    assert response.status_code == 401

def test_admin_protected_endpoint(client):
    """Test that admin endpoints require authentication"""
    # Try accessing admin endpoint without token
    response = client.get("/api/admin/stats")
    assert response.status_code == 401
    
    # Create admin and get token
    client.post("/auth/admin/init")
    login_response = client.post("/auth/admin/login", json={
        "email": settings.DEFAULT_ADMIN_EMAIL,
        "password": settings.DEFAULT_ADMIN_PASSWORD
    })
    token = login_response.json()["access_token"]
    
    # Try accessing admin endpoint with token
    response = client.get(
        "/api/admin/stats",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
