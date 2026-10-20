import os
import json
import threading
from collections import deque
from datetime import datetime, timezone
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from azure.eventhub import EventHubConsumerClient

# Locate production React build directory
BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "build"))

app = Flask(__name__, static_folder=BUILD_DIR, static_url_path="")

# Enable CORS for all origins, allowing Vercel deployment & localhost
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Azure Event Hub endpoint configuration
CONNECTION_STRING = os.environ.get(
    "AZURE_EVENTHUB_CONNECTION_STRING",
    "Endpoint=sb://ihsuprodpnres016dednamespace.servicebus.windows.net/;"
    "SharedAccessKeyName=iothubowner;"
    "SharedAccessKey=+mk2+0LDW4D+i/WE1G6/9sP41m5kWJAexAIoTObd5kE=;"
    "EntityPath=iothub-ehub-bharathiot-56245052-1173f97b8c"
)

CONSUMER_GROUP = "$default"

server_start_time = datetime.now(timezone.utc)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True

# Telemetry data state
latest = {
    "status": "connected",
    "student_name": "Aakash K",
    "roll_no": "24EIR002",
    "department": "Electronics & Instrumentation Engineering",
    "college": "Kongu Engineering College",
    "raw_data": "Waiting for Azure telemetry...",
    "ascii_values": [],
    "ascii_string": "",
    "converted_string": "Waiting for Azure telemetry...",
    "message": "Waiting for Azure telemetry...",
    "timestamp": None,
    "partition": None,
    "sequence_number": None,
    "payload_bytes": 0,
    "latency_ms": None,
}

history_log = deque(maxlen=100)
partition_stats = {
    "0": {"status": "idle", "last_seq": 0, "last_offset": "0", "event_count": 0},
    "1": {"status": "active", "last_seq": 0, "last_offset": "0", "event_count": 0},
}
stats = {
    "total_events": 0,
    "total_bytes": 0,
}
data_lock = threading.Lock()


def decode_telemetry(raw):
    """
    Decodes telemetry into both ASCII integer arrays and converted strings.
    Handles:
      1. JSON ASCII array: "[72, 101, 108, 108, 111]" -> [72, 101, 108, 108, 111] -> "Hello"
      2. Comma-separated ASCII numbers: "72, 101, 108, 108, 111" -> [72, 101, 108, 108, 111] -> "Hello"
      3. Plain text string: "one_credit_course_project" -> ASCII codes -> "one_credit_course_project"
    """
    text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
    text = text.strip()

    # Case 1: JSON array of ASCII codes, e.g. [72, 101, 108, 108, 111]
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list) and len(parsed) > 0 and all(
            isinstance(x, int) and 0 <= x <= 127 for x in parsed
        ):
            ascii_vals = parsed
            conv_str = "".join(chr(x) for x in ascii_vals)
            return {
                "raw": text,
                "ascii_values": ascii_vals,
                "ascii_string": ", ".join(str(x) for x in ascii_vals),
                "converted_string": conv_str,
                "message": conv_str
            }
    except (json.JSONDecodeError, TypeError):
        pass

    # Case 2: Comma-separated ASCII integers, e.g. "72, 101, 108, 108, 111"
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if len(parts) > 1:
        try:
            codes = [int(p) for p in parts]
            if all(0 <= x <= 127 for x in codes):
                conv_str = "".join(chr(x) for x in codes)
                return {
                    "raw": text,
                    "ascii_values": codes,
                    "ascii_string": ", ".join(str(x) for x in codes),
                    "converted_string": conv_str,
                    "message": conv_str
                }
        except ValueError:
            pass

    # Case 3: Plain text string, e.g. "one_credit_course_project" or "Hello"
    ascii_vals = [ord(c) for c in text]
    return {
        "raw": text,
        "ascii_values": ascii_vals,
        "ascii_string": ", ".join(str(x) for x in ascii_vals),
        "converted_string": text,
        "message": text
    }


def receive_events():
    """
    Background worker that connects to Azure Event Hub.
    Reads recent messages on startup so telemetry displays immediately,
    then continuously listens for live stream events.
    """
    print("[Azure Backend] Connecting to Azure Event Hubs...", flush=True)

    def on_event(partition_context, event):
        if event is None:
            return

        now_utc = datetime.now(timezone.utc)
        try:
            raw_body = event.body_as_str(encoding="UTF-8")
        except Exception:
            raw_body = str(event.body)

        decoded = decode_telemetry(raw_body)
        enqueued_time = event.enqueued_time or now_utc
        timestamp = enqueued_time.isoformat()
        latency_ms = max(0, int((now_utc - enqueued_time).total_seconds() * 1000))
        payload_bytes = len(raw_body.encode("utf-8"))

        event_item = {
            "id": f"{partition_context.partition_id}-{event.sequence_number}",
            "status": "connected",
            "student_name": "Aakash K",
            "roll_no": "24EIR002",
            "department": "Electronics & Instrumentation Engineering",
            "college": "Kongu Engineering College",
            "raw_data": decoded["raw"],
            "ascii_values": decoded["ascii_values"],
            "ascii_string": decoded["ascii_string"],
            "converted_string": decoded["converted_string"],
            "message": decoded["message"],
            "timestamp": timestamp,
            "partition": partition_context.partition_id,
            "sequence_number": event.sequence_number,
            "offset": event.offset,
            "payload_bytes": payload_bytes,
            "latency_ms": latency_ms,
        }

        with data_lock:
            latest.update(event_item)
            history_log.appendleft(event_item)
            stats["total_events"] += 1
            stats["total_bytes"] += payload_bytes

            p_id = str(partition_context.partition_id)
            if p_id in partition_stats:
                partition_stats[p_id]["status"] = "active"
                partition_stats[p_id]["last_seq"] = event.sequence_number
                partition_stats[p_id]["last_offset"] = str(event.offset)
                partition_stats[p_id]["event_count"] += 1

        print(f"[Azure Backend] Telemetry Received | Partition {partition_context.partition_id} | String: '{decoded['converted_string']}' | ASCII: {decoded['ascii_string'][:35]}...", flush=True)

    while True:
        try:
            client = EventHubConsumerClient.from_connection_string(
                conn_str=CONNECTION_STRING,
                consumer_group=CONSUMER_GROUP,
            )
            with client:
                try:
                    for pid in client.get_partition_ids():
                        prop = client.get_partition_properties(pid)
                        p_id = str(pid)
                        if p_id in partition_stats:
                            partition_stats[p_id]["last_seq"] = prop.get("last_enqueued_sequence_number", 0)
                            partition_stats[p_id]["last_offset"] = str(prop.get("last_enqueued_offset", "0"))
                            partition_stats[p_id]["status"] = "active" if not prop.get("is_empty") else "idle"

                        if not prop.get("is_empty"):
                            last_seq = prop.get("last_enqueued_sequence_number", 0)
                            print(f"[Azure Backend] Partition {pid} active. Priming starting at seq {last_seq}...", flush=True)
                            client.receive(
                                on_event=on_event,
                                partition_id=pid,
                                starting_position=last_seq,
                                max_wait_time=3
                            )
                except Exception as prime_err:
                    print(f"[Azure Backend] Startup prime note: {prime_err}", flush=True)

                print("[Azure Backend] Streaming live incoming events from Azure IoT Hub...", flush=True)
                client.receive(
                    on_event=on_event,
                    starting_position="@latest",
                )
        except Exception as exc:
            print(f"[Azure Backend] Receiver error: {exc}. Retrying in 5 seconds...", flush=True)
            import time
            time.sleep(5)


# Serve React app at root route
@app.route("/", methods=["GET"])
def index():
    if os.path.exists(os.path.join(BUILD_DIR, "index.html")):
        return send_from_directory(BUILD_DIR, "index.html")
    with data_lock:
        return jsonify(latest.copy())


@app.route("/api/latest", methods=["GET"])
@app.route("/api/data", methods=["GET"])
@app.route("/data", methods=["GET"])
@app.route("/json", methods=["GET"])
def get_latest():
    with data_lock:
        return jsonify(latest.copy())


@app.route("/api/history", methods=["GET"])
@app.route("/json/history", methods=["GET"])
def get_history():
    limit = request.args.get("limit", default=50, type=int)
    with data_lock:
        return jsonify(list(history_log)[:limit])


@app.route("/api/stats", methods=["GET"])
@app.route("/json/stats", methods=["GET"])
def get_stats():
    now_utc = datetime.now(timezone.utc)
    uptime_seconds = int((now_utc - server_start_time).total_seconds())
    with data_lock:
        rate = round((stats["total_events"] / (uptime_seconds / 60.0)), 2) if uptime_seconds > 0 else 0
        return jsonify({
            "status": "online",
            "student_name": "Aakash K",
            "roll_no": "24EIR002",
            "department": "Electronics & Instrumentation Engineering",
            "uptime_seconds": uptime_seconds,
            "total_events": stats["total_events"],
            "total_bytes": stats["total_bytes"],
            "events_per_minute": rate,
            "partitions": partition_stats,
            "history_count": len(history_log),
            "hub_name": "bharathiot-iothub",
            "entity_path": "iothub-ehub-bharathiot-56245052-1173f97b8c",
        })


@app.route("/api/simulate", methods=["POST"])
def simulate_telemetry():
    data = request.get_json(silent=True) or {}
    payload = data.get("payload", "72, 101, 108, 108, 111")
    decoded = decode_telemetry(payload)
    now_utc = datetime.now(timezone.utc)
    timestamp = now_utc.isoformat()
    payload_bytes = len(payload.encode("utf-8"))

    with data_lock:
        stats["total_events"] += 1
        stats["total_bytes"] += payload_bytes
        event_item = {
            "id": f"sim-{stats['total_events']}",
            "status": "connected",
            "student_name": "Aakash K",
            "roll_no": "24EIR002",
            "department": "Electronics & Instrumentation Engineering",
            "college": "Kongu Engineering College",
            "raw_data": decoded["raw"],
            "ascii_values": decoded["ascii_values"],
            "ascii_string": decoded["ascii_string"],
            "converted_string": decoded["converted_string"],
            "message": decoded["message"],
            "timestamp": timestamp,
            "partition": "simulated",
            "sequence_number": stats["total_events"],
            "offset": "sim",
            "payload_bytes": payload_bytes,
            "latency_ms": 2,
        }
        latest.update(event_item)
        history_log.appendleft(event_item)

    return jsonify({"status": "success", "event": event_item})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "azure_web_backend_advanced",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# Fallback route for React SPA assets & routes
@app.route("/<path:path>", methods=["GET"])
def static_proxy(path):
    file_path = os.path.join(BUILD_DIR, path)
    if os.path.exists(file_path) and not os.path.isdir(file_path):
        return send_from_directory(BUILD_DIR, path)
    if os.path.exists(os.path.join(BUILD_DIR, "index.html")):
        return send_from_directory(BUILD_DIR, "index.html")
    with data_lock:
        return jsonify(latest.copy())


if __name__ == "__main__":
    receiver_thread = threading.Thread(
        target=receive_events,
        daemon=True,
    )
    receiver_thread.start()

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 5000))
    print(f"[Azure Backend Advanced] Server starting on http://{host}:{port}", flush=True)
    app.run(
        host=host,
        port=port,
        debug=False,
    )
