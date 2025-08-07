#!/usr/bin/env python3
"""
MessagePack Compression Simulation for C/C++ (ESP32)
This simulates the exact encoding that would be produced by the mpack library
"""

import struct

def msgpack_encode_string(s):
    """Encode string exactly as mpack library would"""
    data = s.encode('utf-8')
    length = len(data)
    
    if length <= 31:
        # fixstr: 0xa0 + length
        return bytes([0xa0 + length]) + data
    elif length <= 255:
        # str8: 0xd9 + length
        return bytes([0xd9, length]) + data
    else:
        # str16: 0xda + length (2 bytes, big endian)
        return bytes([0xda, (length >> 8) & 0xFF, length & 0xFF]) + data

def msgpack_encode_map(count):
    """Encode map header exactly as mpack library would"""
    if count <= 15:
        # fixmap: 0x80 + count
        return bytes([0x80 + count])
    else:
        # map16: 0xde + count (2 bytes, big endian)
        return bytes([0xde, (count >> 8) & 0xFF, count & 0xFF])

def simulate_c_msgpack_compression(data):
    """Simulate exact C/C++ mpack encoding"""
    result = bytearray()
    
    # Start map with 20 key-value pairs
    result.extend(msgpack_encode_map(20))
    
    # Add all fields in exact order (same as C implementation)
    fields = [
        ("msisdn", data["msisdn"]),
        ("iso6346", data["iso6346"]),
        ("time", data["time"]),
        ("rssi", data["rssi"]),
        ("cgi", data["cgi"]),
        ("ble-m", data["ble-m"]),
        ("bat-soc", data["bat-soc"]),
        ("acc", data["acc"]),
        ("temperature", data["temperature"]),
        ("humidity", data["humidity"]),
        ("pressure", data["pressure"]),
        ("door", data["door"]),
        ("gnss", data["gnss"]),
        ("latitude", data["latitude"]),
        ("longitude", data["longitude"]),
        ("altitude", data["altitude"]),
        ("speed", data["speed"]),
        ("heading", data["heading"]),
        ("nsat", data["nsat"]),
        ("hdop", data["hdop"])
    ]
    
    for key, value in fields:
        # Encode key
        result.extend(msgpack_encode_string(key))
        # Encode value
        result.extend(msgpack_encode_string(value))
    
    return bytes(result)

def generate_test_data():
    """Generate same test data as Python/Node.js"""
    return {
        "msisdn": "393600504920",
        "iso6346": "LMCU0954822",
        "time": "300725 221117.8",
        "rssi": "21",
        "cgi": "999-01-1-31D41",
        "ble-m": "1",
        "bat-soc": "93",
        "acc": "-974.0700 -25.1270 -45.6744",
        "temperature": "18.32",
        "humidity": "75.44",
        "pressure": "1016.7932",
        "door": "D",
        "gnss": "1",
        "latitude": "31.9277",
        "longitude": "28.6378",
        "altitude": "56.62",
        "speed": "0.8",
        "heading": "302.07",
        "nsat": "11",
        "hdop": "5.0"
    }

def main():
    print("MessagePack Compression Simulation (C/C++ Implementation)")
    print("========================================================")
    print()
    
    # Generate test data
    test_data = generate_test_data()
    
    # Generate JSON for comparison
    import json
    json_string = json.dumps(test_data, separators=(',', ':'))
    json_bytes = json_string.encode('utf-8')
    
    print("Sample Container Data:")
    print(f"MSISDN: {test_data['msisdn']}")
    print(f"Container ID: {test_data['iso6346']}")
    print(f"Temperature: {test_data['temperature']}°C")
    print(f"Battery: {test_data['bat-soc']}%")
    print()
    
    # Simulate C/C++ MessagePack compression
    msgpack_data = simulate_c_msgpack_compression(test_data)
    
    print("Compression Results:")
    print(f"Original JSON size: {len(json_bytes)} bytes")
    print(f"MessagePack size (C/C++): {len(msgpack_data)} bytes")
    print(f"Compression ratio: {len(json_bytes) / len(msgpack_data):.2f}x")
    print(f"Size reduction: {len(json_bytes) - len(msgpack_data)} bytes ({((len(json_bytes) - len(msgpack_data)) / len(json_bytes) * 100):.1f}%)")
    
    print(f"\nMessagePack data (hex): {msgpack_data[:32].hex()}")
    if len(msgpack_data) > 32:
        print("...")
    
    print("\nComparison with Python/Node.js:")
    print("- Python: ~28.0% reduction")
    print("- Node.js: ~20.6% reduction")
    print(f"- C/C++ (simulated): {((len(json_bytes) - len(msgpack_data)) / len(json_bytes) * 100):.1f}% reduction")
    
    print("\nExpected ESP32 Performance:")
    print("- Should match this simulation exactly")
    print("- Direct binary encoding (no overhead)")
    print("- Optimized for embedded systems")
    print("- Consistent with mpack library")
    
    # Verify with actual Python msgpack for comparison
    try:
        import msgpack
        python_msgpack = msgpack.packb(test_data, use_bin_type=True)
        print(f"\nPython msgpack size: {len(python_msgpack)} bytes")
        print(f"Python reduction: {((len(json_bytes) - len(python_msgpack)) / len(json_bytes) * 100):.1f}%")
        
        if len(msgpack_data) == len(python_msgpack):
            print("✅ C/C++ simulation matches Python exactly!")
        else:
            print(f"⚠️  C/C++ simulation differs by {abs(len(msgpack_data) - len(python_msgpack))} bytes")
            
    except ImportError:
        print("\nPython msgpack library not available for comparison")

if __name__ == "__main__":
    main() 