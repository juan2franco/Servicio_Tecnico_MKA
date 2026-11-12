# Lector NFC MKA

Cada equipo que entra al taller lleva una tarjeta o sticker NFC. Al pasarla por el lector:

- **Tarjeta nueva** → en el panel técnico se abre el formulario para registrar el equipo (cliente, marca, serial, tipo, color, accesorios, estado físico, notas). La tarjeta queda vinculada.
- **Tarjeta conocida** → se abre la ficha del equipo: datos editables, órdenes activas del cliente e historial técnico (agregar, editar, eliminar). Un registro del historial se puede publicar como avance de la orden para que el cliente lo vea en su portal.

Todo se ve en **http://localhost:8000/app/** → Acceso Técnico → pestaña **Lector NFC**, junto con el registro de lecturas en vivo y el estado del lector.

```
Tarjeta NFC → RC522 → Arduino ──USB──> puente_nfc.py ──HTTP──> API (localhost:8000) ──> panel web
                      ESP32 ───────────WiFi──────────────────> API
```

## Qué tarjetas sirven

El módulo RC522 trabaja a 13.56 MHz y lee tarjetas y stickers **NTAG213 / NTAG215 / NTAG216** (los stickers NFC típicos) y **MIFARE Classic**. Se identifica cada tarjeta por su UID.
No sirven los celulares ni las tarjetas bancarias: cambian de UID en cada lectura.

## Opción A — Arduino por cable USB (recomendada)

No necesita WiFi ni configurar IPs.

### Conexión RC522

| RC522 | Arduino UNO / Nano | Arduino Mega | ESP32-S3 |
|-------|--------------------|--------------|----------|
| SDA (SS) | D10 | D10 | GPIO 10 |
| SCK | D13 | D52 | GPIO 12 |
| MOSI | D11 | D51 | GPIO 11 |
| MISO | D12 | D50 | GPIO 13 |
| RST | D9 | D9 | GPIO 14 |
| 3.3V | 3.3V | 3.3V | 3V3 |
| GND | GND | GND | GND |

**El RC522 va a 3.3 V, nunca a 5 V.**

### Pasos

1. En el Arduino IDE instala la librería **MFRC522** (GithubCommunity).
2. Abre `lector_nfc_usb/lector_nfc_usb.ino`, elige tu placa y el puerto COM, y súbelo.
3. **Cierra el Monitor Serie** del Arduino IDE (si queda abierto, ocupa el puerto).
4. Doble clic en `iniciar_mka.bat` (en la carpeta del proyecto). Abre tres cosas:
   - la API en http://localhost:8000
   - el puente USB, que busca el Arduino solo
   - el navegador en http://localhost:8000/app/
5. Entra como técnico → pestaña **Lector NFC**. Debe decir **Lector conectado · COM…**.
6. Pasa una tarjeta.

Si el puente no encuentra el Arduino, te lista los puertos. Ábrelo a mano con el tuyo:

```
cd hardware\puente_usb
python puente_nfc.py --puerto COM4
```

Para probar sin Arduino: `python puente_nfc.py --simular` y escribe UIDs (ej. `04 A3 1F 9C`).

Opcional: un buzzer activo en un pin libre (cambia `#define PIN_BUZZER -1` por ese pin) pita 1 vez si la tarjeta es conocida y 2 si es nueva.

**ESP32-S3 por USB:** usa el puerto marcado "COM/UART". Si usas el puerto "USB" nativo, activa *USB CDC On Boot* en el menú Herramientas.

## Opción B — ESP32 por WiFi

1. Instala las librerías **MFRC522** y **ArduinoJson** (v7).
2. En `lector_rfid_mka/lector_rfid_mka.ino` cambia `WIFI_SSID`, `WIFI_PASSWORD` y `API_URL`.
   `API_URL` es la IP del PC (`ipconfig` → Dirección IPv4), por ejemplo `http://192.168.1.100:8000`. **No** sirve `localhost`.
3. La API debe escuchar en la red: `iniciar_mka.bat` ya la arranca con `--host 0.0.0.0`.
4. Si Windows pregunta por el firewall, permite Python en redes privadas.
5. El ESP32 manda un aviso cada 10 s, así que el panel también lo muestra como conectado.

## Opción C — Lector NFC USB tipo teclado

Los lectores USB que "escriben" el número de la tarjeta funcionan sin Arduino: haz clic en el campo **UID manual / lector USB** de la pestaña Lector NFC y pasa la tarjeta.

## Problemas comunes

| Lo que ves | Qué hacer |
|---|---|
| "Sin conexión con la API" | La API no está corriendo. Abre `iniciar_mka.bat` y mira la ventana "MKA - API". |
| La ventana de la API se cierra o muestra error de MySQL | Enciende MySQL, o usa SQLite: en `iniciar_mka.bat` quita el `rem` de la línea `set "DATABASE_URL=sqlite..."`. |
| "Sin lector conectado" | El puente no está abierto o no encuentra el Arduino. Mira la ventana "MKA - Lector NFC". |
| "No pude abrir COMx" | El Monitor Serie del Arduino IDE está abierto. Ciérralo. |
| "Módulo NFC sin respuesta" | El Arduino está bien pero el RC522 no contesta: revisa cables y que esté a 3.3 V. |
| La tarjeta no se lee | Acércala plana sobre la antena, a menos de 3 cm. Si se queda encima, se registra una sola vez: retírala 3 s. |

## Endpoints

| Método | Ruta | Para qué |
|--------|------|----------|
| POST | `/nfc/lecturas` | El lector manda `{"uid": "04 A3 1F 9C", "lector": "ARDUINO-MKA-01"}`. Responde con el equipo, cliente, orden e historial (o `registrado: false`). |
| GET | `/nfc/lecturas?limite=30&despues_de=0` | Registro de lecturas |
| GET | `/nfc/estado` | Lectores conectados y última lectura (el panel lo consulta cada 1.5 s) |
| POST | `/nfc/heartbeat` | Aviso de "sigo conectado" del puente / ESP32 |
| GET | `/nfc/buscar?uid=...` | Ficha por UID |
| GET | `/nfc/equipos` | Equipos (`?cliente_id=` y `?con_historial=true` opcionales) |
| POST | `/nfc/equipos` | Registrar equipo nuevo y vincular la tarjeta |
| GET / PUT | `/nfc/equipos/{id}` | Ver / editar la ficha |
| POST | `/nfc/tags` | Vincular tarjeta a un equipo existente (`reemplazar: true` para cambiarla) |
| DELETE | `/nfc/equipos/{id}/tag` | Desvincular tarjeta |
| GET / POST | `/nfc/equipos/{id}/historial` | Ver / agregar historial |
| PUT / DELETE | `/nfc/historial/{id}` | Editar / eliminar un registro del historial |
| POST | `/rfid/lecturas` | Alias de `/nfc/lecturas` para el sketch WiFi anterior |

Documentación interactiva: http://localhost:8000/docs

Tablas nuevas (se crean solas al arrancar): `nfc_tags`, `nfc_lecturas`, `historial_equipo`. A la tabla `dispositivos` se le agregan solas las columnas `tipo_equipo`, `color`, `accesorios`, `estado_fisico` y `notas`.
