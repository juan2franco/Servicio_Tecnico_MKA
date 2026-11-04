from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.order import OrderCreate, OrderResponse
from database import get_db
import models
from typing import List

router = APIRouter(
    prefix="",
    tags=["Ordenes de Servicio"]
)

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    # Verificamos si el cliente asociado existe en la base de datos
    client_exists = db.query(models.ClienteModel).filter(models.ClienteModel.id == order.cliente_id).first()
    if not client_exists:
        raise HTTPException(status_code=404, detail="El cliente asociado no existe en la base de datos")

    # Creamos la orden de servicio usando el modelo correcto
    db_order = models.OrdenModel(
        cliente_id=order.cliente_id,
        equipo=order.equipo,
        descripcion=order.descripcion,
        estado=order.estado or "Solicitado"
    )
    
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@router.get("/", response_model=List[OrderResponse])
def list_orders(db: Session = Depends(get_db)):
    orders = db.query(models.OrdenModel).all()
    return orders