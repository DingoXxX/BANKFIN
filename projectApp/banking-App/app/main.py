import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))


from fastapi import FastAPI
from app.routes import deposit, user
from app.database import Base, engine
import ssl
import uvicorn



app = FastAPI(title="Secure Banking API")

# Create DB tables
Base.metadata.create_all(bind=engine)

# Register routes
app.include_router(user.router)
app.include_router(deposit.router)

if __name__ == "__main__":
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain("certs/server.crt", "certs/server.key")
uvicorn.run("main:app", host="0.0.0.0", port=8443, ssl_context=context)

