from pydantic import BaseModel
from typing import Optional

class ClientCreate(BaseModel):
    full_name: str
    document_type: str
    document_id: str
    phone: str
    email: Optional[str] = None
    
class ClientResponse(ClientCreate):
    id: int
        
    class Config: 
         from_attributes = True
            
            
    