from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.client import ClientCreate, ClientResponse
from database import get_db
import models
from typing import List

router = APIRouter(
    prefix="",  # Vacío para que tome el prefijo /clients definido en el main.py
    tags=["Clientes de servicio"]
)

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(client: ClientCreate, db: Session = Depends(get_db)):
    db_client = models.ClienteModel(
        full_name=client.full_name,
        document_type=client.document_type,
        document_id=client.document_id,
        phone=client.phone,
        email=client.email,
        direccion=client.direccion
    )
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@router.get("/", response_model=List[ClientResponse])
def list_clients(db: Session = Depends(get_db)):
    clients = db.query(models.ClienteModel).all()
    return clients