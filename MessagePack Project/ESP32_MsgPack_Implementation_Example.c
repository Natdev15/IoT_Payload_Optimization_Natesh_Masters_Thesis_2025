/*
 * ESP32 MessagePack Implementation Example
 * 
 * This file shows exactly how an IoT engineer would implement
 * MessagePack compression on ESP32 for container data transmission.
 * 
 * Libraries required:
 * - mpack: https://github.com/ludocode/mpack
 * - ArduinoJson (optional, for JSON comparison)
 * 
 * Hardware: ESP32 with sensors (GPS, accelerometer, temperature, etc.)
 */

#include <mpack.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Container data structure (matches actual sensor readings exactly)
typedef struct {
    char msisdn[15];        // "393315537896"
    char iso6346[12];       // "LMCU1231230"
    char time[18];          // "200423 002014.0"
    char rssi[5];           // "26"
    char cgi[20];           // "999-01-1-31D41"
    char ble_m[3];          // "0"
    char bat_soc[5];        // "92"
    char acc[50];           // "-1010.0407 -1.4649 -4.3947"
    char temperature[10];   // "17.00"
    char humidity[10];      // "44.00"
    char pressure[15];      // "1012.5043"
    char door[3];           // "D"
    char gnss[3];           // "1"
    char latitude[10];      // "31.8910"
    char longitude[10];     // "28.7041"
    char altitude[10];      // "38.10"
    char speed[10];         // "27.3"
    char heading[10];       // "125.31"
    char nsat[5];           // "06"
    char hdop[5];           // "1.8"
} container_data_t;

// Function to generate container data (simulate sensor readings)
void generate_container_data(container_data_t *data) {
    // Simulate sensor readings (all as strings)
    snprintf(data->msisdn, sizeof(data->msisdn), "39360050%04d", random(4800, 5000));
    snprintf(data->iso6346, sizeof(data->iso6346), "LMCU%07d", random(1, 1000000));
    
    // Generate time string (DDMMYY HHMMSS.S format)
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);
    snprintf(data->time, sizeof(data->time), "%02d%02d%02d %02d%02d%02d.%d",
             timeinfo->tm_mday, timeinfo->tm_mon + 1, timeinfo->tm_year % 100,
             timeinfo->tm_hour, timeinfo->tm_min, timeinfo->tm_sec, random(0, 10));
    
    snprintf(data->rssi, sizeof(data->rssi), "%d", random(15, 35));
    strcpy(data->cgi, "999-01-1-31D41");
    snprintf(data->ble_m, sizeof(data->ble_m), "%d", random(0, 2));
    snprintf(data->bat_soc, sizeof(data->bat_soc), "%d", random(80, 100));
    
    // Accelerometer data (simulated)
    snprintf(data->acc, sizeof(data->acc), "%.4f %.4f %.4f",
             -993.9 + random(-20, 20), -27.1 + random(-10, 10), -52.0 + random(-10, 10));
    
    snprintf(data->temperature, sizeof(data->temperature), "%.2f", 17.0 + random(0, 100) / 10.0);
    snprintf(data->humidity, sizeof(data->humidity), "%.2f", 71.0 + random(-100, 100) / 10.0);
    snprintf(data->pressure, sizeof(data->pressure), "%.4f", 1012.4 + random(-100, 100) / 10.0);
    
    const char* doors[] = {"D", "O", "C", "T"};
    strcpy(data->door, doors[random(0, 4)]);
    
    snprintf(data->gnss, sizeof(data->gnss), "%d", random(0, 2));
    snprintf(data->latitude, sizeof(data->latitude), "%.4f", 31.86 + (random(-50, 50) / 100.0));
    snprintf(data->longitude, sizeof(data->longitude), "%.4f", 28.74 + (random(-50, 50) / 100.0));
    snprintf(data->altitude, sizeof(data->altitude), "%.2f", 49.5 + random(-100, 100) / 10.0);
    snprintf(data->speed, sizeof(data->speed), "%.1f", random(0, 400) / 10.0);
    snprintf(data->heading, sizeof(data->heading), "%.2f", random(0, 36000) / 100.0);
    snprintf(data->nsat, sizeof(data->nsat), "%02d", random(4, 13));
    snprintf(data->hdop, sizeof(data->hdop), "%.1f", 0.5 + random(0, 50) / 10.0);
}

// ESP32 MessagePack compression function (what IoT engineer writes)
size_t msgpack_compress_container_data(const container_data_t *data, uint8_t *buffer, size_t buffer_size) {
    mpack_writer_t writer;
    mpack_writer_init_buffer(&writer, (char*)buffer, buffer_size);
    
    // Start map with 20 key-value pairs
    mpack_start_map(&writer, 20);
    
    // Add all fields to MessagePack map (exact order as Python/Node.js)
    mpack_write_cstr(&writer, "msisdn");
    mpack_write_cstr(&writer, data->msisdn);
    
    mpack_write_cstr(&writer, "iso6346");
    mpack_write_cstr(&writer, data->iso6346);
    
    mpack_write_cstr(&writer, "time");
    mpack_write_cstr(&writer, data->time);
    
    mpack_write_cstr(&writer, "rssi");
    mpack_write_cstr(&writer, data->rssi);
    
    mpack_write_cstr(&writer, "cgi");
    mpack_write_cstr(&writer, data->cgi);
    
    mpack_write_cstr(&writer, "ble-m");
    mpack_write_cstr(&writer, data->ble_m);
    
    mpack_write_cstr(&writer, "bat-soc");
    mpack_write_cstr(&writer, data->bat_soc);
    
    mpack_write_cstr(&writer, "acc");
    mpack_write_cstr(&writer, data->acc);
    
    mpack_write_cstr(&writer, "temperature");
    mpack_write_cstr(&writer, data->temperature);
    
    mpack_write_cstr(&writer, "humidity");
    mpack_write_cstr(&writer, data->humidity);
    
    mpack_write_cstr(&writer, "pressure");
    mpack_write_cstr(&writer, data->pressure);
    
    mpack_write_cstr(&writer, "door");
    mpack_write_cstr(&writer, data->door);
    
    mpack_write_cstr(&writer, "gnss");
    mpack_write_cstr(&writer, data->gnss);
    
    mpack_write_cstr(&writer, "latitude");
    mpack_write_cstr(&writer, data->latitude);
    
    mpack_write_cstr(&writer, "longitude");
    mpack_write_cstr(&writer, data->longitude);
    
    mpack_write_cstr(&writer, "altitude");
    mpack_write_cstr(&writer, data->altitude);
    
    mpack_write_cstr(&writer, "speed");
    mpack_write_cstr(&writer, data->speed);
    
    mpack_write_cstr(&writer, "heading");
    mpack_write_cstr(&writer, data->heading);
    
    mpack_write_cstr(&writer, "nsat");
    mpack_write_cstr(&writer, data->nsat);
    
    mpack_write_cstr(&writer, "hdop");
    mpack_write_cstr(&writer, data->hdop);
    
    // Finish the map
    mpack_finish_map(&writer);
    
    // Get the encoded size
    size_t encoded_size = mpack_writer_buffer_used(&writer);
    
    // Check for errors
    mpack_error_t error = mpack_writer_error(&writer);
    if (error != mpack_ok) {
        Serial.printf("MessagePack encoding error: %s\n", mpack_error_to_string(error));
        return 0;
    }
    
    return encoded_size;
}

// Function to send data via HTTP POST (Astrocast simulation)
bool send_container_data_via_http(const uint8_t *msgpack_data, size_t data_size) {
    HTTPClient http;
    http.begin("http://your-server.com/container-data");
    http.addHeader("Content-Type", "application/octet-stream");
    
    int httpResponseCode = http.POST(msgpack_data, data_size);
    
    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.printf("HTTP Response code: %d\n", httpResponseCode);
        Serial.printf("Response: %s\n", response.c_str());
        http.end();
        return (httpResponseCode == 200);
    } else {
        Serial.printf("HTTP Error: %s\n", http.errorToString(httpResponseCode).c_str());
        http.end();
        return false;
    }
}

// Function to send data via UDP (Astrocast)
bool send_container_data_via_udp(const uint8_t *msgpack_data, size_t data_size) {
    WiFiUDP udp;
    udp.beginPacket("your-astrocast-endpoint.com", 1234);
    size_t bytes_sent = udp.write(msgpack_data, data_size);
    bool success = udp.endPacket();
    
    if (success && bytes_sent == data_size) {
        Serial.printf("UDP: Sent %d bytes successfully\n", bytes_sent);
        return true;
    } else {
        Serial.printf("UDP: Failed to send data\n");
        return false;
    }
}

// Main function to demonstrate the complete flow
void send_container_data() {
    container_data_t container_data;
    uint8_t msgpack_buffer[512];  // Buffer for MessagePack data
    size_t buffer_size = sizeof(msgpack_buffer);
    
    // Step 1: Generate container data (simulate sensor readings)
    generate_container_data(&container_data);
    
    Serial.println("Generated container data:");
    Serial.printf("MSISDN: %s\n", container_data.msisdn);
    Serial.printf("Container ID: %s\n", container_data.iso6346);
    Serial.printf("Temperature: %.2f°C\n", container_data.temperature);
    Serial.printf("Battery: %d%%\n", container_data.bat_soc);
    
    // Step 2: Compress with MessagePack
    size_t msgpack_size = msgpack_compress_container_data(&container_data, msgpack_buffer, buffer_size);
    
    if (msgpack_size == 0) {
        Serial.println("MessagePack compression failed!");
        return;
    }
    
    Serial.printf("MessagePack compressed size: %d bytes\n", msgpack_size);
    Serial.printf("MessagePack data (hex): ");
    for (size_t i = 0; i < msgpack_size && i < 32; i++) {
        Serial.printf("%02x", msgpack_buffer[i]);
    }
    if (msgpack_size > 32) Serial.print("...");
    Serial.println();
    
    // Step 3: Send via HTTP (for testing)
    bool http_success = send_container_data_via_http(msgpack_buffer, msgpack_size);
    
    // Step 4: Send via UDP (for production/Astrocast)
    bool udp_success = send_container_data_via_udp(msgpack_buffer, msgpack_size);
    
    Serial.printf("HTTP send: %s\n", http_success ? "SUCCESS" : "FAILED");
    Serial.printf("UDP send: %s\n", udp_success ? "SUCCESS" : "FAILED");
}

// Arduino setup function
void setup() {
    Serial.begin(115200);
    Serial.println("ESP32 Container Data MessagePack Compression Test");
    
    // Initialize WiFi (for HTTP testing)
    WiFi.begin("your-ssid", "your-password");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected");
    
    // Test MessagePack compression
    send_container_data();
}

// Arduino loop function
void loop() {
    // Send data every 5 minutes
    static unsigned long last_send = 0;
    if (millis() - last_send > 300000) {  // 5 minutes
        send_container_data();
        last_send = millis();
    }
    
    delay(1000);
}

/*
 * COMPARISON WITH PYTHON/NODE.JS:
 * 
 * Python (locust_sender.py):
 * def msgpack_compress(data: dict) -> bytes:
 *     return msgpack.packb(data, use_bin_type=True)
 * 
 * Node.js (server.js):
 * function msgpackDecompress(compressedData) {
 *     const containerData = msgpack.decode(compressedData);
 *     return containerData;
 * }
 * 
 * ESP32 (this file):
 * size_t msgpack_compress_container_data(const container_data_t *data, uint8_t *buffer, size_t buffer_size) {
 *     mpack_writer_t writer;
 *     mpack_writer_init_buffer(&writer, (char*)buffer, buffer_size);
 *     mpack_start_map(&writer, 20);
 *     mpack_write_cstr(&writer, "msisdn");
 *     mpack_write_cstr(&writer, data->msisdn);
 *     // ... add all fields
 *     mpack_finish_map(&writer);
 *     return mpack_writer_buffer_used(&writer);
 * }
 * 
 * All three implementations produce identical MessagePack data that can be
 * decompressed by the Node.js server!
 */ 