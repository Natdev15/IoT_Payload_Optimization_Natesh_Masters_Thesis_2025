# Container Data Compression & Stress Testing System

A complete solution for compressing container sensor data using CBOR and stress testing the system with Locust.

## System Overview

This system simulates ESP32 container data transmission with CBOR compression:
- **Python Sender**: Locust-based stress tester that compresses data with CBOR
- **Node.js Receiver**: HTTP server with queue processing every 5 seconds
- **Docker Support**: Containerized deployment with nginx load balancer
- **Load Testing**: Comprehensive stress testing with pre-generated data pools

## Data Flow

```
Container Data → CBOR Compress → HTTP POST → Queue Processing → CBOR Decompress → Process
```

## Quick Start

### Prerequisites
```bash
# Python dependencies
pip install locust cbor2

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

# Single headless test
locust -f locust_sender.py --host http://localhost:3000 --users 100 --spawn-rate 10 --run-time 60s --headless
```

## Project Structure

```
CBOR Project/
├── locust_sender.py              # Python stress tester with CBOR compression
├── nodejs_receiver/              # Node.js receiver service
│   ├── server.js                 # Main server with queue processing
│   ├── package.json              # Node.js dependencies
│   └── Dockerfile                # Container configuration
├── docker-compose.yml            # Docker orchestration
├── nginx.conf                    # Nginx load balancer configuration
└── README.md                     # This file
```

## Configuration

### Python Sender (`locust_sender.py`)
```python
TARGET_ENDPOINT = "/container-data"  # Target endpoint
DATA_POOL_SIZE = 10000               # Pre-generated data pool size
```

### Node.js Receiver (`nodejs_receiver/server.js`)
```javascript
const PORT = 3000;                    // Server port
const QUEUE_PROCESS_INTERVAL = 5000;  // Process queue every 5 seconds
```

### Docker Configuration
```bash
# Set environment variables (optional)
export OUTBOUND_URL=http://your-m2m-endpoint:port/path

# Start services
docker-compose up --build

# The system will be available at:
# - Load balancer: http://localhost:3000
# - Direct receiver: http://localhost:3000 (via nginx)
```

## Container Data Fields

The system generates realistic container sensor data including:
- Container ID (ISO6346 format)
- SIM ID (MSISDN)
- GPS coordinates (latitude, longitude, altitude)
- Environmental sensors (temperature, humidity, pressure)
- Movement data (speed, heading, accelerometer)
- Status indicators (door, GPS, battery, signal strength)
- Timestamps and metadata

## Load Testing Features

### Pre-generated Data Pools
- Eliminates data generation bottleneck during testing
- Configurable pool size via environment variable
- Each worker maintains its own data pool
- Automatic cycling through data for extended tests

### Metrics Collected
- RPS (Requests Per Second)
- Response Times (Average, Min, Max)
- Success Rate (% of successful requests)
- Error Rate (% of failed requests)
- Queue Performance (Processing delays)

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

# Check nginx load balancer
curl http://localhost:3000/nginx-health
```

## Testing

### Test Compression
```bash
# Test CBOR compression effectiveness
python locust_sender.py test-compression
```

### Validate System
```bash
# Health check
curl http://localhost:3000/health

# Send test data
curl -X POST http://localhost:3000/container-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test_data.cbor
```

## Performance Expectations

### Compression Results
- Original JSON: ~400 bytes
- CBOR Compressed: ~100-150 bytes
- Compression Ratio: 3-4x reduction
- No payload size limits

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
watch -n 1 'curl -s http://localhost:3000/stats | jq .inbound.queueSize'
```

### Log Analysis
```bash
# View receiver logs
docker-compose logs -f container-receiver

# View nginx logs
docker-compose logs -f nginx-lb
```

## Troubleshooting

### Common Issues

**Connection refused:**
```bash
# Ensure receiver is running
curl http://localhost:3000/health
```

**CBOR decode errors:**
```bash
# Verify data format
python locust_sender.py test-compression
```

**Port conflicts:**
```bash
# Check if port 3000 is available
netstat -tulpn | grep :3000
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
npm run dev
```

## Use Cases

1. **IoT Data Transmission**: Optimize satellite data costs with CBOR compression
2. **Performance Testing**: Validate system capacity under load
3. **Compression Analysis**: Compare CBOR vs JSON effectiveness
4. **Queue Processing**: Handle burst traffic with message queuing
5. **Container Tracking**: Real-time sensor monitoring and data collection

## Integration

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

### Extend Load Testing
```python
# In locust_sender.py, add custom scenarios
@task(weight=2)
def custom_scenario(self):
    # Your custom test logic
    pass
```

## API Endpoints

### Receiver Endpoints
- `POST /container-data` - Main data endpoint (accepts CBOR binary data)
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

### Python Sender
- `LOCUST_DATA_POOL_SIZE`: Number of pre-generated records per worker (default: 10000)

### Node.js Receiver
- `PORT`: Server port (default: 3000)
- `OUTBOUND_URL`: External M2M endpoint for data forwarding (optional)
- `NODE_ENV`: Environment mode (default: production)

## Scaling

### Horizontal Scaling
- Add more receiver instances in docker-compose.yml
- Nginx automatically load balances across instances
- Each instance maintains its own message queue

### Performance Tuning
- Adjust `QUEUE_PROCESS_INTERVAL` for different throughput requirements
- Modify `DATA_POOL_SIZE` based on available memory
- Configure nginx worker processes for optimal performance

This system provides a complete solution for high-performance container data processing with CBOR compression and comprehensive load testing capabilities. 