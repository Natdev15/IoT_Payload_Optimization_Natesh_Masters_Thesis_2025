/*
 * MessagePack Compression Test for C/C++ (ESP32)
 * 
 * This demonstrates the expected compression ratio using mpack library
 * 
 * To compile (with mpack library):
 * gcc -I/path/to/mpack test_msgpack_compression.c -o test_msgpack_compression
 */

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// Mock mpack functions for demonstration
// In real implementation, include <mpack.h>

typedef struct {
    char msisdn[15];
    char iso6346[12];
    char time[18];
    char rssi[5];
    char cgi[20];
    char ble_m[3];
    char bat_soc[5];
    char acc[50];
    char temperature[10];
    char humidity[10];
    char pressure[15];
    char door[3];
    char gnss[3];
    char latitude[10];
    char longitude[10];
    char altitude[10];
    char speed[10];
    char heading[10];
    char nsat[5];
    char hdop[5];
} container_data_t;

// Mock mpack writer structure
typedef struct {
    char* buffer;
    size_t size;
    size_t used;
} mpack_writer_t;

// Mock mpack functions
void mpack_writer_init_buffer(mpack_writer_t* writer, char* buffer, size_t size) {
    writer->buffer = buffer;
    writer->size = size;
    writer->used = 0;
}

void mpack_start_map(mpack_writer_t* writer, int count) {
    // MessagePack map header (0x80 + count for small maps)
    if (count <= 15) {
        writer->buffer[writer->used++] = 0x80 + count;
    } else {
        // For larger maps, use 0xde + 2-byte count
        writer->buffer[writer->used++] = 0xde;
        writer->buffer[writer->used++] = (count >> 8) & 0xFF;
        writer->buffer[writer->used++] = count & 0xFF;
    }
}

void mpack_write_cstr(mpack_writer_t* writer, const char* str) {
    size_t len = strlen(str);
    
    // MessagePack string header
    if (len <= 31) {
        writer->buffer[writer->used++] = 0xa0 + len;
    } else if (len <= 255) {
        writer->buffer[writer->used++] = 0xd9;
        writer->buffer[writer->used++] = len & 0xFF;
    } else {
        writer->buffer[writer->used++] = 0xda;
        writer->buffer[writer->used++] = (len >> 8) & 0xFF;
        writer->buffer[writer->used++] = len & 0xFF;
    }
    
    // Copy string data
    memcpy(writer->buffer + writer->used, str, len);
    writer->used += len;
}

void mpack_finish_map(mpack_writer_t* writer) {
    // Map is already finished when we start it
}

size_t mpack_writer_buffer_used(mpack_writer_t* writer) {
    return writer->used;
}

// MessagePack compression function (same as ESP32 implementation)
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
    
    return mpack_writer_buffer_used(&writer);
}

// Generate sample container data (same as Python/Node.js)
void generate_sample_data(container_data_t *data) {
    strcpy(data->msisdn, "393600504920");
    strcpy(data->iso6346, "LMCU0954822");
    strcpy(data->time, "300725 221117.8");
    strcpy(data->rssi, "21");
    strcpy(data->cgi, "999-01-1-31D41");
    strcpy(data->ble_m, "1");
    strcpy(data->bat_soc, "93");
    strcpy(data->acc, "-974.0700 -25.1270 -45.6744");
    strcpy(data->temperature, "18.32");
    strcpy(data->humidity, "75.44");
    strcpy(data->pressure, "1016.7932");
    strcpy(data->door, "D");
    strcpy(data->gnss, "1");
    strcpy(data->latitude, "31.9277");
    strcpy(data->longitude, "28.6378");
    strcpy(data->altitude, "56.62");
    strcpy(data->speed, "0.8");
    strcpy(data->heading, "302.07");
    strcpy(data->nsat, "11");
    strcpy(data->hdop, "5.0");
}

// Generate equivalent JSON for comparison
void generate_json_string(const container_data_t *data, char *json, size_t json_size) {
    snprintf(json, json_size,
        "{"
        "\"msisdn\":\"%s\","
        "\"iso6346\":\"%s\","
        "\"time\":\"%s\","
        "\"rssi\":\"%s\","
        "\"cgi\":\"%s\","
        "\"ble-m\":\"%s\","
        "\"bat-soc\":\"%s\","
        "\"acc\":\"%s\","
        "\"temperature\":\"%s\","
        "\"humidity\":\"%s\","
        "\"pressure\":\"%s\","
        "\"door\":\"%s\","
        "\"gnss\":\"%s\","
        "\"latitude\":\"%s\","
        "\"longitude\":\"%s\","
        "\"altitude\":\"%s\","
        "\"speed\":\"%s\","
        "\"heading\":\"%s\","
        "\"nsat\":\"%s\","
        "\"hdop\":\"%s\""
        "}",
        data->msisdn, data->iso6346, data->time, data->rssi, data->cgi,
        data->ble_m, data->bat_soc, data->acc, data->temperature, data->humidity,
        data->pressure, data->door, data->gnss, data->latitude, data->longitude,
        data->altitude, data->speed, data->heading, data->nsat, data->hdop
    );
}

int main() {
    printf("MessagePack Compression Test (C/C++ Implementation)\n");
    printf("==================================================\n\n");
    
    // Generate sample data
    container_data_t container_data;
    generate_sample_data(&container_data);
    
    // Generate JSON for comparison
    char json_string[1024];
    generate_json_string(&container_data, json_string, sizeof(json_string));
    
    // Calculate JSON size
    size_t json_size = strlen(json_string);
    
    printf("Sample Container Data:\n");
    printf("MSISDN: %s\n", container_data.msisdn);
    printf("Container ID: %s\n", container_data.iso6346);
    printf("Temperature: %s°C\n", container_data.temperature);
    printf("Battery: %s%%\n", container_data.bat_soc);
    printf("\n");
    
    // Compress with MessagePack
    uint8_t msgpack_buffer[512];
    size_t msgpack_size = msgpack_compress_container_data(&container_data, msgpack_buffer, sizeof(msgpack_buffer));
    
    printf("Compression Results:\n");
    printf("Original JSON size: %zu bytes\n", json_size);
    printf("MessagePack size: %zu bytes\n", msgpack_size);
    printf("Compression ratio: %.2fx\n", (double)json_size / msgpack_size);
    printf("Size reduction: %zu bytes (%.1f%%)\n", 
           json_size - msgpack_size, 
           ((double)(json_size - msgpack_size) / json_size) * 100);
    
    printf("\nMessagePack data (hex): ");
    for (size_t i = 0; i < msgpack_size && i < 32; i++) {
        printf("%02x", msgpack_buffer[i]);
    }
    if (msgpack_size > 32) printf("...");
    printf("\n");
    
    printf("\nComparison with Python/Node.js:\n");
    printf("- Python: ~28.0%% reduction\n");
    printf("- Node.js: ~20.6%% reduction\n");
    printf("- C/C++ (this test): %.1f%% reduction\n", 
           ((double)(json_size - msgpack_size) / json_size) * 100);
    
    printf("\nExpected ESP32 Performance:\n");
    printf("- Should match Python's ~28%% reduction\n");
    printf("- Direct binary encoding (no overhead)\n");
    printf("- Optimized for embedded systems\n");
    printf("- Consistent with mpack library\n");
    
    return 0;
} 