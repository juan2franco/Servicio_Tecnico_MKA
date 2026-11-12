# MKA · MASKINSTOBA — Servicio Técnico

Plataforma para un centro de servicio técnico:

- **Clientes**: se registran, crean órdenes de servicio, registran sus equipos y siguen el avance en tiempo real.
- **Técnicos**: toman órdenes (máximo 4 a la vez), publican avances y, con un **lector NFC**, identifican cada equipo y llevan su **historial técnico**.

## Cómo abrirlo

### Opción 1: Windows con un clic

1. La primera vez, doble clic en `crear_acceso_directo.bat`. Crea en el escritorio **MKA Servicio Tecnico**, **Apagar MKA** y **MKA Base de datos**.
2. Doble clic en **MKA Servicio Tecnico**. Enciende la API, el lector NFC y el enlace público, abre el panel en http://localhost:8000/app/ y deja copiado el enlace para compartir.

Usa el `backend\.venv` si existe. La base de datos es el MySQL de `backend/database.py`; si no responde, la API sigue con SQLite (`backend/mka_local.db`) y lo avisa.

### Opción 2: Docker

```
iniciar_docker.bat          (o: docker compose up -d --build)
```

| Servicio | Dirección |
|---|---|
| Panel (servido por la API) | http://localhost:8000/app/ |
| Panel (nginx) | http://localhost |
| API y documentación | http://localhost:8000/docs |
| Base de datos (Adminer) | http://localhost:8081 · servidor `db`, usuario `root`, base `mka_db` |
| MySQL desde el PC | `localhost:3316` |

El lector NFC y el enlace público corren en Windows y le hablan a la API en `localhost:8000`, con o sin Docker.

## Estructura

```
backend/                 API FastAPI + SQLAlchemy
  app/api/clients.py     clientes, dispositivos y login de clientes
  app/api/tecnicos.py    técnicos y login de técnicos
  app/api/orders.py      órdenes de servicio
  app/api/nfc.py         lector NFC: lecturas, ficha del equipo, tarjetas, historial
  app/api/compartir.py   enlaces para compartir (internet y red local)
  app/api/basedatos.py   visor de la base de datos (solo desde este PC)
  app/seguridad.py       contraseñas cifradas (PBKDF2)
  models.py              tablas
  migraciones.py         agrega columnas nuevas a tablas existentes
  database.py            conexión (MySQL, con respaldo SQLite)
frontend/                página web (Tailwind)
  app.js                 cliente, técnico y órdenes
  nfc.js                 pestaña Lector NFC
  compartir.js           botón Compartir y acceso a Base de datos
  basedatos.html         visor de la base de datos
hardware/                lector NFC: sketches, puente USB y guía (hardware/README.md)
herramientas/            enlace público con Cloudflare Tunnel
iniciar_mka.bat · apagar_mka.bat · iniciar_docker.bat · crear_acceso_directo.bat
```

## Lector NFC

ESP32-S3 (o Arduino UNO/Nano) + módulo RC522 + tarjetas/stickers NTAG o MIFARE. Conexiones, carga del sketch y solución de problemas en **[hardware/README.md](hardware/README.md)**.

Flujo: tarjeta → RC522 → ESP32 → USB → `puente_nfc.py` → `POST /nfc/lecturas` → el panel técnico abre la ficha del equipo (o el registro si la tarjeta es nueva).

## Compartir por internet

`herramientas/compartir_internet.py` descarga `cloudflared` la primera vez y abre un **Cloudflare Quick Tunnel** hacia `localhost:8000`. El enlace `https://….trycloudflare.com/app/` funciona mientras el PC tenga MKA encendido y cambia cada vez. Se ve en el botón **Compartir** de la página.

## Ver la base de datos

- Sin Docker: botón **Base de datos** en la página, o el ícono **MKA Base de datos** (http://localhost:8000/app/basedatos.html). Es de solo lectura, oculta las contraseñas y solo funciona desde el mismo PC.
- Con Docker: Adminer en http://localhost:8081.

## Seguridad (estado actual)

- El inicio de sesión se valida en el servidor y las contraseñas se guardan cifradas. Las contraseñas viejas en texto plano se cifran solas en el siguiente inicio de sesión.
- Pendiente: la API no usa sesiones/tokens todavía, así que quien tenga el enlace público puede consultar datos de clientes o registrarse como técnico. Compartir el enlace solo con personas de confianza.
