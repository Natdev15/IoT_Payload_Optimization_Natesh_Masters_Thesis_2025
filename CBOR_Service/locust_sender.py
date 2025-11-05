import time
import random
import json
import cbor2
from datetime import datetime, timedelta
from locust import HttpUser, task, between, events
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
TARGET_ENDPOINT = "/container-data"

# Get data pool size from environment or use default
import os
DEFAULT_POOL_SIZE = 10000
DATA_POOL_SIZE = int(os.environ.get('LOCUST_DATA_POOL_SIZE', DEFAULT_POOL_SIZE))

def cbor_compress(data: dict) -> bytes:
    """Pure CBOR compression: directly encode JSON data with CBOR"""
    return cbor2.dumps(data)

class ContainerDataSender(HttpUser):
    wait_time = between(1, 3)  # Wait 1-3 seconds between requests
    
    # Class-level shared data pool (generated once per worker)
    _data_pool = None
    _data_pool_size = DATA_POOL_SIZE
    _pool_initialized = False
    
    @classmethod
    def initialize_data_pool(cls):
        """Pre-generate data pool for all users (called once per worker process)"""
        if cls._pool_initialized:
            return
        
        # Check if running in distributed mode
        import sys
        is_worker = "--worker" in sys.argv
        is_master = "--master" in sys.argv
        worker_label = "WORKER" if is_worker else "MASTER" if is_master else "SINGLE"
        
        logger.info(f"[{worker_label}] Pre-generating {cls._data_pool_size:,} container data records...")
        
        cls._data_pool = []
        start_time = time.time()
        
        # Generate data in batches
        batch_size = 50000
        generated_count = 0
        
        while generated_count < cls._data_pool_size:
            batch_target = min(batch_size, cls._data_pool_size - generated_count)
            batch_generated = 0
            
            while batch_generated < batch_target:
                data = generate_test_container_data()
                compressed = cbor_compress(data)
                size = len(compressed)
                
                cls._data_pool.append({
                    'original': data,
                    'compressed': compressed,
                    'size': size
                })
                
                batch_generated += 1
                generated_count += 1
            
            progress = (generated_count / cls._data_pool_size) * 100
            elapsed = time.time() - start_time
            logger.info(f"   [{worker_label}] Progress: {generated_count:,}/{cls._data_pool_size:,} ({progress:.1f}%) - Elapsed: {elapsed:.1f}s")
        
        total_time = time.time() - start_time
        avg_size = sum(item['size'] for item in cls._data_pool) / len(cls._data_pool)
        
        logger.info(f"[{worker_label}] Data pool generation complete!")
        logger.info(f"   Generated: {len(cls._data_pool):,} records in {total_time:.1f}s")
        logger.info(f"   Rate: {len(cls._data_pool) / total_time:.0f} records/sec")
        logger.info(f"   CBOR size - Avg: {avg_size:.1f}B")
        
        cls._pool_initialized = True
    
    def on_start(self):
        """Called when a user starts"""
        self.message_id = 0
        self.data_index = 0  # Track position in data pool
        
        # Initialize shared data pool if not already done
        if not self.__class__._pool_initialized:
            self.__class__.initialize_data_pool()
    
    @task
    def send_container_data(self):
        """Send pre-generated compressed container data"""
        try:
            # Get pre-generated and pre-compressed data from pool
            data_item = self.__class__._data_pool[self.data_index]
            compressed_data = data_item['compressed']
            actual_byte_size = data_item['size']
            
            # Cycle through the data pool
            self.data_index = (self.data_index + 1) % len(self.__class__._data_pool)
            
            self.message_id += 1
            
            # Send to Node.js receiver
            with self.client.post(
                TARGET_ENDPOINT,
                data=compressed_data,
                headers={'Content-Type': 'application/octet-stream'},
                catch_response=True
            ) as response:
                if response.status_code == 200:
                    logger.debug(f"Message {self.message_id} sent successfully ({actual_byte_size} bytes)")
                else:
                    logger.error(f"Failed to send message {self.message_id}: {response.status_code}")
                    response.failure(f"HTTP {response.status_code}")
                    
        except Exception as e:
            logger.error(f"Error sending container data: {e}")

# Locust event listeners
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    logger.info("Starting container data stress test")
    logger.info(f"Target: {environment.host}{TARGET_ENDPOINT}")
    logger.info(f"Pre-generated pool: {ContainerDataSender._data_pool_size:,} records")

@events.test_stop.add_listener  
def on_test_stop(environment, **kwargs):
    logger.info("Container data stress test completed")
    
    # Print final statistics
    stats = environment.stats.total
    data_pool_size = len(ContainerDataSender._data_pool) if ContainerDataSender._data_pool else 0
    
    logger.info(f"Final Results:")
    logger.info(f"   Total requests: {stats.num_requests}")
    logger.info(f"   Failures: {stats.num_failures}")
    logger.info(f"   Success rate: {((stats.num_requests - stats.num_failures) / stats.num_requests * 100):.1f}%")
    logger.info(f"   Average response time: {stats.avg_response_time:.2f}ms")
    logger.info(f"   RPS: {stats.current_rps:.2f}")
    logger.info(f"Data pool utilization: {data_pool_size:,} pre-generated records")

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, context, **kwargs):
    """Log request information"""
    if exception:
        logger.error(f"Request failed: {exception}")

def generate_test_container_data():
    """Generate realistic container data for testing"""
    container_id = random.randint(1, 999999)
    base_time = datetime.now() - timedelta(minutes=random.randint(0, 60))
    
    # Generate realistic variations
    variations = {
        'latitude': 31.86 + (random.random() - 0.5) * 0.5,
        'longitude': 28.74 + (random.random() - 0.5) * 0.5,
        'temperature': 17.0 + random.random() * 10,
        'humidity': 71.0 + random.random() * 20 - 10,
        'pressure': 1012.4 + random.random() * 20 - 10,
        'battery': max(10, 96 - random.random() * 20),
        'rssi': random.randint(15, 35),
        'speed': random.random() * 40,
        'heading': random.random() * 360,
        'altitude': 49.5 + random.random() * 20 - 10
    }

    return {
        "msisdn": f"39360050{random.randint(4800, 4999)}",
        "iso6346": f"LMCU{str(container_id).zfill(7)}",
        "time": base_time.strftime("%d%m%y %H%M%S.%f")[:-5],
        "rssi": str(int(variations['rssi'])),
        "cgi": "999-01-1-31D41",
        "ble-m": str(random.randint(0, 1)),
        "bat-soc": str(int(variations['battery'])),
        "acc": f"{(-993.9 + random.random() * 20):.4f} {(-27.1 + random.random() * 10):.4f} {(-52.0 + random.random() * 10):.4f}",
        "temperature": f"{variations['temperature']:.2f}",
        "humidity": f"{variations['humidity']:.2f}",
        "pressure": f"{variations['pressure']:.4f}",
        "door": random.choice(["D", "O", "C", "T"]),
        "gnss": str(random.randint(0, 1)),
        "latitude": f"{variations['latitude']:.4f}",
        "longitude": f"{variations['longitude']:.4f}",
        "altitude": f"{variations['altitude']:.2f}",
        "speed": f"{variations['speed']:.1f}",
        "heading": f"{variations['heading']:.2f}",
        "nsat": f"{random.randint(4, 12):02d}",
        "hdop": f"{(0.5 + random.random() * 5):.1f}"
    }

def test_compression():
    """Test Pure CBOR compression effectiveness"""
    print("Testing Pure CBOR Compression...")
    print("=" * 50)
    
    # Generate sample data
    sample_data = generate_test_container_data()
    
    # Test Pure CBOR compression
    cbor_data = cbor_compress(sample_data)
    
    # Measure actual byte sizes
    json_bytes = json.dumps(sample_data).encode('utf-8')
    
    print(f"Compression Test Results:")
    print(f"   Original JSON byte size: {len(json_bytes)} bytes (UTF-8)")
    print(f"   Pure CBOR byte size: {len(cbor_data)} bytes")
    print(f"   CBOR ratio vs JSON: {len(json_bytes) / len(cbor_data):.2f}x")
    print(f"   Size reduction: {len(json_bytes) - len(cbor_data)} bytes ({((len(json_bytes) - len(cbor_data)) / len(json_bytes) * 100):.1f}%)")
    
    # Test decompression
    try:
        decompressed = cbor2.loads(cbor_data)
        print(f"   CBOR decompression: SUCCESS")
        print(f"   Decompressed data matches original: {'YES' if decompressed == sample_data else 'NO'}")
    except Exception as e:
        print(f"   CBOR decompression: FAILED - {e}")
    
    # Save results to file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"pure_cbor_compression_test_{timestamp}.txt"
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write("PURE CBOR COMPRESSION TEST RESULTS\n")
        f.write("=" * 50 + "\n")
        f.write(f"Test Date: {datetime.now().isoformat()}\n")
        f.write(f"Compression Method: Pure CBOR\n")
        f.write("\n")
        
        f.write("SIZE COMPARISON:\n")
        f.write("-" * 30 + "\n")
        f.write(f"Original JSON byte size: {len(json_bytes)} bytes (UTF-8)\n")
        f.write(f"Pure CBOR byte size: {len(cbor_data)} bytes\n")
        f.write(f"CBOR ratio vs JSON: {len(json_bytes) / len(cbor_data):.2f}x\n")
        f.write(f"Size reduction: {len(json_bytes) - len(cbor_data)} bytes ({((len(json_bytes) - len(cbor_data)) / len(json_bytes) * 100):.1f}%)\n")
        f.write("\n")
        
        f.write("SAMPLE DATA:\n")
        f.write("-" * 30 + "\n")
        f.write("Original container data (JSON):\n")
        f.write(json.dumps(sample_data, indent=2) + "\n\n")
        
        f.write("CBOR COMPRESSED DATA:\n")
        f.write("-" * 30 + "\n")
        f.write(f"Size: {len(cbor_data)} bytes\n")
        f.write("Hex representation:\n")
        hex_string = cbor_data.hex()
        for i in range(0, len(hex_string), 64):
            chunk = hex_string[i:i+64]
            byte_offset = i // 2
            f.write(f"{byte_offset:04x}: {chunk}\n")
        f.write("\n")
        
        f.write("IMPLEMENTATION NOTES:\n")
        f.write("-" * 30 + "\n")
        f.write("Pure CBOR approach:\n")
        f.write("- Use tinycbor or libcbor library\n")
        f.write("- Direct encoding of JSON structure\n")
        f.write("- Simple implementation\n")
        f.write("- Standard CBOR format\n")
    
    print(f"\nResults saved to: {filename}")
    
    return {
        'cbor_data': cbor_data,
        'cbor_bytes': len(cbor_data),
        'json_bytes': len(json_bytes),
        'compression_ratio': len(json_bytes) / len(cbor_data),
        'filename': filename
    }

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test-compression":
        test_compression()
    else:
        print("Container Data Sender - Locust Load Testing (Pure CBOR)")
        print("=" * 50)
        print("")
        print("Usage Options:")
        print("  python locust_sender.py test-compression")
        print("    Test Pure CBOR compression and save results")
        print("")
        print("  locust -f locust_sender.py --host http://localhost:3000")
        print("    Standard Locust with web UI")
        print("")
        print("  locust -f locust_sender.py --host http://localhost:3000 --users 100 --spawn-rate 10 --run-time 60s --headless")
        print("    Headless load test")
        print("")
        print("Configuration:")
        print("  Compression method: Pure CBOR")
        print("  Pre-generated data pool for maximum throughput")
        print("")
        print("Environment Variables:")
        print(f"  LOCUST_DATA_POOL_SIZE={DATA_POOL_SIZE:,} (default: {DEFAULT_POOL_SIZE:,})")
        print("    Controls pre-generated data pool size per worker") 