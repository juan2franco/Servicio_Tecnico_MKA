from pydantic import BaseModel
from typing import Optional

class TecnicoCreate(BaseModel):
    full_name: Optional[str] = None
    nombre: Optional[str] = None
    document_type: Optional[str] = "CC"
    document_id: Optional[str] = "000"
    phone: Optional[str] = None
    telefono: Optional[str] = None
    especialidad: str
    email: Optional[str] = None

class TecnicoResponse(BaseModel):
    id: int
    full_name: str
    document_type: str
    document_id: str
    phone: str
    especialidad: str
    email: Optional[str] = None

    class Config:
        from_attributes = True