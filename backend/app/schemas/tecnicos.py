from pydantic import BaseModel
from typing import Optional

class TecnicoCreate(BaseModel):
    full_name: str
    document_type: str
    document_id: str
    phone: str
    especiality: str
    email: Optional[str] = None
    
class TecnicoResponse(TecnicoCreate):
    id: int
        
    class Config: 
         from_attributes = True
         