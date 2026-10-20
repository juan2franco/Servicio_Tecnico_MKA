
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class OrderCreate(BaseModel):
    device_name: str 
    issue_description: str
    client_name: str
    estimated_cost: Optional[float] = None
    
class OrderResponse(OrderCreate):
    id: int
    status: str
    created_at: datetime
    
    class Config: 
        from_attributes = True
    
    