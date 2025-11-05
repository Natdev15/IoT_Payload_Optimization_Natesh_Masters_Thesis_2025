#!/usr/bin/env python3
import argparse
import json
import os
import re
from datetime import datetime, timezone
from typing import Dict
from google.protobuf.message import Message
import container_data_pb2  # your generated module

MAX_PAYLOAD_SIZE = 158
REQUIRED_FIELDS = [
    "msisdn", "iso6346", "time", "rssi", "cgi", "ble-m", "bat-soc",
    "acc", "temperature", "humidity", "pressure", "door", "gnss",
    "latitude", "longitude", "altitude", "speed", "heading", "nsat", "hdop"
]

def _float(s): return float(s) if not isinstance(s, (float, int)) else float(s)
def _int(s):   return int(s) if not isinstance(s, int) else s
def _str(s):   return str(s)

def parse_acc(acc_raw: str):
    """
    Accepts formats like:
      "-993.9 -27.1 -52.0"
      "-993.9,-27.1,-52.0"
      "-993.9,-27.1 -52.0"
      "-993.9-27.1-52.0"  (no separators)
    """
    s = _str(acc_raw)
    nums = re.findall(r'[-+]?\d+(?:\.\d+)?', s)
    if len(nums) != 3:
        raise ValueError(f"acc must contain 3 numeric values; got {acc_raw}")
    return [float(v) for v in nums]

def json_to_protobuf(data: Dict) -> Message:
    pb = container_data_pb2.ContainerData()

    pb.msisdn  = _str(data["msisdn"])
    pb.iso6346 = _str(data["iso6346"])
    pb.time    = _str(data["time"])
    pb.cgi     = _str(data["cgi"])
    pb.door    = _str(data["door"])

    pb.rssi    = _int(data["rssi"])
    pb.ble_m   = _int(data["ble-m"])
    pb.bat_soc = _int(data["bat-soc"])
    pb.gnss    = _int(data["gnss"])
    pb.nsat    = _int(data["nsat"])

    acc_x, acc_y, acc_z = parse_acc(data["acc"])
    pb.acc_x, pb.acc_y, pb.acc_z = acc_x, acc_y, acc_z

    pb.temperature = _float(data["temperature"])
    pb.humidity    = _float(data["humidity"])
    pb.pressure    = _float(data["pressure"])
    pb.latitude    = _float(data["latitude"])
    pb.longitude   = _float(data["longitude"])
    pb.altitude    = _float(data["altitude"])
    pb.speed       = _float(data["speed"])
    pb.heading     = _float(data["heading"])
    pb.hdop        = _float(data["hdop"])

    return pb

def validate_fields(d: Dict):
    missing = [k for k in REQUIRED_FIELDS if k not in d]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")

def serialize(data: Dict) -> bytes:
    pb = json_to_protobuf(data)
    raw = pb.SerializeToString()
    if len(raw) >= MAX_PAYLOAD_SIZE:
        raise ValueError(f"Encoded payload is {len(raw)} bytes (>= {MAX_PAYLOAD_SIZE}). "
                         f"Reduce precision/fields if needed.")
    return raw

def bytes_to_hex(b: bytes) -> str:
    return b.hex().upper()

def save_artifacts(raw: bytes, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bin_path = os.path.join(out_dir, f"astrocast_payload_{ts}.bin")
    hex_path = os.path.join(out_dir, f"astrocast_payload_{ts}.hex")
    with open(bin_path, "wb") as f:
        f.write(raw)
    with open(hex_path, "w", encoding="utf-8") as f:
        f.write(bytes_to_hex(raw) + "\n")
    return bin_path, hex_path

def send_over_serial(hex_payload: str, port: str, baud: int = 115200, at_send_cmd: str = "AT+SEND"):
    try:
        import serial  # pyserial
    except Exception as e:
        raise RuntimeError("pyserial not installed. Run: pip install pyserial") from e

    with serial.Serial(port=port, baudrate=baud, timeout=2) as ser:
        def write_line(s: str):
            ser.write((s + "\r\n").encode("ascii"))

        write_line("AT")
        ser.readline()

        cmd = f"{at_send_cmd}={hex_payload}"
        write_line(cmd)

        resp = []
        try:
            for _ in range(5):
                line = ser.readline().decode(errors="ignore").strip()
                if not line:
                    break
                resp.append(line)
        except Exception:
            pass
        return resp

def load_json(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def generate_sample() -> Dict:
    from random import randint, random
    base_time = datetime.now(timezone.utc)
    return {
        "msisdn":  f"39360050{randint(4800, 4999)}",
        "iso6346": f"LMCU{str(randint(1, 999999)).zfill(7)}",
        "time":    base_time.strftime("%d%m%y%H%M%S.%f")[:-5],
        "rssi":    str(randint(15, 35)),
        "cgi":     "999-01-1-31D41",
        "ble-m":   str(randint(0, 1)),
        "bat-soc": str(90 + randint(-10, 0)),
        "acc":     "-993.9 -27.1 -52.0",
        "temperature": "22.10",
        "humidity":    "68.00",
        "pressure":    "1012.5043",
        "door":        "D",
        "gnss":        "1",
        "latitude":    "31.8910",
        "longitude":   "28.7041",
        "altitude":    "38.10",
        "speed":       "27.3",
        "heading":     "125.31",
        "nsat":        "06",
        "hdop":        "1.8",
    }

def main():
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--json", help="Path to JSON payload with required fields")
    g.add_argument("--generate", action="store_true", help="Generate one sample payload")
    p.add_argument("--preview", action="store_true", help="Print size + hex preview")
    p.add_argument("--save", action="store_true", help="Save .bin and .hex artifacts")
    p.add_argument("--out", default=".", help="Output directory for artifacts")
    p.add_argument("--serial", help="Serial port for Astrocast dev kit (e.g., COM3 or /dev/ttyUSB0)")
    p.add_argument("--baud", type=int, default=115200, help="Serial baud rate")
    p.add_argument("--atcmd", default="AT+SEND", help="AT command used to push hex")
    args = p.parse_args()

    data = generate_sample() if args.generate else load_json(args.json)
    validate_fields(data)

    raw = serialize(data)
    hex_payload = bytes_to_hex(raw)

    if args.preview:
        print(f"Encoded size: {len(raw)} bytes (limit {MAX_PAYLOAD_SIZE})")
        print(f"HEX (first 64): {hex_payload[:64]}{'...' if len(hex_payload)>64 else ''}")

    if args.save:
        bin_path, hex_path = save_artifacts(raw, args.out)
        print(f"Saved: {bin_path} (bin), {hex_path} (hex)")

    if args.serial:
        resp = send_over_serial(hex_payload, args.serial, args.baud, args.atcmd)
        print("Serial response:")
        for line in resp or []:
            print("  ", line)

    if not args.save and not args.serial:
        print(hex_payload)

if __name__ == "__main__":
    main()
