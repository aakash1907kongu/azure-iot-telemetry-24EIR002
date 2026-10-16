# Azure IoT Hub Live Telemetry Web Dashboard (`azure_web`)

A real-time telemetry monitoring and ASCII-to-string decoding web dashboard designed to ingest, process, and display live IoT messages from **Azure IoT Hub** / **Azure Event Hubs** using a **Python Flask** backend and a **React (JavaScript)** web interface.

---

## ðŸ‘¨â€ðŸŽ“ Student & Project Information

- **Student Name**: Aakash K
- **Roll / Register Number**: `24EIR002`
- **Department**: Electronics and Instrumentation Engineering (EIE)
- **Institution**: Kongu Engineering College
- **GitHub Repository**: [https://github.com/Bharath10125/azure_web](https://github.com/Bharath10125/azure_web)

---

## ðŸŽ¯ Assignment Objectives & Features Implemented

The frontend dashboard displays all six required parameters in real-time:

1. **Student Name**: `Aakash K`
2. **Roll Number**: `24EIR002`
3. **Connection Status**: Real-time status badge (`CONNECTED` in glowing green, `CONNECTING` in amber, `DISCONNECTED` in rose).
4. **Received ASCII Values**: Raw comma-separated ASCII decimal code integers (e.g., `72, 101, 108, 108, 111` or character code sequence).
5. **Converted String**: Corresponding string decoded from ASCII integers (e.g., `Hello` or `one_credit_course_project`).
6. **Last Event Timestamp**: Localized readable timestamp with UTC ISO format and relative elapsed time counter.

### ðŸ”¬ ASCII Conversion Demonstration
- Demonstrates character-by-character mapping of received ASCII codes (decimal) into readable characters:
  - Example: `72, 101, 108, 108, 111` âž” `Hello`
  - Chip breakdown: `[ 72 âž” 'H' ] [ 101 âž” 'e' ] [ 108 âž” 'l' ] [ 108 âž” 'l' ] [ 111 âž” 'o' ]`
- Includes an **Interactive Evaluator Testing Console** allowing custom ASCII sequences to be tested live.

---

## ðŸ› Intentionally Introduced Bugs Identified & Fixed

| Bug # | Component | Description & Root Cause | Resolution |
| :--- | :--- | :--- | :--- |
| **Bug 1** | `backend/server.py` | **SyntaxError in Connection String**: Broken quote escaping (`"Endpoint=sb:"your endpoint";"`) crashed Python on startup. | Replaced with the valid Azure Event Hub endpoint connection string. |
| **Bug 2** | `server.py` & `azure_web.js` | **Port Mismatch**: Backend was listening on port `5000` while React fetched from `http://127.0.0.1:8000/api/latest`, causing constant `DISCONNECTED` state. | Unified default port to `5000`, added environment variable support (`PORT` and `REACT_APP_API_URL`), and in-app settings switcher. |
| **Bug 3** | `backend/server.py` | **CORS Restriction**: CORS was hardcoded to `origins: ["http://localhost:3000"]`, blocking Vercel cloud deployments (`https://*.vercel.app`) and network IP access. | Configured CORS to allow all origins (`*`) and standard headers/methods. |
| **Bug 4** | `backend/server.py` | **Missing Telemetry Data**: Backend was discarding raw ASCII values and only returning decoded message. | Enhanced `decode_telemetry()` to return structured `ascii_values`, `ascii_string`, `converted_string`, `raw_data`, and metadata. |
| **Bug 5** | `src/azure_web.js` | **Missing Assignment Fields**: Frontend lacked student details, ASCII value display, and conversion demonstration. | Overhauled UI to render all 6 required fields with high-contrast cards, ASCII breakdown chips, and evaluator testing presets. |
| **Bug 6** | `backend/server.py` | **Event Hub Starting Position Lag**: `starting_position="@latest"` ignored existing events, leaving dashboard blank until new events arrived. | Added startup priming that reads the latest enqueued partition event immediately before streaming live messages. |

---

## âš™ï¸ Architecture & Data Pipeline

```
+-------------------------------------------------------------+
|                     IoT Device / Telemetry                  |
|          (Sends ASCII integer codes or text payload)        |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                   Azure IoT Hub / Event Hub                 |
|             (Endpoint: iothub-ehub-bharathiot...)           |
+------------------------------+------------------------------+
                               |
                               v (AMQP / TLS)
+-------------------------------------------------------------+
|                     Flask Backend Service                   |
|                        (backend/server.py)                  |
|   - EventHubConsumerClient background streaming listener    |
|   - Multi-format decoder (ASCII arrays, CSV codes, UTF-8)   |
|   - REST API: GET /api/latest & GET /health                 |
+------------------------------+------------------------------+
                               |
                               v (HTTP Polling / CORS enabled)
+-------------------------------------------------------------+
|                     React Web Frontend                      |
|                     (src/azure_web.js)                      |
|   - Student Verification Profile (Aakash K - 24EIR002)      |
|   - Live Connection Status Badge (CONNECTED / DISCONNECTED) |
|   - Received ASCII Values & Converted String Panels         |
|   - ASCII-to-Char Conversion Demonstration Chip Grid        |
|   - Evaluator Interactive Test Console                      |
+-------------------------------------------------------------+
```

---

## ðŸš€ Getting Started Locally

### 1. Backend Setup (`backend/server.py`)

1. Install Python dependencies:
   ```bash
   pip install flask flask-cors azure-eventhub
   ```

2. Start the backend service:
   ```bash
   python backend/server.py
   ```
   Backend will start on `http://127.0.0.1:5000` and immediately connect to Azure Event Hub.

### 2. Frontend Setup (`src/azure_web.js`)

1. Install Node dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

2. Start React development server:
   ```bash
   npm start
   ```
   Open `http://localhost:3000` in your web browser.

---

## ðŸŒ Deployment to Vercel

The application is pre-configured for deployment on **Vercel**:

### Option 1: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option 2: Deploy via GitHub (Recommended)
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Complete Azure IoT Hub Telemetry Assignment"
   git remote add origin https://github.com/<your-username>/azure_web.git
   git push -u origin main
   ```
2. Log into [vercel.com](https://vercel.com).
3. Click **"Add New Project"** and import your GitHub repository.
4. Set Build Command: `npm run build` and Output Directory: `build`.
5. Click **"Deploy"**.

---

## ðŸ“¡ API Reference

| Endpoint | Method | Description | Sample Response |
| :--- | :--- | :--- | :--- |
| `/api/latest` | `GET` | Returns latest received telemetry and ASCII breakdown | `{"status": "connected", "converted_string": "Hello", "ascii_values": [72,101,108,108,111], "ascii_string": "72, 101, 108, 108, 111", "timestamp": "2026-10-15T15:58:20Z"}` |
| `/health` | `GET` | Health check probe | `{"status": "ok", "service": "azure_web_backend"}` |
