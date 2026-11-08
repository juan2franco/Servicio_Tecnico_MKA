from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class ClienteModel(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    document_type = Column(String(10), nullable=False)
    document_id = Column(String(20), unique=True, index=True, nullable=False)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=False)
    direccion = Column(String(150), nullable=False)
    password = Column(String(100), nullable=False)

    ordenes = relationship("OrdenModel", back_populates="cliente")
    dispositivos = relationship("DispositivoModel", back_populates="cliente")

class TecnicoModel(Base):
    __tablename__ = "tecnicos"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    especialidad = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    document_type = Column(String(10), default="CC")
    document_id = Column(String(20), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False)

    ordenes = relationship("OrdenModel", back_populates="tecnico")

class DispositivoModel(Base):
    __tablename__ = "dispositivos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    nombre_equipo = Column(String(100), nullable=False)
    marca = Column(String(50), nullable=False)
    serial_modelo = Column(String(50), nullable=True)

    cliente = relationship("ClienteModel", back_populates="dispositivos")

class OrdenModel(Base):
    __tablename__ = "ordenes"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True) # Puede ser NULL si nadie la ha tomado
    equipo = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=False)
    presupuesto = Column(Float, default=0.0)
    estado = Column(String(50), default="Solicitado") # Solicitado, En Reparación, Finalizado
    avance_realtime = Column(Text, default="Orden creada y a la espera de técnico.") # Avance continuo

    cliente = relationship("ClienteModel", back_populates="ordenes")
    tecnico = relationship("TecnicoModel", back_populates="ordenes")