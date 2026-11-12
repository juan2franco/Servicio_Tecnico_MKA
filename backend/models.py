from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


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
    nombre = Column(String(100), nullable=False)  # Coincide con tu BD
    document_type = Column(String(10), default="CC")
    document_id = Column(String(20), unique=True, index=True, nullable=False)
    telefono = Column(String(20), nullable=True)  # Coincide con tu BD
    especialidad = Column(String(100), nullable=True)
    password = Column(String(100), nullable=False)

    ordenes = relationship("OrdenModel", back_populates="tecnico")


class DispositivoModel(Base):
    __tablename__ = "dispositivos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    nombre_equipo = Column(String(100), nullable=False)
    marca = Column(String(50), nullable=False)
    serial_modelo = Column(String(50), nullable=True)

    # Datos que el técnico completa al registrar el equipo con la tarjeta NFC.
    # Si la tabla ya existía, migraciones.py agrega estas columnas al arrancar.
    tipo_equipo = Column(String(50), nullable=True)
    color = Column(String(30), nullable=True)
    accesorios = Column(String(200), nullable=True)
    estado_fisico = Column(String(200), nullable=True)
    notas = Column(Text, nullable=True)

    cliente = relationship("ClienteModel", back_populates="dispositivos")
    tag = relationship(
        "NfcTagModel",
        back_populates="dispositivo",
        uselist=False,
        cascade="all, delete-orphan",
    )
    historial = relationship(
        "HistorialEquipoModel",
        back_populates="dispositivo",
        cascade="all, delete-orphan",
        order_by=lambda: (HistorialEquipoModel.fecha.desc(), HistorialEquipoModel.id.desc()),
    )


class OrdenModel(Base):
    __tablename__ = "ordenes"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    equipo = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=False)
    presupuesto = Column(Float, default=0.0)
    estado = Column(String(50), default="Solicitado")
    aprobado_cliente = Column(Integer, default=0)
    avance_realtime = Column(Text, default="Orden creada y a la espera de técnico.")

    cliente = relationship("ClienteModel", back_populates="ordenes")
    tecnico = relationship("TecnicoModel", back_populates="ordenes")


# ---------------------------------------------------------------------------
# Lector NFC
# ---------------------------------------------------------------------------

class NfcTagModel(Base):
    """Tarjeta / sticker NFC pegado a un equipo. Un equipo tiene como máximo una."""

    __tablename__ = "nfc_tags"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(40), unique=True, index=True, nullable=False)
    dispositivo_id = Column(Integer, ForeignKey("dispositivos.id"), unique=True, nullable=False)
    vinculado_en = Column(DateTime, default=datetime.now)

    dispositivo = relationship("DispositivoModel", back_populates="tag")


class NfcLecturaModel(Base):
    """Cada vez que una tarjeta pasa por el lector queda un registro aquí."""

    __tablename__ = "nfc_lecturas"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(40), index=True, nullable=False)
    lector = Column(String(50), nullable=False, default="LECTOR")
    tipo_tarjeta = Column(String(50), nullable=True)
    dispositivo_id = Column(Integer, ForeignKey("dispositivos.id"), nullable=True)
    fecha = Column(DateTime, default=datetime.now, index=True)


class HistorialEquipoModel(Base):
    """Bitácora técnica del equipo: diagnósticos, reparaciones, repuestos, entregas."""

    __tablename__ = "historial_equipo"

    id = Column(Integer, primary_key=True, index=True)
    dispositivo_id = Column(Integer, ForeignKey("dispositivos.id"), nullable=False, index=True)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    orden_id = Column(Integer, ForeignKey("ordenes.id"), nullable=True)
    tipo = Column(String(40), nullable=False, default="Nota")
    descripcion = Column(Text, nullable=False)
    repuestos = Column(String(200), nullable=True)
    costo = Column(Float, nullable=True)
    fecha = Column(DateTime, default=datetime.now, index=True)
    editado_en = Column(DateTime, nullable=True)

    dispositivo = relationship("DispositivoModel", back_populates="historial")
    tecnico = relationship("TecnicoModel")
