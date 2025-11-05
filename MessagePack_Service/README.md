# MessagePack Container Data System

A complete solution for compressing container sensor data using MessagePack and stress testing the system with Locust.

## System Overview

This system provides container data transmission with MessagePack compression:
- **Python Sender**: Locust-based stress tester with MessagePack compression
- **Node.js Receiver**: HTTP server with queue processing every 5 seconds
- **Docker Support**: Containerized deployment for the receiver

## Data Flow

```
Container Data → MessagePack Compress → HTTP POST → Queue Processing → MessagePack Decompress
```

## Quick Start

### Prerequisites
```bash
# Python dependencies
pip install locust msgpack

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
```

### 2. Test Compression
```bash
# Test MessagePack compression effectiveness
python locust_sender.py test-compression
```

### 3. Run Stress Tests
```bash
# Single test with Locust UI
locust -f locust_sender.py --host http://localhost:3000

# Single headless test
locust -f locust_sender.py --host http://localhost:3000 --users 100 --spawn-rate 10 --run-time 60s --headless
```

## Project Structure

```
MessagePack Project/
├── locust_sender.py                           # Python stress tester with MessagePack compression
├── nodejs_receiver/                           # Node.js receiver service
│   ├── server.js                              # Main server with queue processing
│   ├── package.json                           # Node.js dependencies
│   ├── Dockerfile                             # Container configuration
│   └── node_modules/                          # Node.js dependencies
├── docker-compose.yml                         # Docker orchestration
├── nginx.conf                                 # Nginx load balancer configuration
└── README.md                                  # This file
```

## Configuration

### Python Sender (locust_sender.py)
```python
TARGET_ENDPOINT = "/container-data"
DEFAULT_POOL_SIZE = 10000
```

### Node.js Receiver (nodejs_receiver/server.js)
```javascript
const PORT = 3000;                              // Server port
const QUEUE_PROCESS_INTERVAL = 5000;            // Process queue every 5 seconds
const OUTBOUND_URL = process.env.OUTBOUND_URL;   // External M2M endpoint
```

## Container Data Fields

Data structure:
- `msisdn` - SIMID
- `iso6346` - ISO container code
- `time` - Timestamp
- `rssi` - Signal strength
- `cgi` - Cell global identity
- `ble-m` - Bluetooth mode
- `bat-soc` - Battery state
- `acc` - Accelerometer data
- `temperature` - Temperature sensor
- `humidity` - Humidity sensor
- `pressure` - Pressure sensor
- `door` - Door status
- `gnss` - GPS status
- `latitude` - GPS latitude
- `longitude` - GPS longitude
- `altitude` - GPS altitude
- `speed` - Movement speed
- `heading` - Movement direction
- `nsat` - Number of satellites
- `hdop` - GPS accuracy

## Stress Testing Features

### Metrics Collected
- RPS (Requests Per Second)
- Response Times (Average, Min, Max)
- Success Rate (% of successful requests)
- Error Rate (% of failed requests)
- Compression Ratio (Data size reduction)
- Queue Performance (Processing delays)

### Data Pool
- Pre-generated data pool for maximum throughput
- Configurable pool size via environment variable
- Eliminates generation bottleneck during testing

## Docker Deployment

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

## Testing

### Test Compression
```bash
# Test MessagePack compression effectiveness
python locust_sender.py test-compression
```

### Validate System
```bash
# Health check
curl http://localhost:3000/health

# View statistics
curl http://localhost:3000/stats
```

## Performance Expectations

### Compression Results
- Original JSON: ~400 bytes
- MessagePack Compressed: ~100-150 bytes
- Compression Ratio: 3-4x reduction

### Load Testing Results
- Target RPS: 1000+ requests/second
- Response Time: <50ms average
- Success Rate: >99.5%
- Queue Processing: 5-second intervals

## Monitoring

### Real-time Statistics
```bash
# View live stats
curl http://localhost:3000/stats

# Monitor queue size
curl -s http://localhost:3000/stats | jq .inbound.queueSize
```

### Log Analysis
```bash
# View receiver logs
docker-compose logs -f container-receiver
```

## Troubleshooting

### Common Issues

**Connection refused:**
```bash
# Ensure receiver is running
curl http://localhost:3000/health
```

**MessagePack decode errors:**
```bash
# Check data format
python locust_sender.py test-compression
```

## Use Cases

1. IoT Data Transmission: Optimize satellite data costs
2. Performance Testing: Validate system capacity
3. Compression Analysis: Compare algorithm effectiveness
4. Queue Processing: Handle burst traffic
5. Container Tracking: Real-time sensor monitoring

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

This system provides a complete solution for high-performance container data processing with MessagePack compression and comprehensive stress testing capabilities. 