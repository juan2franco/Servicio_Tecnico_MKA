from sqlalchemy import Column, Integer, String, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from database import Base

class ClienteModel(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    document_type = Column(String)
    document_id = Column(String, unique=True, index=True)
    email = Column(String, nullable=True)
    phone = Column(String)
    direccion = Column(String)

    ordenes = relationship("OrdenModel", back_populates="cliente")

class TecnicoModel(Base):
    __tablename__ = "tecnicos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    especialidad = Column(String)
    telefono = Column(String)

    ordenes = relationship("OrdenModel", back_populates="tecnico")

class OrdenModel(Base):
    __tablename__ = "ordenes"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    
    equipo = Column(String)
    descripcion = Column(Text)
    
    # Nuevos estados y características "
    estado = Column(String, default="Solicitado") 
    presupuesto = Column(Float, nullable=True)
    aprobado_cliente = Column(Integer, default=0) 
    calificacion = Column(Float, nullable=True) 
    resena = Column(Text, nullable=True)

    cliente = relationship("ClienteModel", back_populates="ordenes")
    tecnico = relationship("TecnicoModel", back_populates="ordenes")