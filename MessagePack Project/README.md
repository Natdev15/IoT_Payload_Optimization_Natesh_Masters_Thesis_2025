# Container Data Compression & Stress Testing System

A complete solution for compressing container sensor data using MessagePack and stress testing the system with Locust.

## 🎯 **System Overview**

This system simulates ESP32 container data transmission with maximum compression:
- **Python Sender**: Locust-based stress tester that compresses data with MessagePack
- **Node.js Receiver**: HTTP server with pseudo queue processing every 2 seconds
- **Docker Support**: Containerized deployment for the receiver
- **Comprehensive Testing**: Incremental load testing with detailed metrics

## 📊 **Data Flow**

```
Container Data → Remove Keys → Delimited String → MessagePack Compress → HTTP POST
                                                                        ↓
Reconstruct Keys ← Split Delimiter ← MessagePack Decompress ← Queue Processing ← Receive
```

## 🚀 **Quick Start**

### Prerequisites
```bash
# Python dependencies
pip install locust msgpack requests

# Node.js dependencies (for receiver)
cd nodejs_receiver
npm install
```

### 1. Start the Receiver
```bash
# Option A: Run directly
cd nodejs_receiver
npm start

# Option B: Run with Docker
docker-compose up --build

# Option C: Run in development mode
cd nodejs_receiver
npm run dev
```

### 2. Test Compression
```bash
# Test compression effectiveness
python locust_sender.py test-compression
```

### 3. Run Stress Tests
```bash
# Single test with Locust UI
locust -f locust_sender.py --host http://localhost:3000

# Automated incremental testing (100, 200, 300... users)
python locust_sender.py incremental http://localhost:3000

# Single headless test
locust -f locust_sender.py --host http://localhost:3000 --users 100 --spawn-rate 10 --run-time 60s --headless
```

## 📁 **Project Structure**

```
Tests/
├── locust_sender.py              # Python stress tester with MessagePack compression
├── nodejs_receiver/              # Node.js receiver service
│   ├── server.js                 # Main server with queue processing
│   ├── package.json              # Node.js dependencies
│   ├── Dockerfile                # Container configuration
│   └── test_compression.js       # Node.js test suite
├── docker-compose.yml            # Docker orchestration
├── compression_test.py           # Algorithm comparison tool
├── stress.py                     # Original container data generator
└── README.md                     # This file
```

## 🔧 **Configuration**

### Python Sender (`locust_sender.py`)
```python
DELIMITER = "§§"                  # Unique delimiter
MAX_PAYLOAD_SIZE = 150            # Size limit in bytes
TARGET_ENDPOINT = "/container-data"
```

### Node.js Receiver (`nodejs_receiver/server.js`)
```javascript
const PORT = 3000;                // Server port
const QUEUE_PROCESS_INTERVAL = 2000; // Process queue every 2 seconds
const DELIMITER = '§§';           // Must match sender
```

## 📊 **Container Data Fields**

Data is sent in this exact order (from `stress.py`):
1. `containerId` - Container identifier
2. `iso6346` - ISO container code
3. `msisdn` - Mobile number
4. `time` - Timestamp
5. `rssi` - Signal strength
6. `cgi` - Cell global identity
7. `ble-m` - Bluetooth mode
8. `bat-soc` - Battery state
9. `acc` - Accelerometer data
10. `temperature` - Temperature sensor
11. `humidity` - Humidity sensor
12. `pressure` - Pressure sensor
13. `door` - Door status
14. `gnss` - GPS status
15. `latitude` - GPS latitude
16. `longitude` - GPS longitude
17. `altitude` - GPS altitude
18. `speed` - Movement speed
19. `heading` - Movement direction
20. `nsat` - Number of satellites
21. `hdop` - GPS accuracy
22. `timestamp` - ISO timestamp

## 📈 **Stress Testing Features**

### Incremental Load Testing
Automatically tests with increasing user counts:
```bash
python locust_sender.py incremental
```

### Metrics Collected
- **RPS** (Requests Per Second)
- **Response Times** (Average, Min, Max, Percentiles)
- **Success Rate** (% of successful requests)
- **Error Rate** (% of failed requests)
- **Compression Ratio** (Data size reduction)
- **Queue Performance** (Processing delays)

### Test Scenarios
1. **100 Users** → 60 seconds
2. **200 Users** → 60 seconds  
3. **300 Users** → 60 seconds
4. **...and so on**

## 🐋 **Docker Deployment**

### Build and Run
```bash
# Build and start services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Health Checks
```bash
# Check receiver health
curl http://localhost:3000/health

# View statistics
curl http://localhost:3000/stats
```

## 🧪 **Testing**

### Test Compression
```bash
# Test MessagePack compression effectiveness
python locust_sender.py test-compression

# Test Node.js compression handling
cd nodejs_receiver
node test_compression.js
```

### Validate System
```bash
# Test receiver endpoints
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Health check
curl http://localhost:3000/health
```

## 📊 **Performance Expectations**

### Compression Results
- **Original JSON**: ~400 bytes
- **MessagePack Compressed**: ~100-150 bytes
- **Compression Ratio**: 3-4x reduction
- **Size Validation**: ✅ Under 150-byte limit

### Load Testing Results
- **Target RPS**: 1000+ requests/second
- **Response Time**: <50ms average
- **Success Rate**: >99.5%
- **Queue Processing**: 2-second intervals

## 🔍 **Monitoring**

### Real-time Statistics
```bash
# View live stats
curl http://localhost:3000/stats

# Monitor queue size
watch -n 1 'curl -s http://localhost:3000/stats | jq .queueSize'
```

### Log Analysis
```bash
# View receiver logs
docker-compose logs -f container-receiver

# Monitor processing
tail -f nodejs_receiver/logs/app.log
```

## 🛠️ **Troubleshooting**

### Common Issues

**Payload too large error:**
```bash
# Check compression effectiveness
python locust_sender.py test-compression
```

**Connection refused:**
```bash
# Ensure receiver is running
curl http://localhost:3000/health
```

**MessagePack decode errors:**
```bash
# Verify delimiter compatibility
cd nodejs_receiver
node test_compression.js
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
npm run dev
```

## 🎯 **Use Cases**

1. **IoT Data Transmission**: Optimize satellite data costs
2. **Performance Testing**: Validate system capacity
3. **Compression Analysis**: Compare algorithm effectiveness
4. **Queue Processing**: Handle burst traffic
5. **Container Tracking**: Real-time sensor monitoring

## 🔄 **Integration**

### Add Custom Processing
```javascript
// In server.js, modify onDataProcessed()
onDataProcessed(data) {
    // Send to database
    // Forward to another API
    // Trigger alerts
    // Custom business logic
}
```

### Extend Stress Testing
```python
# In locust_sender.py, add custom scenarios
@task(weight=2)
def custom_scenario(self):
    # Your custom test logic
    pass
```

## 📞 **API Endpoints**

### Receiver Endpoints
- `POST /container-data` - Main data endpoint
- `GET /health` - Health check
- `GET /stats` - Performance statistics  
- `POST /test` - Test endpoint

### Response Formats
```json
{
  "status": "received",
  "timestamp": "2024-12-01T12:00:00.000Z",
  "size": 147,
  "queueSize": 3
}
```

This system provides a complete solution for high-performance container data processing with comprehensive stress testing capabilities. 