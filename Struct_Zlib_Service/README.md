# Container Data Compression & Stress Testing System

A streamlined solution for compressing container sensor data using struct+zlib compression and stress testing with Locust.

## System Overview

This system provides efficient container data transmission with maximum compression:
- **Python Sender**: Clean Locust-based stress tester with struct+zlib compression
- **Node.js Receiver**: Optimized HTTP server with efficient queue processing
- **Docker Support**: Containerized deployment with nginx load balancer

## Data Flow

```
Container Data → Struct Packing → zlib Compress → HTTP POST → Queue Processing → Decompress & Forward
```

## Quick Start

### Prerequisites
```bash
# Python dependencies
pip install locust

# Node.js dependencies
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
```

### 2. Run Stress Tests
```bash
# Single test with Locust UI
locust -f locust_sender.py --host http://localhost:3000

# Distributed testing
python locust_sender.py distributed 4

# Headless test
locust -f locust_sender.py --host http://localhost:3000 --users 100 --spawn-rate 10 --run-time 60s --headless
```

## Project Structure

```
Struct and Zlib Project/
├── locust_sender.py                          # Clean Python stress tester
├── nodejs_receiver/                          # Node.js receiver service
│   ├── server.js                             # Optimized server with queue processing
│   ├── package.json                          # Dependencies
│   └── Dockerfile                            # Streamlined container config
├── docker-compose.yml                        # Docker orchestration
├── nginx.conf                                # Load balancer config
└── README.md                                 # This file
```

## Configuration

### Python Sender (`locust_sender.py`)
```python
MAX_PAYLOAD_SIZE = 158            # Size limit in bytes
TARGET_ENDPOINT = "/container-data"
DATA_POOL_SIZE = 10000            # Pre-generated records per worker
```

### Node.js Receiver (`nodejs_receiver/server.js`)
```javascript
const PORT = 3000;                // Server port
const QUEUE_PROCESS_INTERVAL = 5000; // Process queue every 5 seconds
const OUTBOUND_URL = process.env.OUTBOUND_URL || null; // M2M endpoint
```

### Docker Configuration
```bash
# Set M2M endpoint URL (optional)
export OUTBOUND_URL="http://your-m2m-endpoint:port/path"

# Start services
docker-compose up --build
```

## Container Data Fields

Data is sent in this exact order (20 fields):
1. `msisdn` - SIM ID
2. `iso6346` - Container ID  
3. `time` - UTC time DDMMYY hhmmss.s
4. `rssi` - Signal strength
5. `cgi` - Cell ID Location
6. `ble-m` - Bluetooth mode
7. `bat-soc` - Battery state
8. `acc` - Accelerometer data (3 floats)
9. `temperature` - Temperature sensor
10. `humidity` - Humidity sensor
11. `pressure` - Pressure sensor
12. `door` - Door status
13. `gnss` - GPS status
14. `latitude` - GPS latitude
15. `longitude` - GPS longitude
16. `altitude` - GPS altitude
17. `speed` - Movement speed
18. `heading` - Movement direction
19. `nsat` - Number of satellites
20. `hdop` - GPS accuracy

## Stress Testing Features

### Distributed Load Testing
```bash
python locust_sender.py distributed 4
```

### Pre-generated Data Pool
- **10,000 records per worker** (configurable via `LOCUST_DATA_POOL_SIZE`)
- **Pre-compressed data** eliminates generation bottleneck
- **Memory efficient** (~60MB per worker)

### Metrics Collected
- **RPS** (Requests Per Second)
- **Response Times** (Average, Min, Max, Percentiles)
- **Success Rate** (% of successful requests)
- **Compression Ratio** (Data size reduction)

## Docker Deployment

### Build and Run
```bash
# Build and start services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f
```

### Architecture
- **nginx-lb**: Load balancer distributing traffic
- **container-receiver**: Node.js receiver service
- **container-network**: Internal Docker network

### Health Checks
```bash
# Check receiver health
curl http://localhost:3000/health

# View statistics
curl http://localhost:3000/stats
```

## Testing

### Test Compression
```bash
# Test struct+zlib compression
python locust_sender.py test-compression
```

### Validate System
```bash
# Health check
curl http://localhost:3000/health
```

## Performance Expectations

### Compression Results
- **Original JSON**: ~400 bytes
- **Struct+zlib Compressed**: ~100-150 bytes
- **Compression Ratio**: 3-4x reduction
- **Size Validation**: Under 158-byte limit

### Load Testing Results
- **Target RPS**: 1000+ requests/second (distributed mode)
- **Response Time**: <50ms average
- **Success Rate**: >99.5%
- **Queue Processing**: 5-second intervals

## Monitoring

### Real-time Statistics
```bash
# View live stats
curl http://localhost:3000/stats
```

### Log Analysis
```bash
# View receiver logs
docker-compose logs -f container-receiver
```

## Troubleshooting

### Common Issues

**Payload too large error:**
```bash
python locust_sender.py test-compression
```

**Connection refused:**
```bash
curl http://localhost:3000/health
```

## Use Cases

1. **IoT Data Transmission**: Optimize satellite data costs
2. **Performance Testing**: Validate system capacity
3. **Container Tracking**: Real-time sensor monitoring
4. **Distributed Testing**: High-throughput load testing

## API Endpoints

### Receiver Endpoints
- `POST /container-data` - Main data endpoint
- `GET /health` - Health check
- `GET /stats` - Performance statistics

### Response Formats
```json
{
  "status": "received",
  "timestamp": "2024-12-01T12:00:00.000Z",
  "size": 147,
  "queueSize": 3
}
```

## Environment Variables

```bash
# Configure data pool size
export LOCUST_DATA_POOL_SIZE=20000

# Configure outbound URL
export OUTBOUND_URL=http://your-m2m-endpoint.com
```

This system provides a clean, efficient solution for high-performance container data processing with comprehensive stress testing capabilities using struct+zlib compression. 