import pytest
from app.auth import jwt as auth
from app.models import KycStatusEnum

def test_user_registration(client):
    """Test user registration process"""
    # Create a test user
    response = client.post("/auth/register", data={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "testpass123",
    }, files={
        "id_document": ("test.pdf", b"test content", "application/pdf")
    })
    assert response.status_code == 201
    assert "access_token" in response.json()
    assert response.json()["kyc_status"] == "pending"

def test_user_login(client):
    """Test user login functionality"""
    # First create a user
    client.post("/auth/register", data={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "testpass123",
    }, files={
        "id_document": ("test.pdf", b"test content", "application/pdf")
    })
    
    # Try logging in
    response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
    
    # Try logging in with wrong password
    response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpass"
    })
    assert response.status_code == 401

def test_create_account(client):
    """Test account creation"""
    # Create user and get token
    register_response = client.post("/auth/register", data={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "testpass123",
    }, files={
        "id_document": ("test.pdf", b"test content", "application/pdf")
    })
    token = register_response.json()["access_token"]
    
    # Create account
    response = client.post(
        "/accounts/create",
        json={"initial_deposit": 1000.0},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["balance"] == 1000.0

def test_transactions(client):
    """Test transaction functionality"""
    # Create two users
    user1_response = client.post("/auth/register", data={
        "full_name": "User One",
        "email": "user1@example.com",
        "password": "pass123",
    }, files={
        "id_document": ("test.pdf", b"test content", "application/pdf")
    })
    user2_response = client.post("/auth/register", data={
        "full_name": "User Two",
        "email": "user2@example.com",
        "password": "pass123",
    }, files={
        "id_document": ("test.pdf", b"test content", "application/pdf")
    })
    
    token1 = user1_response.json()["access_token"]
    token2 = user2_response.json()["access_token"]
    
    # Create accounts
    account1 = client.post(
        "/accounts/create",
        json={"initial_deposit": 1000.0},
        headers={"Authorization": f"Bearer {token1}"}
    ).json()
    account2 = client.post(
        "/accounts/create",
        json={"initial_deposit": 500.0},
        headers={"Authorization": f"Bearer {token2}"}
    ).json()
    
    # Test transfer
    response = client.post(
        "/transactions/transfer",
        json={
            "from_account_id": account1["account_id"],
            "to_account_id": account2["account_id"],
            "amount": 200.0,
            "description": "Test transfer"
        },
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert response.status_code == 200
    
    # Check balances
    balance1 = client.get(
        f"/accounts/{account1['account_id']}/balance",
        headers={"Authorization": f"Bearer {token1}"}
    ).json()
    balance2 = client.get(
        f"/accounts/{account2['account_id']}/balance",
        headers={"Authorization": f"Bearer {token2}"}
    ).json()
    
    assert balance1["balance"] == 800.0
    assert balance2["balance"] == 700.0
