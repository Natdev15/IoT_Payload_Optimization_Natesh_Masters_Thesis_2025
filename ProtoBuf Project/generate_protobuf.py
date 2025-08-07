#!/usr/bin/env python3
"""
Generate Python protobuf file from schema
"""
import subprocess
import sys
import os

def generate_protobuf():
    """Generate Python protobuf file from container_data.proto"""
    try:
        # Check if protoc is available
        result = subprocess.run(['protoc', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ protoc compiler not found. Please install Protocol Buffers compiler:")
            print("   https://developers.google.com/protocol-buffers/docs/downloads")
            return False
        
        print(f"✅ Found protoc: {result.stdout.strip()}")
        
        # Generate Python file
        cmd = [
            'protoc',
            '--python_out=.',
            'container_data.proto'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Generated container_data_pb2.py successfully")
            return True
        else:
            print(f"❌ Failed to generate protobuf file: {result.stderr}")
            return False
            
    except FileNotFoundError:
        print("❌ protoc compiler not found in PATH")
        print("Please install Protocol Buffers compiler:")
        print("   https://developers.google.com/protocol-buffers/docs/downloads")
        return False
    except Exception as e:
        print(f"❌ Error generating protobuf: {e}")
        return False

if __name__ == "__main__":
    if generate_protobuf():
        print("🎉 Protocol Buffer generation completed!")
        print("📦 You can now run the locust_sender.py with protobuf support")
    else:
        print("💥 Protocol Buffer generation failed!")
        sys.exit(1) 