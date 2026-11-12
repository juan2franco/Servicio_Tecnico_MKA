# Lector NFC MKA por WiFi (ESP32 + RC522)

Este sketch manda cada tarjeta por WiFi a la API (`POST /nfc/lecturas`) y muestra la respuesta en el Monitor Serie.

La guía completa (conexiones, conexión por cable USB, flujo en el panel web y solución de problemas) está en **[../README.md](../README.md)**.

Resumen:

1. Librerías **MFRC522** y **ArduinoJson** (v7).
2. Cambia `WIFI_SSID`, `WIFI_PASSWORD` y `API_URL` (IP del PC con `ipconfig`, no `localhost`).
3. Arranca todo con `iniciar_mka.bat` (la API queda escuchando en la red).
4. Sube el sketch. En http://localhost:8000/app/ → Acceso Técnico → **Lector NFC** verás las lecturas y el lector como conectado.
