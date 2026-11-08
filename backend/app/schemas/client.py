from pydantic import BaseModel
from typing import List, Optional

class DispositivoCreate(BaseModel):
    cliente_id: int
    nombre_equipo: str
    marca: str
    serial_modelo: Optional[str] = "N/A"

class DispositivoResponse(BaseModel):
    id: int
    cliente_id: int
    nombre_equipo: str
    marca: str
    serial_modelo: Optional[str]

    class Config:
        from_attributes = True

@router.post("/dispositivos/", response_model=DispositivoResponse, status_code=201)
def registrar_dispositivo(disp: DispositivoCreate, db: Session = Depends(get_db)):
    nuevo_disp = models.DispositivoModel(**disp.model_dump())
    db.add(nuevo_disp)
    db.commit()
    db.refresh(nuevo_disp)
    return nuevo_disp

@router.get("/dispositivos/{cliente_id}", response_model=List[DispositivoResponse])
def listar_dispositivos_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return db.query(models.DispositivoModel).filter(models.DispositivoModel.cliente_id == cliente_id).all()