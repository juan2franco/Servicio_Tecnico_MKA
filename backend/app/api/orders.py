from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
import models

router = APIRouter(prefix="/orders", tags=["Ordenes de Servicio"])

class OrderCreate(BaseModel):
    cliente_id: int
    equipo: str
    descripcion: str

class OrderUpdateStatus(BaseModel):
    estado: Optional[str] = None
    avance_realtime: Optional[str] = None
    presupuesto: Optional[float] = None

class OrderResponse(BaseModel):
    id: int
    cliente_id: int
    tecnico_id: Optional[int] = None
    equipo: str
    descripcion: str
    presupuesto: Optional[float] = 0.0
    estado: str
    aprobado_cliente: Optional[int] = 0
    avance_realtime: Optional[str] = None

    class Config:
        from_attributes = True

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    db_order = models.OrdenModel(
        cliente_id=order.cliente_id,
        tecnico_id=None,  # Ahora MySQL aceptará este valor nulo sin arrojar error 500
        equipo=order.equipo,
        descripcion=order.descripcion,
        presupuesto=0.0,
        estado="Solicitado",
        aprobado_cliente=0,
        avance_realtime="Orden creada y a la espera de técnico."
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@router.get("/", response_model=List[OrderResponse])
def list_orders(db: Session = Depends(get_db)):
    return db.query(models.OrdenModel).all()

@router.put("/tomar/{order_id}/{tecnico_id}", response_model=OrderResponse)
def tomar_orden(order_id: int, tecnico_id: int, db: Session = Depends(get_db)):
    ordenes_activas = db.query(models.OrdenModel).filter(
        models.OrdenModel.tecnico_id == tecnico_id,
        models.OrdenModel.estado != "Finalizado"
    ).count()

    if ordenes_activas >= 4:
        raise HTTPException(status_code=400, detail="¡Límite alcanzado! No puedes tener más de 4 órdenes activas simultáneamente.")

    order = db.query(models.OrdenModel).filter(models.OrdenModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.tecnico_id is not None:
        raise HTTPException(status_code=400, detail="Esta orden ya fue tomada por otro técnico.")

    order.tecnico_id = tecnico_id
    order.estado = "En Reparación"
    order.avance_realtime = "Técnico asignado. Iniciando revisión del equipo."
    db.commit()
    db.refresh(order)
    return order

@router.put("/actualizar-avance/{order_id}", response_model=OrderResponse)
def actualizar_avance(order_id: int, payload: OrderUpdateStatus, db: Session = Depends(get_db)):
    order = db.query(models.OrdenModel).filter(models.OrdenModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    if payload.estado:
        order.estado = payload.estado
    if payload.avance_realtime:
        order.avance_realtime = payload.avance_realtime
    if payload.presupuesto is not None:
        order.presupuesto = payload.presupuesto

    db.commit()
    db.refresh(order)
    return order