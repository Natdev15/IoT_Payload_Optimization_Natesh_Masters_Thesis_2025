/*
 * ESP32 Struct+Zlib Implementation Example
 * Exact match to Python struct_zlib_compress function
 * Dependencies: ESP-IDF framework, zlib, FreeRTOS
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

// ESP-IDF includes
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_http_client.h"
#include "zlib.h"

// Configuration
#define MAX_PAYLOAD_SIZE 158
#define MAX_STRING_LENGTH 64
#define HTTP_TIMEOUT_MS 10000

static const char *TAG = "ESP32_STRUCT_ZLIB";

// Container data structure (exact field order as Python)
typedef struct {
    char msisdn[MAX_STRING_LENGTH];        // SIM ID
    char iso6346[MAX_STRING_LENGTH];       // Container ID
    char time[MAX_STRING_LENGTH];          // UTC time DDMMYY hhmmss.s
    uint8_t rssi;                         // RSSI
    char cgi[MAX_STRING_LENGTH];          // Cell ID Location
    uint8_t ble_m;                        // BLE source node
    uint8_t bat_soc;                      // Battery %
    float acc_x, acc_y, acc_z;            // Accelerometer
    float temperature;                     // °C
    float humidity;                        // %RH
    float pressure;                        // hPa
    char door[2];                         // Door status
    uint8_t gnss;                         // GPS status
    float latitude;                        // DD format
    float longitude;                       // DD format
    float altitude;                        // meters
    float speed;                           // m/s
    float heading;                         // degrees
    uint8_t nsat;                         // Number of satellites
    float hdop;                           // HDOP
} container_data_t;

// HTTP client configuration
static esp_http_client_config_t http_config = {
    .url = "http://your-server:3000/container-data",
    .timeout_ms = HTTP_TIMEOUT_MS,
    .method = HTTP_METHOD_POST,
    .headers = { .content_type = "application/octet-stream" }
};

// Global variables
static esp_http_client_handle_t http_client = NULL;
static bool wifi_connected = false;

// Function prototypes
static void generate_test_data(container_data_t *data);
static size_t struct_zlib_compress(const container_data_t *data, uint8_t *compressed_buffer);
static esp_err_t send_compressed_data(const uint8_t *data, size_t size);
static void wifi_init_sta(void);
static void container_data_task(void *pvParameters);

// Generate realistic test container data
static void generate_test_data(container_data_t *data) {
    static uint32_t container_counter = 0;
    container_counter++;
    
    // Generate timestamp (DDMMYY hhmmss.s format)
    time_t now;
    struct tm timeinfo;
    time(&now);
    localtime_r(&now, &timeinfo);
    
    snprintf(data->time, MAX_STRING_LENGTH, "%02d%02d%02d %02d%02d%02d.%d",
             timeinfo.tm_mday, timeinfo.tm_mon + 1, (timeinfo.tm_year + 1900) % 100,
             timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec, 
             (int)(esp_timer_get_time() / 100000) % 10);
    
    // Generate container data
    snprintf(data->iso6346, MAX_STRING_LENGTH, "LMCU%07lu", container_counter);
    snprintf(data->msisdn, MAX_STRING_LENGTH, "39360050%04d", 4800 + (container_counter % 200));
    
    // Sensor data with realistic variations
    data->rssi = 15 + (container_counter % 21);
    data->ble_m = container_counter % 2;
    data->bat_soc = 10 + (container_counter % 87);
    data->acc_x = -993.9f + (container_counter % 20) * 0.5f;
    data->acc_y = -27.1f + (container_counter % 10) * 0.3f;
    data->acc_z = -52.0f + (container_counter % 10) * 0.4f;
    data->temperature = 17.0f + (container_counter % 10) * 0.5f;
    data->humidity = 71.0f + (container_counter % 20) - 10.0f;
    data->pressure = 1012.4f + (container_counter % 20) - 10.0f;
    
    const char *door_statuses[] = {"D", "O", "C", "T"};
    strcpy(data->door, door_statuses[container_counter % 4]);
    
    data->gnss = container_counter % 2;
    data->latitude = 31.86f + (container_counter % 50) * 0.01f - 0.25f;
    data->longitude = 28.74f + (container_counter % 50) * 0.01f - 0.25f;
    data->altitude = 49.5f + (container_counter % 20) - 10.0f;
    data->speed = (container_counter % 40) * 0.5f;
    data->heading = (container_counter % 360) * 1.0f;
    data->nsat = 4 + (container_counter % 9);
    data->hdop = 0.5f + (container_counter % 50) * 0.1f;
    
    strcpy(data->cgi, "999-01-1-31D41");
}

// Struct+zlib compression (exact match to Python implementation)
static size_t struct_zlib_compress(const container_data_t *data, uint8_t *compressed_buffer) {
    if (!data || !compressed_buffer) return 0;
    
    // Calculate struct size
    size_t struct_size = 0;
    struct_size += 2 + strlen(data->msisdn) + 2 + strlen(data->iso6346) + 2 + strlen(data->time);
    struct_size += 2 + strlen(data->cgi) + 2 + strlen(data->door);
    struct_size += 1 + 1 + 1 + 1 + 1; // rssi, ble_m, bat_soc, gnss, nsat
    struct_size += 4 * 3 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4; // floats
    
    // Allocate and pack struct data
    uint8_t *struct_buffer = malloc(struct_size);
    if (!struct_buffer) return 0;
    
    size_t offset = 0;
    
    // Pack string fields with length prefixes (big-endian)
    uint16_t msisdn_len = strlen(data->msisdn);
    struct_buffer[offset++] = (msisdn_len >> 8) & 0xFF;
    struct_buffer[offset++] = msisdn_len & 0xFF;
    memcpy(&struct_buffer[offset], data->msisdn, msisdn_len);
    offset += msisdn_len;
    
    uint16_t iso6346_len = strlen(data->iso6346);
    struct_buffer[offset++] = (iso6346_len >> 8) & 0xFF;
    struct_buffer[offset++] = iso6346_len & 0xFF;
    memcpy(&struct_buffer[offset], data->iso6346, iso6346_len);
    offset += iso6346_len;
    
    uint16_t time_len = strlen(data->time);
    struct_buffer[offset++] = (time_len >> 8) & 0xFF;
    struct_buffer[offset++] = time_len & 0xFF;
    memcpy(&struct_buffer[offset], data->time, time_len);
    offset += time_len;
    
    // Pack integer fields
    struct_buffer[offset++] = data->rssi;
    
    uint16_t cgi_len = strlen(data->cgi);
    struct_buffer[offset++] = (cgi_len >> 8) & 0xFF;
    struct_buffer[offset++] = cgi_len & 0xFF;
    memcpy(&struct_buffer[offset], data->cgi, cgi_len);
    offset += cgi_len;
    
    struct_buffer[offset++] = data->ble_m;
    struct_buffer[offset++] = data->bat_soc;
    
    // Pack accelerometer (3 floats, big-endian)
    uint32_t acc_x_int = __builtin_bswap32(*(uint32_t*)&data->acc_x);
    uint32_t acc_y_int = __builtin_bswap32(*(uint32_t*)&data->acc_y);
    uint32_t acc_z_int = __builtin_bswap32(*(uint32_t*)&data->acc_z);
    
    memcpy(&struct_buffer[offset], &acc_x_int, 4); offset += 4;
    memcpy(&struct_buffer[offset], &acc_y_int, 4); offset += 4;
    memcpy(&struct_buffer[offset], &acc_z_int, 4); offset += 4;
    
    // Pack remaining float fields (big-endian)
    uint32_t temp_int = __builtin_bswap32(*(uint32_t*)&data->temperature);
    memcpy(&struct_buffer[offset], &temp_int, 4); offset += 4;
    
    uint32_t humidity_int = __builtin_bswap32(*(uint32_t*)&data->humidity);
    memcpy(&struct_buffer[offset], &humidity_int, 4); offset += 4;
    
    uint32_t pressure_int = __builtin_bswap32(*(uint32_t*)&data->pressure);
    memcpy(&struct_buffer[offset], &pressure_int, 4); offset += 4;
    
    // Pack door status
    uint16_t door_len = strlen(data->door);
    struct_buffer[offset++] = (door_len >> 8) & 0xFF;
    struct_buffer[offset++] = door_len & 0xFF;
    memcpy(&struct_buffer[offset], data->door, door_len);
    offset += door_len;
    
    // Pack remaining fields
    struct_buffer[offset++] = data->gnss;
    
    uint32_t lat_int = __builtin_bswap32(*(uint32_t*)&data->latitude);
    memcpy(&struct_buffer[offset], &lat_int, 4); offset += 4;
    
    uint32_t lon_int = __builtin_bswap32(*(uint32_t*)&data->longitude);
    memcpy(&struct_buffer[offset], &lon_int, 4); offset += 4;
    
    uint32_t alt_int = __builtin_bswap32(*(uint32_t*)&data->altitude);
    memcpy(&struct_buffer[offset], &alt_int, 4); offset += 4;
    
    uint32_t speed_int = __builtin_bswap32(*(uint32_t*)&data->speed);
    memcpy(&struct_buffer[offset], &speed_int, 4); offset += 4;
    
    uint32_t heading_int = __builtin_bswap32(*(uint32_t*)&data->heading);
    memcpy(&struct_buffer[offset], &heading_int, 4); offset += 4;
    
    struct_buffer[offset++] = data->nsat;
    
    uint32_t hdop_int = __builtin_bswap32(*(uint32_t*)&data->hdop);
    memcpy(&struct_buffer[offset], &hdop_int, 4); offset += 4;
    
    // Compress with zlib at maximum level
    uLong compressed_size = compressBound(struct_size);
    if (compressed_size > MAX_PAYLOAD_SIZE) {
        free(struct_buffer);
        return 0;
    }
    
    int zlib_result = compress2(compressed_buffer, &compressed_size, 
                               struct_buffer, struct_size, Z_BEST_COMPRESSION);
    
    free(struct_buffer);
    
    if (zlib_result != Z_OK) return 0;
    
    ESP_LOGI(TAG, "Compression: %zu -> %lu bytes (%.1fx)", 
             struct_size, compressed_size, (float)struct_size / compressed_size);
    
    return (size_t)compressed_size;
}

// Send compressed data via HTTP POST
static esp_err_t send_compressed_data(const uint8_t *data, size_t size) {
    if (!http_client || !data || size == 0) return ESP_ERR_INVALID_ARG;
    if (size > MAX_PAYLOAD_SIZE) return ESP_ERR_INVALID_SIZE;
    
    esp_http_client_set_post_field(http_client, (const char*)data, size);
    
    esp_err_t err = esp_http_client_perform(http_client);
    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(http_client);
        if (status_code == 200) return ESP_OK;
    }
    return err;
}

// Initialize WiFi in station mode
static void wifi_init_sta(void) {
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    
    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, 
                                                      &wifi_event_handler, NULL, &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, 
                                                      &ip_event_handler, NULL, &instance_got_ip));
    
    wifi_config_t wifi_config = {
        .sta = { .ssid = CONFIG_WIFI_SSID, .password = CONFIG_WIFI_PASSWORD }
    };
    
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());
}

// WiFi event handler
static void wifi_event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        wifi_connected = false;
        esp_wifi_connect();
    }
}

// IP event handler
static void ip_event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) {
    if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        wifi_connected = true;
    }
}

// Main container data processing task
static void container_data_task(void *pvParameters) {
    container_data_t container_data;
    uint8_t compressed_buffer[MAX_PAYLOAD_SIZE];
    uint32_t message_counter = 0;
    
    while (1) {
        if (!wifi_connected) {
            vTaskDelay(pdMS_TO_TICKS(5000));
            continue;
        }
        
        generate_test_data(&container_data);
        size_t compressed_size = struct_zlib_compress(&container_data, compressed_buffer);
        
        if (compressed_size > 0) {
            esp_err_t send_result = send_compressed_data(compressed_buffer, compressed_size);
            if (send_result == ESP_OK) {
                message_counter++;
                ESP_LOGI(TAG, "Message %lu sent (%zu bytes)", message_counter, compressed_size);
            }
        }
        
        vTaskDelay(pdMS_TO_TICKS(30000)); // 30 seconds
    }
}

// Main application entry point
void app_main(void) {
    ESP_LOGI(TAG, "ESP32 Struct+Zlib Container Data Transmitter Starting...");
    
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    
    // Initialize WiFi
    wifi_init_sta();
    
    // Wait for WiFi connection
    while (!wifi_connected) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
    
    // Initialize HTTP client
    http_client = esp_http_client_init(&http_config);
    if (http_client == NULL) return;
    
    // Create container data task
    xTaskCreate(container_data_task, "container_data", 8192, NULL, 5, NULL);
    
    ESP_LOGI(TAG, "ESP32 Struct+Zlib Container Data Transmitter Started Successfully!");
}

