import struct
import zlib
import time
import random
import json
from datetime import datetime, timedelta
from locust import HttpUser, task, between, events
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MAX_PAYLOAD_SIZE = 158
TARGET_ENDPOINT = "/container-data"

# Get data pool size from environment or use default
import os
DEFAULT_POOL_SIZE = 10000
DATA_POOL_SIZE = int(os.environ.get('LOCUST_DATA_POOL_SIZE', DEFAULT_POOL_SIZE))

def convert_to_typed_data(string_data: dict) -> dict:
    """Convert string-based data to properly typed data for struct compression"""
    
    typed_data = {
        # Strings stay as strings
        "msisdn": string_data["msisdn"],
        "iso6346": string_data["iso6346"], 
        "time": string_data["time"],
        "cgi": string_data["cgi"],
        "door": string_data["door"],
        
        # Convert to integers
        "rssi": int(string_data["rssi"]),
        "ble-m": int(string_data["ble-m"]),
        "bat-soc": int(string_data["bat-soc"]),
        "gnss": int(string_data["gnss"]),
        "nsat": int(string_data["nsat"]),
        
        # Convert to floats
        "temperature": float(string_data["temperature"]),
        "humidity": float(string_data["humidity"]),
        "pressure": float(string_data["pressure"]),
        "latitude": float(string_data["latitude"]),
        "longitude": float(string_data["longitude"]),
        "altitude": float(string_data["altitude"]),
        "speed": float(string_data["speed"]),
        "heading": float(string_data["heading"]),
        "hdop": float(string_data["hdop"]),
        
        # Convert accelerometer to array of floats
        "acc": [float(x) for x in string_data["acc"].split()]
    }
    
    return typed_data

def struct_zlib_compress(data: dict) -> bytes:
    """Smart compression: struct + zlib approach"""
    
    typed_data = convert_to_typed_data(data)
    
    format_parts = []
    values = []
    string_data = []
    
    field_order = [
        'msisdn', 'iso6346', 'time', 'rssi', 'cgi', 'ble-m', 'bat-soc',
        'acc', 'temperature', 'humidity', 'pressure', 'door', 'gnss',
        'latitude', 'longitude', 'altitude', 'speed', 'heading', 'nsat', 'hdop'
    ]
    
    for field in field_order:
        if field in ['msisdn', 'iso6346', 'time', 'cgi', 'door']:
            encoded_str = typed_data[field].encode('utf-8')
            format_parts.append('H')
            values.append(len(encoded_str))
            string_data.append(encoded_str)
        elif field in ['rssi', 'ble-m', 'bat-soc', 'gnss', 'nsat']:
            format_parts.append('B')
            values.append(typed_data[field])
        elif field == 'acc':
            format_parts.extend(['f', 'f', 'f'])
            values.extend(typed_data[field][:3])
        else:
            format_parts.append('f')
            values.append(typed_data[field])
    
    format_string = '>' + ''.join(format_parts)
    binary_data = struct.pack(format_string, *values)
    
    for string_bytes in string_data:
        binary_data += string_bytes
    
    return zlib.compress(binary_data, level=9)

class ContainerDataSender(HttpUser):
    wait_time = between(1, 3)
    
    _data_pool = None
    _data_pool_size = DATA_POOL_SIZE
    _pool_initialized = False
    
    @classmethod
    def initialize_data_pool(cls):
        """Pre-generate data pool for all users"""
        if cls._pool_initialized:
            return
        
        import sys
        is_worker = "--worker" in sys.argv
        is_master = "--master" in sys.argv
        worker_label = "WORKER" if is_worker else "MASTER" if is_master else "SINGLE"
        
        logger.info(f"[{worker_label}] Pre-generating {cls._data_pool_size:,} container data records...")
        
        cls._data_pool = []
        start_time = time.time()
        
        batch_size = 50000
        generated_count = 0
        rejected_count = 0
        
        while generated_count < cls._data_pool_size:
            batch_target = min(batch_size, cls._data_pool_size - generated_count)
            batch_generated = 0
            
            while batch_generated < batch_target:
                data = generate_test_container_data()
                compressed = struct_zlib_compress(data)
                size = len(compressed)
                
                if size >= MAX_PAYLOAD_SIZE:
                    rejected_count += 1
                    if rejected_count % 100 == 0:
                        logger.warning(f"Rejected {rejected_count} oversized records ({size} bytes > {MAX_PAYLOAD_SIZE})")
                    continue
                
                cls._data_pool.append({
                    'original': data,
                    'compressed': compressed,
                    'size': size
                })
                
                batch_generated += 1
                generated_count += 1
            
            progress = (generated_count / cls._data_pool_size) * 100
            elapsed = time.time() - start_time
            eta = (elapsed / (generated_count / cls._data_pool_size)) - elapsed if generated_count < cls._data_pool_size else 0
            
            logger.info(f"   [{worker_label}] Progress: {generated_count:,}/{cls._data_pool_size:,} ({progress:.1f}%) - "
                       f"Elapsed: {elapsed:.1f}s, ETA: {eta:.1f}s"
                       f"{f', Rejected: {rejected_count}' if rejected_count > 0 else ''}")
        
        total_time = time.time() - start_time
        avg_size = sum(item['size'] for item in cls._data_pool) / len(cls._data_pool)
        
        logger.info(f"[{worker_label}] Data pool generation complete!")
        logger.info(f"   Generated: {len(cls._data_pool):,} records in {total_time:.1f}s")
        logger.info(f"   Rate: {len(cls._data_pool) / total_time:.0f} records/sec")
        logger.info(f"   Compressed size - Avg: {avg_size:.1f}B")
        logger.info(f"   Total memory usage: ~{(len(cls._data_pool) * avg_size) / 1024 / 1024:.1f} MB")
        if rejected_count > 0:
            logger.info(f"   Rejected during generation: {rejected_count} records")
        
        cls._pool_initialized = True
    
    def on_start(self):
        """Called when a user starts"""
        self.message_id = 0
        self.data_index = 0
        
        if not self.__class__._pool_initialized:
            self.__class__.initialize_data_pool()
    
    @task
    def send_container_data(self):
        """Send pre-generated compressed container data"""
        try:
            data_item = self.__class__._data_pool[self.data_index]
            compressed_data = data_item['compressed']
            actual_byte_size = data_item['size']
            
            self.data_index = (self.data_index + 1) % len(self.__class__._data_pool)
            
            if actual_byte_size >= MAX_PAYLOAD_SIZE:
                logger.error(f"Pre-generated payload too large: {actual_byte_size} bytes (max: {MAX_PAYLOAD_SIZE})")
                return
            
            self.message_id += 1
            
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
    logger.info("Starting container data stress test (with pre-generated data)")
    logger.info(f"Target: {environment.host}{TARGET_ENDPOINT}")
    logger.info(f"Max payload size: {MAX_PAYLOAD_SIZE} bytes")
    logger.info(f"Pre-generated pool: {ContainerDataSender._data_pool_size:,} records")

@events.test_stop.add_listener  
def on_test_stop(environment, **kwargs):
    logger.info("Container data stress test completed")
    
    stats = environment.stats.total
    data_pool_size = len(ContainerDataSender._data_pool) if ContainerDataSender._data_pool else 0
    
    logger.info(f"Final Results:")
    logger.info(f"   Total requests: {stats.num_requests}")
    logger.info(f"   Failures: {stats.num_failures}")
    logger.info(f"   Success rate: {((stats.num_requests - stats.num_failures) / stats.num_requests * 100):.1f}%")
    logger.info(f"   Average response time: {stats.avg_response_time:.2f}ms")
    logger.info(f"   RPS: {stats.current_rps:.2f}")
    logger.info(f"Data pool utilization: {data_pool_size:,} pre-generated records")
    if stats.num_requests > data_pool_size > 0:
        cycles = stats.num_requests / data_pool_size
        logger.info(f"   Pool cycled {cycles:.1f} times during test")

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, context, **kwargs):
    """Log detailed request information"""
    if exception:
        logger.error(f"Request failed: {exception}")

def generate_test_container_data():
    """Generate realistic container data for testing"""
    container_id = random.randint(1, 999999)
    base_time = datetime.now() - timedelta(minutes=random.randint(0, 60))
    
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
        "latitude": f"{variations['latitude']:.2f}",
        "longitude": f"{variations['longitude']:.2f}",
        "altitude": f"{variations['altitude']:.2f}",
        "speed": f"{variations['speed']:.1f}",
        "heading": f"{variations['heading']:.2f}",
        "nsat": f"{random.randint(4, 12):02d}",
        "hdop": f"{(0.5 + random.random() * 5):.1f}"
    }

def test_compression():
    """Test the compression effectiveness"""
    print("Testing SMART compression (struct + zlib)...")
    
    sample_data = generate_test_container_data()
    compressed_data = struct_zlib_compress(sample_data)
    json_bytes = json.dumps(sample_data).encode('utf-8')
    
    print(f"SMART Compression Test Results:")
    print(f"   Original JSON byte size: {len(json_bytes)} bytes")
    print(f"   SMART compressed byte size: {len(compressed_data)} bytes")
    print(f"   Compression ratio: {len(json_bytes) / len(compressed_data):.2f}x")
    print(f"   Size check: {'PASS' if len(compressed_data) < MAX_PAYLOAD_SIZE else 'FAIL'} (<{MAX_PAYLOAD_SIZE} bytes)")
    print(f"   Space remaining: {MAX_PAYLOAD_SIZE - len(compressed_data)} bytes")
    
    return {
        'compressed_data': compressed_data,
        'actual_bytes': len(compressed_data),
        'passes_size_check': len(compressed_data) < MAX_PAYLOAD_SIZE
    }

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test-compression":
        test_compression()
    else:
        print("Container Data Sender - Locust Load Testing")
        print("=" * 50)
        print("")
        print("Usage Options:")
        print("  python locust_sender.py test-compression")
        print("    Test compression algorithms")
        print("")
        print("  locust -f locust_sender.py --host http://localhost:3000")
        print("    Standard Locust with web UI")
        print("")
        print("Environment Variables:")
        print(f"  LOCUST_DATA_POOL_SIZE={DATA_POOL_SIZE:,} (default: {DEFAULT_POOL_SIZE:,})")
        print("    Controls pre-generated data pool size per worker") 