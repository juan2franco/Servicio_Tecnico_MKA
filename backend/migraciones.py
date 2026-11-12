"""Agrega columnas nuevas a tablas que ya existían.

create_all() crea las tablas que faltan, pero no toca las que ya están en la base.
Aquí se añaden, una sola vez, las columnas que se sumaron a `dispositivos`
para la ficha del equipo del lector NFC. Funciona con MySQL y con SQLite.
"""

from sqlalchemy import inspect, text

COLUMNAS_NUEVAS = {
    "dispositivos": {
        "tipo_equipo": "VARCHAR(50)",
        "color": "VARCHAR(30)",
        "accesorios": "VARCHAR(200)",
        "estado_fisico": "VARCHAR(200)",
        "notas": "TEXT",
    },
}


def aplicar(engine) -> None:
    inspector = inspect(engine)
    tablas = set(inspector.get_table_names())

    with engine.begin() as conexion:
        for tabla, columnas in COLUMNAS_NUEVAS.items():
            if tabla not in tablas:
                continue
            existentes = {c["name"] for c in inspector.get_columns(tabla)}
            for nombre, tipo in columnas.items():
                if nombre not in existentes:
                    conexion.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {nombre} {tipo}"))
                    print(f"[migraciones] {tabla}.{nombre} agregada")
