/*
 * ESP32 Protocol Buffer Implementation for Container Data
 * 
 * This file demonstrates how to implement Protocol Buffer compression
 * on an ESP32 device for IoT container tracking applications.
 * 
 * Requirements:
 * - ESP-IDF framework
 * - nanopb library (lightweight protobuf implementation)
 * - FreeRTOS for task management
 * 
 * Author: Generated for ProtoBuf Project
 * Date: 2024
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "driver/gpio.h"
#include "driver/adc.h"
#include "driver/i2c.h"
#include "driver/spi_master.h"

// Protocol Buffer generated header (from container_data.proto)
#include "container_data.pb.h"

// Configuration
#define TAG "CONTAINER_DATA"
#define TASK_STACK_SIZE 4096
#define QUEUE_SIZE 10
#define SENSOR_READ_INTERVAL_MS 5000
#define TRANSMISSION_INTERVAL_MS 30000

// GPIO pins for sensors
#define DOOR_SENSOR_PIN GPIO_NUM_4
#define BLE_ENABLE_PIN GPIO_NUM_5
#define GNSS_ENABLE_PIN GPIO_NUM_18
#define BATTERY_ADC_CHANNEL ADC1_CHANNEL_0

// I2C configuration for sensors
#define I2C_MASTER_SCL_IO GPIO_NUM_22
#define I2C_MASTER_SDA_IO GPIO_NUM_21
#define I2C_MASTER_NUM I2C_NUM_0
#define I2C_MASTER_FREQ_HZ 100000

// SPI configuration for LoRa/Radio module
#define SPI_MISO_PIN GPIO_NUM_19
#define SPI_MOSI_PIN GPIO_NUM_23
#define SPI_SCLK_PIN GPIO_NUM_18
#define SPI_CS_PIN GPIO_NUM_5

// Global variables
static QueueHandle_t data_queue;
static TaskHandle_t sensor_task_handle;
static TaskHandle_t transmission_task_handle;

// Container data structure (matches protobuf schema)
typedef struct {
    char msisdn[16];        // SIM ID
    char iso6346[16];       // Container ID
    char time[16];          // UTC time DDMMYY hhmmss.s
    int16_t rssi;           // RSSI
    char cgi[32];           // Cell ID Location
    uint8_t ble_m;          // BLE source node
    uint8_t bat_soc;        // Battery %
    float acc_x, acc_y, acc_z; // Accelerometer mg
    float temperature;       // °C
    float humidity;          // %RH
    float pressure;          // hPa
    char door;               // Door status
    uint8_t gnss;            // GPS status
    float latitude;          // DD
    float longitude;         // DD
    float altitude;          // meters
    float speed;             // m/s
    float heading;           // degrees
    uint8_t nsat;            // Number of satellites
    float hdop;              // HDOP
} container_data_t;

// Function prototypes
static void init_hardware(void);
static void init_sensors(void);
static void init_communication(void);
static void read_sensors(container_data_t *data);
static void generate_container_id(char *container_id);
static void get_current_time(char *time_str);
static void read_accelerometer(float *x, float *y, float *z);
static void read_environmental_sensors(float *temp, float *hum, float *press);
static void read_gps_data(float *lat, float *lon, float *alt, float *spd, float *hdg, uint8_t *nsat);
static void read_door_status(char *status);
static void read_battery_level(uint8_t *level);
static void read_rssi(int16_t *rssi);
static void read_cell_id(char *cell_id);
static void read_ble_status(uint8_t *status);
static size_t compress_to_protobuf(const container_data_t *data, uint8_t *buffer, size_t buffer_size);
static void transmit_data(const uint8_t *data, size_t data_size);
static void sensor_task(void *pvParameters);
static void transmission_task(void *pvParameters);

// Hardware initialization
static void init_hardware(void) {
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Initialize GPIO
    gpio_config_t io_conf = {
        .intr_type = GPIO_INTR_DISABLE,
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = (1ULL << DOOR_SENSOR_PIN) | (1ULL << BLE_ENABLE_PIN) | (1ULL << GNSS_ENABLE_PIN),
        .pull_down_en = 0,
        .pull_up_en = 0,
    };
    gpio_config(&io_conf);

    // Initialize ADC for battery monitoring
    adc1_config_width(ADC_WIDTH_BIT_12);
    adc1_config_channel_atten(BATTERY_ADC_CHANNEL, ADC_ATTEN_DB_11);

    ESP_LOGI(TAG, "Hardware initialized");
}

// Sensor initialization
static void init_sensors(void) {
    // I2C master configuration
    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = I2C_MASTER_SDA_IO,
        .scl_io_num = I2C_MASTER_SCL_IO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = I2C_MASTER_FREQ_HZ,
    };
    i2c_param_config(I2C_MASTER_NUM, &conf);
    i2c_driver_install(I2C_MASTER_NUM, conf.mode, 0, 0, 0);

    // SPI master configuration for radio module
    spi_bus_config_t buscfg = {
        .miso_io_num = SPI_MISO_PIN,
        .mosi_io_num = SPI_MOSI_PIN,
        .sclk_io_num = SPI_SCLK_PIN,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 0,
    };
    spi_bus_initialize(SPI_HOST, &buscfg, SPI_DMA_CH_AUTO);

    ESP_LOGI(TAG, "Sensors initialized");
}

// Communication initialization
static void init_communication(void) {
    // Initialize WiFi (if needed for cellular modem)
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    
    // Initialize cellular modem (implementation depends on specific modem)
    // This is a placeholder for actual modem initialization
    
    ESP_LOGI(TAG, "Communication initialized");
}

// Read all sensors and populate data structure
static void read_sensors(container_data_t *data) {
    // Read environmental sensors
    read_environmental_sensors(&data->temperature, &data->humidity, &data->pressure);
    
    // Read accelerometer
    read_accelerometer(&data->acc_x, &data->acc_y, &data->acc_z);
    
    // Read GPS data
    read_gps_data(&data->latitude, &data->longitude, &data->altitude, 
                  &data->speed, &data->heading, &data->nsat);
    
    // Read door status
    read_door_status(&data->door);
    
    // Read battery level
    read_battery_level(&data->bat_soc);
    
    // Read RSSI
    read_rssi(&data->rssi);
    
    // Read cell ID
    read_cell_id(data->cgi);
    
    // Read BLE status
    read_ble_status(&data->ble_m);
    
    // Get current time
    get_current_time(data->time);
    
    // Generate container ID (if not already set)
    if (strlen(data->iso6346) == 0) {
        generate_container_id(data->iso6346);
    }
    
    // Set MSISDN (SIM ID - should be configured)
    strcpy(data->msisdn, "393600504800"); // Default value
    
    // Set GNSS status based on satellite count
    data->gnss = (data->nsat > 0) ? 1 : 0;
    
    // Set HDOP (simplified - should be read from GPS)
    data->hdop = 1.5; // Default value
}

// Generate unique container ID
static void generate_container_id(char *container_id) {
    static uint32_t container_counter = 0;
    snprintf(container_id, 16, "LMCU%07lu", container_counter++);
}

// Get current time in DDMMYY hhmmss.s format
static void get_current_time(char *time_str) {
    time_t now;
    struct tm timeinfo;
    time(&now);
    localtime_r(&now, &timeinfo);
    
    snprintf(time_str, 16, "%02d%02d%02d %02d%02d%02d.%d",
             timeinfo.tm_mday, timeinfo.tm_mon + 1, timeinfo.tm_year % 100,
             timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec, 0);
}

// Read accelerometer data (I2C)
static void read_accelerometer(float *x, float *y, float *z) {
    // Placeholder for actual accelerometer reading
    // This would typically read from MPU6050, LIS3DH, or similar
    *x = -993.9 + (rand() % 2000) / 1000.0;
    *y = -27.1 + (rand() % 1000) / 1000.0;
    *z = -52.0 + (rand() % 1000) / 1000.0;
}

// Read environmental sensors (I2C)
static void read_environmental_sensors(float *temp, float *hum, float *press) {
    // Placeholder for actual sensor reading
    // This would typically read from BME280, SHT30, or similar
    *temp = 17.0 + (rand() % 1000) / 100.0;
    *hum = 71.0 + (rand() % 2000) / 100.0 - 10.0;
    *press = 1012.4 + (rand() % 2000) / 100.0 - 10.0;
}

// Read GPS data
static void read_gps_data(float *lat, float *lon, float *alt, float *spd, float *hdg, uint8_t *nsat) {
    // Placeholder for actual GPS reading
    // This would typically read from NEO-6M, NEO-8M, or similar
    *lat = 31.86 + (rand() % 1000) / 1000.0 - 0.5;
    *lon = 28.74 + (rand() % 1000) / 1000.0 - 0.5;
    *alt = 49.5 + (rand() % 2000) / 100.0 - 10.0;
    *spd = (rand() % 4000) / 100.0;
    *hdg = (rand() % 36000) / 100.0;
    *nsat = 4 + (rand() % 9);
}

// Read door status from GPIO
static void read_door_status(char *status) {
    int door_pin_state = gpio_get_level(DOOR_SENSOR_PIN);
    *status = door_pin_state ? 'O' : 'C'; // Open or Closed
}

// Read battery level from ADC
static void read_battery_level(uint8_t *level) {
    int adc_reading = adc1_get_raw(BATTERY_ADC_CHANNEL);
    // Convert ADC reading to battery percentage (0-100)
    // This conversion depends on your battery voltage divider
    *level = (adc_reading * 100) / 4095;
    if (*level > 100) *level = 100;
}

// Read RSSI from cellular modem
static void read_rssi(int16_t *rssi) {
    // Placeholder for actual RSSI reading from modem
    *rssi = 15 + (rand() % 21); // Random value between 15-35 dBm
}

// Read cell ID from cellular modem
static void read_cell_id(char *cell_id) {
    // Placeholder for actual cell ID reading from modem
    strcpy(cell_id, "999-01-1-31D41");
}

// Read BLE status
static void read_ble_status(uint8_t *status) {
    // Placeholder for actual BLE status reading
    *status = rand() % 2; // Random 0 or 1
}

// Compress data to Protocol Buffer format
static size_t compress_to_protobuf(const container_data_t *data, uint8_t *buffer, size_t buffer_size) {
    // Create protobuf message
    ContainerData pb_data = ContainerData_init_zero;
    
    // Set string fields
    strcpy(pb_data.msisdn, data->msisdn);
    strcpy(pb_data.iso6346, data->iso6346);
    strcpy(pb_data.time, data->time);
    strcpy(pb_data.cgi, data->cgi);
    pb_data.door = data->door;
    
    // Set numeric fields
    pb_data.rssi = data->rssi;
    pb_data.ble_m = data->ble_m;
    pb_data.bat_soc = data->bat_soc;
    pb_data.gnss = data->gnss;
    pb_data.nsat = data->nsat;
    
    // Set accelerometer fields
    pb_data.acc_x = data->acc_x;
    pb_data.acc_y = data->acc_y;
    pb_data.acc_z = data->acc_z;
    
    // Set environmental fields
    pb_data.temperature = data->temperature;
    pb_data.humidity = data->humidity;
    pb_data.pressure = data->pressure;
    
    // Set GPS fields
    pb_data.latitude = data->latitude;
    pb_data.longitude = data->longitude;
    pb_data.altitude = data->altitude;
    pb_data.speed = data->speed;
    pb_data.heading = data->heading;
    pb_data.hdop = data->hdop;
    
    // Encode to buffer
    pb_ostream_t stream = pb_ostream_from_buffer(buffer, buffer_size);
    bool status = pb_encode(&stream, ContainerData_fields, &pb_data);
    
    if (!status) {
        ESP_LOGE(TAG, "Protobuf encoding failed: %s", PB_GET_ERROR(&stream));
        return 0;
    }
    
    return stream.bytes_written;
}

// Transmit data via radio module
static void transmit_data(const uint8_t *data, size_t data_size) {
    // Placeholder for actual radio transmission
    // This would typically use LoRa, Sigfox, or similar radio module
    
    ESP_LOGI(TAG, "Transmitting %d bytes", data_size);
    
    // Log first few bytes for debugging
    if (data_size > 0) {
        ESP_LOGI(TAG, "First bytes: %02X %02X %02X %02X", 
                 data[0], data[1], data[2], data[3]);
    }
    
    // Simulate transmission delay
    vTaskDelay(pdMS_TO_TICKS(100));
    
    ESP_LOGI(TAG, "Transmission complete");
}

// Sensor reading task
static void sensor_task(void *pvParameters) {
    container_data_t sensor_data = {0};
    
    while (1) {
        // Read all sensors
        read_sensors(&sensor_data);
        
        // Add to queue for transmission
        if (xQueueSend(data_queue, &sensor_data, pdMS_TO_TICKS(100)) != pdTRUE) {
            ESP_LOGW(TAG, "Failed to queue sensor data");
        }
        
        // Wait for next reading cycle
        vTaskDelay(pdMS_TO_TICKS(SENSOR_READ_INTERVAL_MS));
    }
}

// Data transmission task
static void transmission_task(void *pvParameters) {
    container_data_t data;
    uint8_t protobuf_buffer[256];
    
    while (1) {
        // Wait for data from sensor task
        if (xQueueReceive(data_queue, &data, portMAX_DELAY) == pdTRUE) {
            // Compress to protobuf
            size_t compressed_size = compress_to_protobuf(&data, protobuf_buffer, sizeof(protobuf_buffer));
            
            if (compressed_size > 0) {
                ESP_LOGI(TAG, "Data compressed: %d bytes", compressed_size);
                
                // Transmit data
                transmit_data(protobuf_buffer, compressed_size);
            } else {
                ESP_LOGE(TAG, "Protobuf compression failed");
            }
        }
        
        // Wait for next transmission cycle
        vTaskDelay(pdMS_TO_TICKS(TRANSMISSION_INTERVAL_MS));
    }
}

// Main application entry point
void app_main(void) {
    ESP_LOGI(TAG, "Starting Container Data Logger");
    
    // Initialize hardware and sensors
    init_hardware();
    init_sensors();
    init_communication();
    
    // Create data queue
    data_queue = xQueueCreate(QUEUE_SIZE, sizeof(container_data_t));
    if (data_queue == NULL) {
        ESP_LOGE(TAG, "Failed to create data queue");
        return;
    }
    
    // Create sensor reading task
    xTaskCreate(sensor_task, "sensor_task", TASK_STACK_SIZE, NULL, 5, &sensor_task_handle);
    if (sensor_task_handle == NULL) {
        ESP_LOGE(TAG, "Failed to create sensor task");
        return;
    }
    
    // Create transmission task
    xTaskCreate(transmission_task, "transmission_task", TASK_STACK_SIZE, NULL, 4, &transmission_task_handle);
    if (transmission_task_handle == NULL) {
        ESP_LOGE(TAG, "Failed to create transmission task");
        return;
    }
    
    ESP_LOGI(TAG, "Container Data Logger started successfully");
    ESP_LOGI(TAG, "Sensor reading interval: %d ms", SENSOR_READ_INTERVAL_MS);
    ESP_LOGI(TAG, "Transmission interval: %d ms", TRANSMISSION_INTERVAL_MS);
}
