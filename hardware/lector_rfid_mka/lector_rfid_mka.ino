#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Lector NFC MKA por WiFi (ESP32-S3 + RC522).
// Si prefieres conectarlo por cable USB al PC, usa ../lector_nfc_usb/ y el puente USB.

constexpr uint8_t SS_PIN = 10;
constexpr uint8_t RST_PIN = 14;
constexpr uint8_t SCK_PIN = 12;
constexpr uint8_t MISO_PIN = 13;
constexpr uint8_t MOSI_PIN = 11;

const char* WIFI_SSID = "TU_RED_WIFI";
const char* WIFI_PASSWORD = "TU_CLAVE_WIFI";
const char* API_URL = "http://192.168.1.100:8000";   // IP del PC (ipconfig), NO localhost
const char* LECTOR_ID = "ESP32-MKA-01";

constexpr unsigned long TIEMPO_RETIRO_MS = 3000;
constexpr unsigned long TIMEOUT_WIFI_MS = 15000;
constexpr uint16_t TIMEOUT_HTTP_MS = 5000;
constexpr unsigned long INTERVALO_HEARTBEAT_MS = 10000;

MFRC522 lector(SS_PIN, RST_PIN);
String ultimoUid;
unsigned long ultimaDeteccion = 0;
unsigned long ultimoHeartbeat = 0;

bool conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.print("Conectando a ");
  Serial.print(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < TIMEOUT_WIFI_MS) {
    delay(300);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("No se pudo conectar al WiFi, la lectura no se guardo.");
    return false;
  }

  Serial.print("WiFi conectado, IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

bool chipResponde() {
  byte version = lector.PCD_ReadRegister(MFRC522::VersionReg);
  return version != 0x00 && version != 0xFF;
}

String leerUid() {
  String uid;
  for (byte i = 0; i < lector.uid.size; ++i) {
    if (i) uid += ' ';
    if (lector.uid.uidByte[i] < 16) uid += '0';
    uid += String(lector.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// Avisa a la API que el lector sigue vivo (el panel muestra "Lector conectado").
void enviarHeartbeat() {
  if (millis() - ultimoHeartbeat < INTERVALO_HEARTBEAT_MS) return;
  ultimoHeartbeat = millis();
  if (WiFi.status() != WL_CONNECTED) return;

  bool ok = chipResponde();
  if (!ok) lector.PCD_Init();

  JsonDocument cuerpo;
  cuerpo["lector"] = LECTOR_ID;
  cuerpo["modo"] = "wifi";
  cuerpo["puerto"] = WiFi.localIP().toString();
  cuerpo["chip_ok"] = ok;
  String json;
  serializeJson(cuerpo, json);

  HTTPClient http;
  http.begin(String(API_URL) + "/nfc/heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(2000);
  http.POST(json);
  http.end();
}

void mostrarRespuesta(JsonDocument& doc) {
  Serial.println("----------------------------------------");
  Serial.printf("Lectura #%d guardada\n", doc["lectura_id"] | 0);
  Serial.println(doc["mensaje"] | "");

  if (!(doc["registrado"] | false)) {
    Serial.println("Registra esta tarjeta desde el panel tecnico (pestana Lector NFC).");
    Serial.println("----------------------------------------");
    return;
  }

  Serial.printf("Equipo:  %s (%s)\n",
                doc["dispositivo"]["nombre_equipo"] | "-",
                doc["dispositivo"]["marca"] | "-");
  Serial.printf("Serial:  %s\n", doc["dispositivo"]["serial_modelo"] | "N/A");
  Serial.printf("Cliente: %s - Tel: %s\n",
                doc["cliente"]["full_name"] | "-",
                doc["cliente"]["phone"] | "-");

  if (doc["orden"].isNull()) {
    Serial.println("Orden:   sin orden activa");
  } else {
    Serial.printf("Orden:   #%d - %s\n", doc["orden"]["id"] | 0, doc["orden"]["estado"] | "-");
    Serial.printf("Avance:  %s\n", doc["orden"]["avance_realtime"] | "-");
    Serial.printf("Presupuesto: $%.0f\n", doc["orden"]["presupuesto"] | 0.0);
  }
  Serial.println("----------------------------------------");
}

void enviarLectura(const String& uid) {
  if (!conectarWiFi()) return;

  JsonDocument cuerpo;
  cuerpo["uid"] = uid;
  cuerpo["lector"] = LECTOR_ID;
  String json;
  serializeJson(cuerpo, json);

  HTTPClient http;
  http.begin(String(API_URL) + "/nfc/lecturas");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(TIMEOUT_HTTP_MS);

  int codigo = http.POST(json);
  if (codigo <= 0) {
    Serial.printf("No se pudo contactar la API: %s\n", http.errorToString(codigo).c_str());
    http.end();
    return;
  }

  String respuesta = http.getString();
  http.end();

  if (codigo != 201 && codigo != 200) {
    Serial.printf("La API respondio %d: %s\n", codigo, respuesta.c_str());
    return;
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, respuesta);
  if (error) {
    Serial.printf("Respuesta invalida de la API: %s\n", error.c_str());
    return;
  }

  mostrarRespuesta(doc);
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  lector.PCD_Init();
  delay(4);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  conectarWiFi();

  Serial.println("Lector NFC MKA listo. Acerca una tarjeta.");
}

void loop() {
  enviarHeartbeat();

  byte atqa[2];
  byte longitud = sizeof(atqa);
  MFRC522::StatusCode estado = lector.PICC_WakeupA(atqa, &longitud);

  if ((estado == MFRC522::STATUS_OK || estado == MFRC522::STATUS_COLLISION)
      && lector.PICC_ReadCardSerial()) {
    String uid = leerUid();
    lector.PICC_HaltA();
    lector.PCD_StopCrypto1();

    bool mismaTarjeta = uid == ultimoUid && millis() - ultimaDeteccion < TIEMPO_RETIRO_MS;
    ultimoUid = uid;

    if (!mismaTarjeta) {
      Serial.print("UID: ");
      Serial.println(uid);
      enviarLectura(uid);
    }

    ultimaDeteccion = millis();
    delay(300);
  } else {
    delay(150);
  }
}
