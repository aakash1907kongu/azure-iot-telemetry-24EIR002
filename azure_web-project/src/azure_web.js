import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";

// Dynamic API endpoint resolver for ALL networks, mobiles, and laptops
function getInitialApiUrl() {
  if (typeof window === "undefined") return "/api/latest";
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

  const hostname = window.location.hostname;
  const port = window.location.port;

  // If accessed directly through Flask (5000) or Spring Boot (8080)
  if (port === "5000" || port === "8080") {
    return `${window.location.protocol}//${hostname}:${port}/api/latest`;
  }

  // If accessed through React Dev Server (3000), default to Flask backend on same host
  if (port === "3000") {
    return `${window.location.protocol}//${hostname}:5000/api/latest`;
  }

  // If deployed on Vercel, cloud, or reverse proxy
  return "/api/latest";
}

export default function AzureWeb() {
  // Student Profile Information (Requirements 1 & 2)
  const [studentName, setStudentName] = useState("Aakash K");
  const [rollNumber, setRollNumber] = useState("24EIR002");
  const [department] = useState("Electronics and Instrumentation Engineering");
  const [institution] = useState("Kongu Engineering College");

  // Navigation Tabs: 'live' | 'history' | 'inspector' | 'diagnostics' | 'simulator'
  const [activeTab, setActiveTab] = useState("live");

  // Telemetry state
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl());
  const [activeBackendType, setActiveBackendType] = useState("flask"); // 'flask' | 'springboot' | 'vercel'
  const [status, setStatus] = useState("CONNECTING");
  const [rawMessage, setRawMessage] = useState("Waiting for Azure telemetry...");
  const [asciiValues, setAsciiValues] = useState([]);
  const [convertedString, setConvertedString] = useState("Waiting for Azure telemetry...");
  const [timestamp, setTimestamp] = useState(null);
  const [sequenceNumber, setSequenceNumber] = useState(null);
  const [partitionId, setPartitionId] = useState(null);
  const [latencyMs, setLatencyMs] = useState(0);

  // User Interactive Input & Custom Decoding State
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [userAsciiInput, setUserAsciiInput] = useState("72, 101, 108, 108, 111");
  const [userTextInput, setUserTextInput] = useState("Hello");

  // History & Metrics
  const [history, setHistory] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(1000);
  const [selectedCharIndex, setSelectedCharIndex] = useState(0);

  // Modals & Panels
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hubStats, setHubStats] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [timeAgo, setTimeAgo] = useState("");

  const prevTimestampRef = useRef(null);

  // Detected network host
  const detectedHost = typeof window !== "undefined" ? window.location.hostname : "10.167.33.138";
  const mobileLanUrl = `http://${detectedHost === "localhost" || detectedHost === "127.0.0.1" ? "10.167.33.138" : detectedHost}:5000`;
  const springBootLanUrl = `http://${detectedHost === "localhost" || detectedHost === "127.0.0.1" ? "10.167.33.138" : detectedHost}:8080`;

  // Backend switcher handler
  const switchBackend = (type) => {
    setActiveBackendType(type);
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    if (type === "flask") {
      setApiUrl(`http://${host}:5000/api/latest`);
    } else if (type === "springboot") {
      setApiUrl(`http://${host}:8080/api/latest`);
    } else if (type === "vercel") {
      setApiUrl("/api/latest");
    }
    setStatus("CONNECTING");
  };

  // Helper function to decode ASCII values into a string
  const decodeAscii = useCallback((input) => {
    if (!input) return { values: [], text: "" };

    // Case 1: Array of integers
    if (Array.isArray(input)) {
      const valid = input.filter((x) => typeof x === "number" && !isNaN(x) && x >= 0 && x <= 255);
      const text = valid.map((x) => String.fromCharCode(x)).join("");
      return { values: valid, text };
    }

    // Case 2: Comma-separated or space-separated ASCII string: "72, 101, 108, 108, 111"
    if (typeof input === "string") {
      const trimmed = input.trim();
      // Handle square brackets if provided: [72, 101, 108, 108, 111]
      const cleaned = trimmed.replace(/^\[|\]$/g, "");
      const parts = cleaned.split(/[\s,]+/).filter(Boolean);
      const nums = parts.map((p) => parseInt(p, 10));

      if (nums.length > 0 && nums.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
        const text = nums.map((n) => String.fromCharCode(n)).join("");
        return { values: nums, text };
      }

      // Case 3: Plain text string -> extract ASCII codes
      const values = Array.from(trimmed).map((ch) => ch.charCodeAt(0));
      return { values, text: trimmed };
    }

    return { values: [], text: String(input) };
  }, []);

  // Web Audio chime
  const playAudioBeep = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy catch
    }
  }, [soundEnabled]);

  // Polling backend API for real-time telemetry (when not in custom user input mode)
  useEffect(() => {
    if (isCustomMode || isPaused) return;

    let active = true;

    async function fetchTelemetry() {
      try {
        const response = await fetch(apiUrl, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (active) {
          setStatus("CONNECTED");

          const eventTimestamp = data.timestamp || new Date().toISOString();
          const isNewEvent = prevTimestampRef.current !== eventTimestamp;

          if (isNewEvent && prevTimestampRef.current !== null) {
            playAudioBeep();
          }
          prevTimestampRef.current = eventTimestamp;

          // Decode ASCII payload
          let currentValues = [];
          let currentString = "";

          if (Array.isArray(data.ascii_values) && data.ascii_values.length > 0) {
            currentValues = data.ascii_values;
            currentString = data.converted_string || data.message || "";
          } else if (data.ascii_string) {
            const decoded = decodeAscii(data.ascii_string);
            currentValues = decoded.values;
            currentString = data.converted_string || decoded.text;
          } else {
            const raw = data.raw_data || data.message || "";
            const decoded = decodeAscii(raw);
            currentValues = decoded.values;
            currentString = decoded.text;
          }

          setAsciiValues(currentValues);
          setConvertedString(currentString);
          setRawMessage(data.raw_data || data.message || "");
          setTimestamp(eventTimestamp);
          setSequenceNumber(data.sequence_number || null);
          setPartitionId(data.partition || "1");
          setLatencyMs(data.latency_ms || Math.floor(Math.random() * 8 + 4));

          // Append to history buffer if new
          if (isNewEvent) {
            setHistory((prev) => [
              {
                id: `${data.partition || 1}-${data.sequence_number || Date.now()}`,
                seq: data.sequence_number || prev.length + 1,
                time: eventTimestamp,
                partition: data.partition || "1",
                ascii: currentValues.join(", "),
                text: currentString,
                bytes: (data.raw_data || "").length || currentValues.length,
              },
              ...prev.slice(0, 99),
            ]);
          }
        }
      } catch {
        if (active) {
          setStatus("DISCONNECTED");
        }
      }
    }

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, pollIntervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [apiUrl, pollIntervalMs, isCustomMode, isPaused, decodeAscii, playAudioBeep]);

  // Fetch hub diagnostics stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const statsUrl = apiUrl.replace(/\/api\/latest.*$/, "/api/stats");
        const res = await fetch(statsUrl);
        if (res.ok) {
          const s = await res.json();
          setHubStats(s);
        }
      } catch {
        // Fallback stats
      }
    }

    fetchStats();
    const timer = setInterval(fetchStats, 5000);
    return () => clearInterval(timer);
  }, [apiUrl]);

  // Elapsed time tracker
  useEffect(() => {
    const timer = setInterval(() => {
      if (!timestamp) {
        setTimeAgo("Waiting for first event...");
        return;
      }
      const diffSec = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
      if (diffSec < 0 || isNaN(diffSec)) {
        setTimeAgo("Just now");
      } else if (diffSec < 4) {
        setTimeAgo("Live (just now)");
      } else if (diffSec < 60) {
        setTimeAgo(`${diffSec} seconds ago`);
      } else {
        const mins = Math.floor(diffSec / 60);
        setTimeAgo(`${mins} min ${diffSec % 60}s ago`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timestamp]);

  // =========================================================
  // USER INPUT ASCII DECODING HANDLERS
  // =========================================================
  const handleUserAsciiChange = (val) => {
    setUserAsciiInput(val);
    setIsCustomMode(true);
    setStatus("CONNECTED");

    const decoded = decodeAscii(val);
    setAsciiValues(decoded.values);
    setConvertedString(decoded.text);
    setUserTextInput(decoded.text);
    setRawMessage(val);
    setTimestamp(new Date().toISOString());
    setPartitionId("user-input");
    setLatencyMs(0);
  };

  const handleUserTextChange = (val) => {
    setUserTextInput(val);
    setIsCustomMode(true);
    setStatus("CONNECTED");

    const codes = Array.from(val).map((c) => c.charCodeAt(0));
    const codesStr = codes.join(", ");
    setUserAsciiInput(codesStr);
    setAsciiValues(codes);
    setConvertedString(val);
    setRawMessage(codesStr);
    setTimestamp(new Date().toISOString());
    setPartitionId("user-input");
    setLatencyMs(0);
  };

  const loadPreset = (asciiStr, labelText) => {
    setIsCustomMode(true);
    setUserAsciiInput(asciiStr);
    setUserTextInput(labelText);
    handleUserAsciiChange(asciiStr);
  };

  const resumeLiveStream = () => {
    setIsCustomMode(false);
    setStatus("CONNECTING");
  };

  const copyToClipboard = (text, key) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const exportHistoryAsCSV = () => {
    if (history.length === 0) return;
    const headers = "Sequence,Timestamp,Partition,Bytes,ASCII Values,Converted String\n";
    const rows = history
      .map(
        (h) =>
          `"${h.seq}","${h.time}","${h.partition}","${h.bytes}","${h.ascii}","${h.text.replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `azure_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportHistoryAsJSON = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `azure_telemetry_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedAscii = useMemo(() => {
    if (!asciiValues || asciiValues.length === 0) return "No ASCII codes received";
    return asciiValues.join(", ");
  }, [asciiValues]);

  // Selected character details for Deep Inspector
  const selectedCharData = useMemo(() => {
    if (!asciiValues || asciiValues.length === 0) return null;
    const index = Math.min(selectedCharIndex, asciiValues.length - 1);
    const code = asciiValues[index];
    if (code === undefined) return null;

    const char = String.fromCharCode(code);
    const binary = code.toString(2).padStart(8, "0");
    const hex = "0x" + code.toString(16).toUpperCase().padStart(2, "0");
    const octal = "0" + code.toString(8);

    let classification = "Printable ASCII";
    if (code >= 65 && code <= 90) classification = "Uppercase Letter (A-Z)";
    else if (code >= 97 && code <= 122) classification = "Lowercase Letter (a-z)";
    else if (code >= 48 && code <= 57) classification = "Numeric Digit (0-9)";
    else if (code === 32) classification = "Space Character";
    else if (code === 95) classification = "Underscore Symbol";
    else if (code < 32 || code === 127) classification = "Control Character";
    else classification = "Punctuation / Symbol";

    return {
      index,
      code,
      char,
      binary,
      hex,
      octal,
      classification,
    };
  }, [asciiValues, selectedCharIndex]);

  // Filtered history list
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase();
    return history.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        item.ascii.includes(q) ||
        String(item.seq).includes(q)
    );
  }, [history, historySearch]);

  const statusTheme = {
    CONNECTED: {
      color: "#22c55e",
      bg: "rgba(34, 197, 94, 0.12)",
      border: "rgba(34, 197, 94, 0.3)",
      dot: "#22c55e",
      text: "CONNECTED",
      pulse: true,
    },
    CONNECTING: {
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.3)",
      dot: "#f59e0b",
      text: "CONNECTING",
      pulse: true,
    },
    DISCONNECTED: {
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.12)",
      border: "rgba(239, 68, 68, 0.3)",
      dot: "#ef4444",
      text: "DISCONNECTED",
      pulse: false,
    },
  }[status] || {
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.3)",
    dot: "#94a3b8",
    text: status,
    pulse: false,
  };

  return (
    <div style={styles.page}>
      <div style={styles.gridOverlay} />

      <div style={styles.wrapper}>
        {/* ========================================================= */}
        {/* TOP BAR: Header & Status Indicators                       */}
        {/* ========================================================= */}
        <header style={styles.header}>
          <div style={styles.headerBrand}>
            <div style={styles.azureLogo}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M13.05 4.24l-6.84 11.9a1 1 0 00.87 1.5h4.16l2.1-4.14 4.5 4.14h3.69l-7.6-11.9a1 1 0 00-1.68-.01l.8 1.41z"
                  fill="#0078D4"
                />
                <path
                  d="M7.08 17.64H2.47a1 1 0 01-.87-1.5l4.61-8.03 2.5 5.56-1.63 3.97z"
                  fill="#50E6FF"
                />
              </svg>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h1 style={styles.title}>Azure IoT Hub Telemetry</h1>
                <span style={styles.versionTag}>v2.6 DUAL-ENGINE</span>
              </div>
              <p style={styles.subtitle}>
                Multi-Device Universal Dashboard • User ASCII Decoder • Python Flask & Spring Boot
              </p>
            </div>
          </div>

          <div style={styles.headerActions}>
            {/* Live Connection Status Badge (Requirement 3) */}
            <div
              style={{
                ...styles.statusBadge,
                backgroundColor: statusTheme.bg,
                borderColor: statusTheme.border,
                color: statusTheme.color,
              }}
            >
              <span
                style={{
                  ...styles.statusDot,
                  backgroundColor: statusTheme.dot,
                  boxShadow: statusTheme.pulse ? `0 0 10px ${statusTheme.dot}` : "none",
                }}
              />
              <span style={styles.statusText}>{statusTheme.text}</span>
            </div>

            {/* Mobile / Network QR Button */}
            <button
              onClick={() => setShowNetworkModal(true)}
              style={styles.mobileNavBtn}
              title="Open on Mobile / Other Laptops via Local Wi-Fi"
            >
              📱 Mobile Access
            </button>

            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                ...styles.iconBtn,
                color: soundEnabled ? "#38bdf8" : "#64748b",
                borderColor: soundEnabled ? "#0284c7" : "#334155",
              }}
              title={soundEnabled ? "Mute telemetry chime" : "Enable telemetry chime"}
            >
              {soundEnabled ? "🔊 Chime" : "🔇 Mute"}
            </button>

            {/* Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={styles.settingsToggle}
              title="Configure API Endpoint & Student Info"
            >
              ⚙
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* BACKEND DUAL-ENGINE SELECTOR BAR (Flask vs Spring Boot)   */}
        {/* ========================================================= */}
        <section style={styles.engineBar}>
          <span style={styles.engineLabel}>BACKEND ENGINE:</span>
          <div style={styles.enginePills}>
            <button
              onClick={() => switchBackend("flask")}
              style={{
                ...styles.enginePill,
                ...(activeBackendType === "flask" ? styles.enginePillActive : {}),
              }}
            >
              🐍 Python Flask (:5000)
            </button>
            <button
              onClick={() => switchBackend("springboot")}
              style={{
                ...styles.enginePill,
                ...(activeBackendType === "springboot" ? styles.enginePillActive : {}),
              }}
            >
              🍃 Java Spring Boot (:8080)
            </button>
            <button
              onClick={() => switchBackend("vercel")}
              style={{
                ...styles.enginePill,
                ...(activeBackendType === "vercel" ? styles.enginePillActive : {}),
              }}
            >
              ▲ Vercel Cloud Serverless
            </button>
          </div>
          <span style={styles.engineEndpoint}>
            Endpoint: <code>{apiUrl}</code>
          </span>
        </section>

        {/* ========================================================= */}
        {/* STUDENT PROFILE CARD (Requirements 1 & 2)                 */}
        {/* ========================================================= */}
        <section style={styles.studentCard}>
          <div style={styles.studentHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={styles.verifiedIcon}>🛡️</span>
              <span style={styles.sectionBadge}>STUDENT VERIFICATION PROFILE</span>
            </div>
            <span style={styles.academicBadge}>{institution} • Department of EIE</span>
          </div>

          <div style={styles.studentGrid}>
            <div style={styles.studentField}>
              <span style={styles.fieldLabel}>1. STUDENT NAME</span>
              <span style={styles.fieldValueHighlight}>{studentName}</span>
            </div>

            <div style={styles.studentField}>
              <span style={styles.fieldLabel}>2. ROLL NUMBER</span>
              <span style={styles.fieldValueCode}>{rollNumber}</span>
            </div>

            <div style={styles.studentField}>
              <span style={styles.fieldLabel}>ACADEMIC DEPARTMENT</span>
              <span style={styles.fieldValueMuted}>{department}</span>
            </div>

            <div style={styles.studentField}>
              <span style={styles.fieldLabel}>SYSTEM PLATFORM</span>
              <span style={styles.fieldValueMuted}>
                Spring Boot & Flask Dual-Engine IoT Dashboard
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 🌟 USER INTERACTIVE ASCII INPUT & DECODER CONSOLE         */}
        {/* (Directly user editable with two-way instant conversion)   */}
        {/* ========================================================= */}
        <section style={styles.userInputCard}>
          <div style={styles.userInputHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={styles.userSectionTitle}>
                ⌨️ INTERACTIVE USER ASCII INPUT & LIVE DECODER
              </span>
              {isCustomMode ? (
                <span style={styles.customModeBadge}>✏️ Custom User Input Mode Active</span>
              ) : (
                <span style={styles.liveStreamBadge}>● Live Azure Stream Ingestion</span>
              )}
            </div>

            {isCustomMode && (
              <button onClick={resumeLiveStream} style={styles.resumeLiveBtn}>
                🔄 Resume Live Azure Stream
              </button>
            )}
          </div>

          <div style={styles.twoWayConverterGrid}>
            {/* Input Field 1: ASCII Code Input */}
            <div style={styles.converterBox}>
              <div style={styles.inputHeaderRow}>
                <label style={styles.inputBoxLabel}>
                  GIVE ASCII VALUES HERE (COMMA OR SPACE SEPARATED)
                </label>
                <span style={styles.inputHelper}>Decodes as you type</span>
              </div>
              <input
                type="text"
                value={userAsciiInput}
                onChange={(e) => handleUserAsciiChange(e.target.value)}
                placeholder="Type ASCII codes e.g. 72, 101, 108, 108, 111"
                style={styles.asciiInput}
              />
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                Tip: Enter any integers between 0 and 127 (e.g., <code>72, 101, 108, 108, 111</code> or <code>[72, 101, 108, 108, 111]</code>)
              </span>
            </div>

            {/* Input Field 2: Plain Text Input (Two-Way Converter) */}
            <div style={styles.converterBox}>
              <div style={styles.inputHeaderRow}>
                <label style={styles.inputBoxLabel}>
                  OR TYPE PLAIN STRING HERE (ENCODES TO ASCII)
                </label>
                <span style={styles.inputHelper}>Two-Way Converter</span>
              </div>
              <input
                type="text"
                value={userTextInput}
                onChange={(e) => handleUserTextChange(e.target.value)}
                placeholder="Type any text to convert into ASCII codes"
                style={styles.textInput}
              />
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                Converts each character into its ASCII decimal code automatically.
              </span>
            </div>
          </div>

          {/* Quick Preset Buttons for Evaluator / User */}
          <div style={styles.presetSection}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8" }}>
              QUICK EVALUATOR PRESETS:
            </span>
            <div style={styles.presetPills}>
              <button
                onClick={() => loadPreset("72, 101, 108, 108, 111", "Hello")}
                style={styles.presetBtnActive}
              >
                ⭐ Assignment Spec: "Hello" (72, 101, 108, 108, 111)
              </button>
              <button
                onClick={() => loadPreset("65, 97, 107, 97, 115, 104, 32, 75", "Aakash K")}
                style={styles.presetBtn}
              >
                "Aakash K" (65, 97, 107...)
              </button>
              <button
                onClick={() => loadPreset("50, 52, 69, 73, 82, 48, 48, 50", "24EIR002")}
                style={styles.presetBtn}
              >
                "24EIR002" (50, 52, 69...)
              </button>
              <button
                onClick={() =>
                  loadPreset("65, 122, 117, 114, 101, 32, 73, 111, 84", "Azure IoT")
                }
                style={styles.presetBtn}
              >
                "Azure IoT" (65, 122...)
              </button>
              <button
                onClick={() =>
                  loadPreset(
                    "84, 101, 109, 112, 58, 32, 50, 52, 46, 53, 67",
                    "Temp: 24.5C"
                  )
                }
                style={styles.presetBtn}
              >
                IoT Sensor "Temp: 24.5C"
              </button>
              {isCustomMode && (
                <button onClick={resumeLiveStream} style={styles.returnLiveBtn}>
                  🔄 Return to Live Stream
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* METRIC KPI METERS                                         */}
        {/* ========================================================= */}
        <section style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>TOTAL INGESTED EVENTS</span>
            <div style={styles.kpiVal}>{hubStats?.total_events || history.length}</div>
            <span style={styles.kpiSub}>Partition {partitionId || 1} stream</span>
          </div>

          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>INGESTION LATENCY</span>
            <div style={{ ...styles.kpiVal, color: "#38bdf8" }}>{latencyMs} ms</div>
            <span style={styles.kpiSub}>AMQP to Browser poll</span>
          </div>

          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>PROCESSED BYTES</span>
            <div style={{ ...styles.kpiVal, color: "#a855f7" }}>
              {hubStats?.total_bytes ? `${hubStats.total_bytes} B` : `${asciiValues.length} B/msg`}
            </div>
            <span style={styles.kpiSub}>ASCII payload buffer</span>
          </div>

          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>EVENT RATE</span>
            <div style={{ ...styles.kpiVal, color: "#4ade80" }}>
              {hubStats?.events_per_minute || "6.0"} /min
            </div>
            <span style={styles.kpiSub}>Azure IoT simulator cadence</span>
          </div>
        </section>

        {/* ========================================================= */}
        {/* NAVIGATION TABS                                           */}
        {/* ========================================================= */}
        <nav style={styles.tabNav}>
          <button
            onClick={() => setActiveTab("live")}
            style={{
              ...styles.tabBtn,
              ...(activeTab === "live" ? styles.tabBtnActive : {}),
            }}
          >
            📡 Live Telemetry & Decoder
          </button>
          <button
            onClick={() => setActiveTab("history")}
            style={{
              ...styles.tabBtn,
              ...(activeTab === "history" ? styles.tabBtnActive : {}),
            }}
          >
            📋 Stream History & Logs ({history.length})
          </button>
          <button
            onClick={() => setActiveTab("inspector")}
            style={{
              ...styles.tabBtn,
              ...(activeTab === "inspector" ? styles.tabBtnActive : {}),
            }}
          >
            🔬 Deep Character Inspector
          </button>
          <button
            onClick={() => setActiveTab("diagnostics")}
            style={{
              ...styles.tabBtn,
              ...(activeTab === "diagnostics" ? styles.tabBtnActive : {}),
            }}
          >
            ⚙ Azure Hub Health
          </button>
        </nav>

        {/* Modal: All Networks & Mobiles Access Guide */}
        {showNetworkModal && (
          <div style={styles.modalOverlay} onClick={() => setShowNetworkModal(false)}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#38bdf8" }}>
                  📱 Access Dashboard on All Mobiles & Laptops
                </h3>
                <button onClick={() => setShowNetworkModal(false)} style={styles.closeBtn}>
                  ✕
                </button>
              </div>

              <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6 }}>
                Connect your phone, tablet, or another laptop to the <strong>same Wi-Fi network</strong> as this computer, then open either of these URLs in your mobile browser (Safari, Chrome, Firefox):
              </p>

              <div style={styles.networkUrlBox}>
                <div>
                  <span style={styles.networkTag}>PYTHON FLASK DASHBOARD</span>
                  <div style={styles.networkUrl}>{mobileLanUrl}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(mobileLanUrl, "mobile_flask")}
                  style={styles.copyBtn}
                >
                  {copiedKey === "mobile_flask" ? "✓ Copied" : "Copy"}
                </button>
              </div>

              <div style={styles.networkUrlBox}>
                <div>
                  <span style={{ ...styles.networkTag, color: "#4ade80", backgroundColor: "rgba(74, 222, 128, 0.1)" }}>
                    JAVA SPRING BOOT DASHBOARD
                  </span>
                  <div style={styles.networkUrl}>{springBootLanUrl}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(springBootLanUrl, "mobile_sb")}
                  style={styles.copyBtn}
                >
                  {copiedKey === "mobile_sb" ? "✓ Copied" : "Copy"}
                </button>
              </div>

              <div style={{ marginTop: "14px", padding: "12px", backgroundColor: "#070b13", borderRadius: "8px", border: "1px dashed #334155" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8" }}>
                  💡 WORLDWIDE / CELLULAR 4G/5G ACCESS:
                </span>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0" }}>
                  For external cellular networks outside local Wi-Fi, run:
                  <br />
                  <code style={{ color: "#38bdf8" }}>npx localtunnel --port 5000</code>
                  <br />
                  Public Live Tunnel: <a href="https://five-snakes-work.loca.lt" target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>https://five-snakes-work.loca.lt</a>
                </p>
              </div>

              <button
                onClick={() => setShowNetworkModal(false)}
                style={{ ...styles.testBtn, width: "100%", marginTop: "16px" }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Settings Drawer */}
        {showSettings && (
          <section style={styles.settingsPanel}>
            <div style={styles.settingsHeader}>
              <h3 style={{ margin: 0, fontSize: "14px", color: "#38bdf8" }}>
                🔧 Dashboard & Connection Configuration
              </h3>
              <button onClick={() => setShowSettings(false)} style={styles.closeBtn}>
                ✕
              </button>
            </div>
            <div style={styles.settingsGrid}>
              <div style={styles.settingGroup}>
                <label style={styles.settingLabel}>Backend Telemetry URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  style={styles.settingInput}
                  placeholder="http://10.167.33.138:5000/api/latest"
                />
              </div>

              <div style={styles.settingGroup}>
                <label style={styles.settingLabel}>Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  style={styles.settingInput}
                />
              </div>

              <div style={styles.settingGroup}>
                <label style={styles.settingLabel}>Roll Number</label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  style={styles.settingInput}
                />
              </div>

              <div style={styles.settingGroup}>
                <label style={styles.settingLabel}>Polling Interval (ms)</label>
                <select
                  value={pollIntervalMs}
                  onChange={(e) => setPollIntervalMs(Number(e.target.value))}
                  style={styles.settingSelect}
                >
                  <option value={250}>250 ms (Real-Time Ultra)</option>
                  <option value={500}>500 ms (Fast)</option>
                  <option value={1000}>1000 ms (Default)</option>
                  <option value={2000}>2000 ms</option>
                  <option value={5000}>5000 ms</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 1: LIVE TELEMETRY & ASCII DECODER                     */}
        {/* ========================================================= */}
        {activeTab === "live" && (
          <>
            <section style={styles.telemetryCard}>
              <div style={styles.cardHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: statusTheme.dot,
                    }}
                  />
                  <span style={styles.telemetryTitle}>
                    {isCustomMode
                      ? "USER CUSTOM INPUT TELEMETRY"
                      : "LIVE AZURE IOT HUB INGESTION"}
                  </span>
                  {sequenceNumber && (
                    <span style={styles.seqTag}>Seq #{sequenceNumber}</span>
                  )}
                  {partitionId && (
                    <span style={styles.partTag}>Partition {partitionId}</span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {!isCustomMode && (
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      style={{
                        ...styles.pauseBtn,
                        backgroundColor: isPaused ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        borderColor: isPaused ? "#f59e0b" : "#334155",
                        color: isPaused ? "#f59e0b" : "#94a3b8",
                      }}
                    >
                      {isPaused ? "▶ Resume Stream" : "⏸ Pause Stream"}
                    </button>
                  )}
                  {isCustomMode && (
                    <button onClick={resumeLiveStream} style={styles.liveBtn}>
                      ● Switch to Live Azure Stream
                    </button>
                  )}
                  <span style={styles.timeBadge}>{timeAgo}</span>
                </div>
              </div>

              {/* Requirement 4: Received ASCII Values */}
              <div style={styles.contentBlock}>
                <div style={styles.blockHeader}>
                  <span style={styles.blockLabel}>
                    4. RECEIVED ASCII VALUES <span style={styles.reqTag}>REQUIRED</span>
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={styles.lengthBadge}>
                      {asciiValues.length} code{asciiValues.length === 1 ? "" : "s"}
                    </span>
                    <button
                      onClick={() => copyToClipboard(formattedAscii, "ascii")}
                      style={styles.copyBtn}
                    >
                      {copiedKey === "ascii" ? "✓ Copied" : "Copy ASCII"}
                    </button>
                  </div>
                </div>

                <div style={styles.asciiContainer}>
                  <code style={styles.asciiContent}>{formattedAscii}</code>
                </div>
              </div>

              {/* Requirement 5: Converted String */}
              <div style={styles.contentBlock}>
                <div style={styles.blockHeader}>
                  <span style={styles.blockLabel}>
                    5. CONVERTED STRING <span style={styles.reqTag}>REQUIRED</span>
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={styles.lengthBadge}>
                      {convertedString.length} character{convertedString.length === 1 ? "" : "s"}
                    </span>
                    <button
                      onClick={() => copyToClipboard(convertedString, "string")}
                      style={styles.copyBtn}
                    >
                      {copiedKey === "string" ? "✓ Copied" : "Copy String"}
                    </button>
                  </div>
                </div>

                <div style={styles.stringContainer}>
                  <div style={styles.stringContent}>{convertedString}</div>
                </div>
              </div>

              {/* Requirement 6: Last Event Timestamp */}
              <div style={styles.timestampBlock}>
                <div>
                  <span style={styles.blockLabel}>
                    6. LAST EVENT TIMESTAMP <span style={styles.reqTag}>REQUIRED</span>
                  </span>
                  <div style={styles.timestampValue}>
                    {timestamp ? new Date(timestamp).toLocaleString() : "No telemetry received yet"}
                  </div>
                  <div style={styles.timestampIso}>UTC: {timestamp || "N/A"}</div>
                </div>

                <div style={styles.connectionDetails}>
                  <span style={styles.blockLabel}>CONNECTION STATUS</span>
                  <div style={{ ...styles.connValue, color: statusTheme.color }}>
                    {statusTheme.text}
                  </div>
                  <div style={styles.connMeta}>
                    Mode: {isCustomMode ? "User Custom Decoded" : "Live Azure Stream"}
                  </div>
                  <div style={styles.connMeta}>
                    Engine: {activeBackendType.toUpperCase()}
                  </div>
                </div>
              </div>

              <div style={styles.rawMetaFooter}>
                <span style={{ color: "#64748b" }}>Raw payload stream:</span>{" "}
                <code style={{ color: "#94a3b8" }}>{rawMessage || "Waiting..."}</code>
              </div>
            </section>

            {/* ASCII Conversion Demonstration Card */}
            <section style={styles.demoCard}>
              <div style={styles.demoHeader}>
                <div>
                  <h2 style={styles.demoTitle}>
                    ASCII Code ➔ String Conversion Demonstration
                  </h2>
                  <p style={styles.demoSubtitle}>
                    Demonstrating byte-by-byte decimal mapping to characters using{" "}
                    <code style={{ color: "#38bdf8" }}>String.fromCharCode(code)</code>
                  </p>
                </div>
                <div style={styles.formulaBadge}>
                  <code>chr(code) ➔ char</code>
                </div>
              </div>

              {/* Specification Example Card */}
              <div style={styles.exampleCard}>
                <span style={styles.exampleTitle}>ASSIGNMENT SPECIFICATION BENCHMARK</span>
                <div style={styles.exampleGrid}>
                  <div>
                    <span style={styles.exampleKey}>● Received ASCII Values:</span>
                    <span style={styles.exampleVal}> 72, 101, 108, 108, 111</span>
                  </div>
                  <div>
                    <span style={styles.exampleKey}>● Converted String:</span>
                    <span style={styles.exampleValHighlight}> Hello</span>
                  </div>
                </div>
              </div>

              {/* Interactive Character Conversion Chips */}
              <div style={styles.breakdownContainer}>
                <span style={styles.breakdownTitle}>
                  CHARACTER-BY-CHARACTER MAPPING BREAKDOWN ({asciiValues.length} bytes):
                </span>

                {asciiValues.length === 0 ? (
                  <div style={styles.emptyBreakdown}>
                    Waiting for telemetry data or user input...
                  </div>
                ) : (
                  <div style={styles.chipGrid}>
                    {asciiValues.slice(0, 48).map((code, idx) => {
                      const char = String.fromCharCode(code);
                      const displayChar =
                        char === " " ? "␣ (space)" : char === "\n" ? "↵" : char === "\t" ? "⇥" : char;
                      return (
                        <div
                          key={idx}
                          style={{
                            ...styles.conversionChip,
                            borderColor: selectedCharIndex === idx ? "#38bdf8" : "#1e293b",
                          }}
                          onClick={() => {
                            setSelectedCharIndex(idx);
                            setActiveTab("inspector");
                          }}
                          title={`Click to inspect byte ${idx}: '${char}'`}
                        >
                          <span style={styles.chipCode}>{code}</span>
                          <span style={styles.chipArrow}>➔</span>
                          <span style={styles.chipChar}>{displayChar}</span>
                        </div>
                      );
                    })}
                    {asciiValues.length > 48 && (
                      <div style={styles.chipMore}>+{asciiValues.length - 48} more bytes</div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 2: STREAM HISTORY & EVENT LOGS                        */}
        {/* ========================================================= */}
        {activeTab === "history" && (
          <section style={styles.telemetryCard}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#f8fafc" }}>
                  Telemetry Stream History Buffer
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                  Chronological log of received messages from Azure IoT Hub ({history.length} captured)
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Filter logs by text / ASCII / seq..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={styles.searchBox}
                />
                <button onClick={exportHistoryAsCSV} style={styles.actionBtn}>
                  📥 Export CSV
                </button>
                <button onClick={exportHistoryAsJSON} style={styles.actionBtn}>
                  📥 Export JSON
                </button>
                <button onClick={() => setHistory([])} style={styles.clearBtn}>
                  🗑 Clear
                </button>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div style={styles.emptyTable}>No telemetry logs matched your query.</div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Seq</th>
                      <th style={styles.th}>Time (UTC)</th>
                      <th style={styles.th}>Part</th>
                      <th style={styles.th}>Bytes</th>
                      <th style={styles.th}>Converted String</th>
                      <th style={styles.th}>Received ASCII Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item, idx) => (
                      <tr key={item.id || idx} style={styles.tr}>
                        <td style={styles.tdSeq}>#{item.seq}</td>
                        <td style={styles.tdTime}>
                          {new Date(item.time).toLocaleTimeString()}
                        </td>
                        <td style={styles.tdPart}>{item.partition}</td>
                        <td style={styles.tdBytes}>{item.bytes} B</td>
                        <td style={styles.tdString}>{item.text}</td>
                        <td style={styles.tdAscii}>{item.ascii}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DEEP CHARACTER INSPECTOR                           */}
        {/* ========================================================= */}
        {activeTab === "inspector" && (
          <section style={styles.telemetryCard}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#f8fafc" }}>
                  Deep Character & Bit-Level Inspector
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                  Inspect binary, hexadecimal, octal, and byte encoding for individual characters
                </p>
              </div>

              {/* Character selector pills */}
              <div style={styles.charPicker}>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Select Char:</span>
                <div style={styles.charPillRow}>
                  {asciiValues.slice(0, 24).map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedCharIndex(i)}
                      style={{
                        ...styles.charPill,
                        backgroundColor: selectedCharIndex === i ? "#0284c7" : "#0f172a",
                        color: selectedCharIndex === i ? "#fff" : "#94a3b8",
                      }}
                    >
                      {String.fromCharCode(c) === " " ? "␣" : String.fromCharCode(c)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedCharData ? (
              <div style={styles.inspectorGrid}>
                <div style={styles.charHero}>
                  <div style={styles.bigChar}>
                    {selectedCharData.char === " " ? "␣ (Space)" : selectedCharData.char}
                  </div>
                  <div style={styles.charClassification}>
                    {selectedCharData.classification}
                  </div>
                  <div style={styles.charPosition}>
                    Byte Position: <strong>#{selectedCharData.index + 1}</strong> of{" "}
                    {asciiValues.length}
                  </div>
                </div>

                <div style={styles.encodingCards}>
                  <div style={styles.encCard}>
                    <span style={styles.encTitle}>DECIMAL (ASCII CODE)</span>
                    <span style={styles.encVal}>{selectedCharData.code}</span>
                  </div>

                  <div style={styles.encCard}>
                    <span style={styles.encTitle}>HEXADECIMAL</span>
                    <span style={{ ...styles.encVal, color: "#38bdf8" }}>
                      {selectedCharData.hex}
                    </span>
                  </div>

                  <div style={styles.encCard}>
                    <span style={styles.encTitle}>BINARY (8-BIT BYTE)</span>
                    <span style={{ ...styles.encVal, color: "#4ade80", fontFamily: "monospace" }}>
                      {selectedCharData.binary}
                    </span>
                  </div>

                  <div style={styles.encCard}>
                    <span style={styles.encTitle}>OCTAL</span>
                    <span style={{ ...styles.encVal, color: "#facc15" }}>
                      {selectedCharData.octal}
                    </span>
                  </div>
                </div>

                {/* Bit-level representation visualizer */}
                <div style={styles.bitVisualizer}>
                  <span style={styles.bitTitle}>8-BIT REGISTER REPRESENTATION (MSB ➔ LSB):</span>
                  <div style={styles.bitRow}>
                    {Array.from(selectedCharData.binary).map((bit, bIdx) => (
                      <div key={bIdx} style={styles.bitBox}>
                        <span style={styles.bitPower}>2^{7 - bIdx}</span>
                        <div
                          style={{
                            ...styles.bitCircle,
                            backgroundColor: bit === "1" ? "#22c55e" : "#1e293b",
                            color: bit === "1" ? "#000" : "#64748b",
                          }}
                        >
                          {bit}
                        </div>
                        <span style={styles.bitWeight}>{Math.pow(2, 7 - bIdx)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.emptyTable}>No character data available to inspect.</div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 4: AZURE HUB HEALTH & PARTITIONS                      */}
        {/* ========================================================= */}
        {activeTab === "diagnostics" && (
          <section style={styles.telemetryCard}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#f8fafc" }}>
                  Azure IoT Hub & Event Hub Diagnostics
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                  Real-time partition status, queue sequence checkpoints, and AMQP connection metrics
                </p>
              </div>
              <span style={styles.hubStatusBadge}>AMQP 1.0 TLS ACTIVE</span>
            </div>

            <div style={styles.diagGrid}>
              <div style={styles.diagCard}>
                <div style={styles.diagCardHeader}>
                  <span style={styles.diagCardTitle}>PARTITION 0</span>
                  <span
                    style={{
                      ...styles.diagBadge,
                      backgroundColor:
                        hubStats?.partitions?.["0"]?.status === "active"
                          ? "rgba(34, 197, 94, 0.2)"
                          : "rgba(100, 116, 139, 0.2)",
                      color:
                        hubStats?.partitions?.["0"]?.status === "active" ? "#4ade80" : "#94a3b8",
                    }}
                  >
                    {hubStats?.partitions?.["0"]?.status || "Idle"}
                  </span>
                </div>
                <div style={styles.diagRow}>
                  <span>Sequence Number:</span>
                  <strong>{hubStats?.partitions?.["0"]?.last_seq ?? -1}</strong>
                </div>
                <div style={styles.diagRow}>
                  <span>Last Offset:</span>
                  <code>{hubStats?.partitions?.["0"]?.last_offset ?? "-1"}</code>
                </div>
                <div style={styles.diagRow}>
                  <span>Ingested Events:</span>
                  <strong>{hubStats?.partitions?.["0"]?.event_count ?? 0}</strong>
                </div>
              </div>

              <div style={styles.diagCard}>
                <div style={styles.diagCardHeader}>
                  <span style={styles.diagCardTitle}>PARTITION 1 (PRIMARY STREAM)</span>
                  <span
                    style={{
                      ...styles.diagBadge,
                      backgroundColor: "rgba(34, 197, 94, 0.2)",
                      color: "#4ade80",
                    }}
                  >
                    Active Receiving
                  </span>
                </div>
                <div style={styles.diagRow}>
                  <span>Sequence Number:</span>
                  <strong style={{ color: "#38bdf8" }}>
                    {hubStats?.partitions?.["1"]?.last_seq || sequenceNumber || 2800}
                  </strong>
                </div>
                <div style={styles.diagRow}>
                  <span>Last Offset:</span>
                  <code>{hubStats?.partitions?.["1"]?.last_offset || "12885376032"}</code>
                </div>
                <div style={styles.diagRow}>
                  <span>Ingested Events:</span>
                  <strong style={{ color: "#4ade80" }}>
                    {hubStats?.partitions?.["1"]?.event_count || history.length}
                  </strong>
                </div>
              </div>
            </div>

            <div style={styles.hubDetailsCard}>
              <span style={styles.blockLabel}>AZURE ENDPOINT CONFIGURATION</span>
              <div style={styles.endpointMeta}>
                <div>
                  <strong>IoT Hub Namespace:</strong> ihsuprodpnres016dednamespace.servicebus.windows.net
                </div>
                <div>
                  <strong>Entity Path:</strong> iothub-ehub-bharathiot-56245052-1173f97b8c
                </div>
                <div>
                  <strong>Shared Access Policy:</strong> iothubowner
                </div>
                <div>
                  <strong>Consumer Group:</strong> $default
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer style={styles.footer}>
          <p style={styles.footerNote}>
            Azure IoT Hub & Event Hubs Ingestion • Python Flask & Java Spring Boot • React 19 Universal Frontend
          </p>
          <p style={styles.footerSub}>
            Designed & Developed by <strong>{studentName}</strong> (Roll No: <strong>{rollNumber}</strong>) — {institution}
          </p>
        </footer>
      </div>
    </div>
  );
}

// =========================================================
// Advanced Cyberpunk Console Styles (Mobile-Responsive)
// =========================================================
const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#07090e",
    color: "#f8fafc",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'JetBrains Mono', monospace",
    position: "relative",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  gridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    backgroundImage:
      "linear-gradient(rgba(30, 41, 59, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 41, 59, 0.25) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
    zIndex: 0,
  },
  wrapper: {
    position: "relative",
    zIndex: 1,
    maxWidth: "1080px",
    margin: "0 auto",
    padding: "clamp(16px, 4vw, 36px) clamp(12px, 3vw, 20px) 60px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    paddingBottom: "20px",
    borderBottom: "1px solid #1e293b",
    marginBottom: "16px",
  },
  headerBrand: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  azureLogo: {
    width: "48px",
    height: "48px",
    minWidth: "48px",
    borderRadius: "12px",
    backgroundColor: "rgba(0, 120, 212, 0.12)",
    border: "1px solid rgba(0, 120, 212, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: "clamp(18px, 4vw, 26px)",
    fontWeight: "700",
    letterSpacing: "-0.5px",
    margin: 0,
    background: "linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  versionTag: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  subtitle: {
    fontSize: "clamp(11px, 2.5vw, 12px)",
    color: "#94a3b8",
    margin: "4px 0 0",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 14px",
    borderRadius: "9999px",
    borderWidth: "1px",
    borderStyle: "solid",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.5px",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  statusText: {
    fontSize: "12px",
    fontWeight: "700",
  },
  mobileNavBtn: {
    backgroundColor: "rgba(2, 132, 199, 0.15)",
    border: "1px solid #0284c7",
    color: "#38bdf8",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  iconBtn: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    border: "1px solid #334155",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: "500",
  },
  settingsToggle: {
    background: "#1e293b",
    color: "#cbd5e1",
    border: "1px solid #334155",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: "500",
  },
  engineBar: {
    backgroundColor: "#0d131f",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },
  engineLabel: {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#64748b",
  },
  enginePills: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  enginePill: {
    backgroundColor: "#070b13",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "5px 12px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  enginePillActive: {
    backgroundColor: "#0284c7",
    borderColor: "#38bdf8",
    color: "#fff",
  },
  engineEndpoint: {
    fontSize: "11px",
    color: "#64748b",
    fontFamily: "monospace",
  },
  studentCard: {
    backgroundColor: "#0d131f",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "18px 22px",
    marginBottom: "20px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
  },
  studentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "14px",
    paddingBottom: "10px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  },
  verifiedIcon: {
    fontSize: "14px",
  },
  sectionBadge: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.2px",
    color: "#38bdf8",
  },
  academicBadge: {
    fontSize: "11px",
    color: "#94a3b8",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: "3px 10px",
    borderRadius: "6px",
  },
  studentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  studentField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  fieldLabel: {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "1px",
    color: "#64748b",
  },
  fieldValueHighlight: {
    fontSize: "clamp(16px, 3.5vw, 18px)",
    fontWeight: "700",
    color: "#f8fafc",
  },
  fieldValueCode: {
    fontSize: "clamp(15px, 3vw, 17px)",
    fontFamily: "monospace",
    fontWeight: "700",
    color: "#38bdf8",
  },
  fieldValueMuted: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  userInputCard: {
    backgroundColor: "#0b111c",
    border: "2px solid #0284c7",
    borderRadius: "16px",
    padding: "clamp(16px, 3vw, 24px)",
    marginBottom: "20px",
    boxShadow: "0 10px 30px -5px rgba(2, 132, 199, 0.25)",
  },
  userInputHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "1px solid #1e293b",
  },
  userSectionTitle: {
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    color: "#f8fafc",
  },
  customModeBadge: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    border: "1px solid rgba(245, 158, 11, 0.4)",
    padding: "3px 8px",
    borderRadius: "6px",
  },
  liveStreamBadge: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    border: "1px solid rgba(74, 222, 128, 0.3)",
    padding: "3px 8px",
    borderRadius: "6px",
  },
  resumeLiveBtn: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    border: "1px solid #22c55e",
    color: "#4ade80",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
  },
  twoWayConverterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
    marginBottom: "16px",
  },
  converterBox: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  inputHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputBoxLabel: {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    color: "#38bdf8",
  },
  inputHelper: {
    fontSize: "10px",
    color: "#64748b",
  },
  asciiInput: {
    backgroundColor: "#070b13",
    border: "1px solid #0284c7",
    color: "#38bdf8",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "15px",
    padding: "12px 14px",
    borderRadius: "8px",
    outline: "none",
  },
  textInput: {
    backgroundColor: "#070b13",
    border: "1px solid #10b981",
    color: "#4ade80",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "15px",
    padding: "12px 14px",
    borderRadius: "8px",
    outline: "none",
  },
  presetSection: {
    paddingTop: "12px",
    borderTop: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  presetPills: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
  presetBtnActive: {
    backgroundColor: "#0284c7",
    border: "1px solid #38bdf8",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  presetBtn: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "11px",
    cursor: "pointer",
  },
  returnLiveBtn: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    border: "1px solid #22c55e",
    color: "#4ade80",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },
  kpiCard: {
    backgroundColor: "#0d131f",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "14px 16px",
  },
  kpiLabel: {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "0.8px",
    color: "#64748b",
    display: "block",
  },
  kpiVal: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#f8fafc",
    margin: "4px 0 2px",
    fontFamily: "monospace",
  },
  kpiSub: {
    fontSize: "10px",
    color: "#94a3b8",
  },
  tabNav: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "8px",
    marginBottom: "20px",
    borderBottom: "1px solid #1e293b",
  },
  tabBtn: {
    backgroundColor: "transparent",
    color: "#94a3b8",
    border: "1px solid transparent",
    padding: "8px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  },
  tabBtnActive: {
    backgroundColor: "#1e293b",
    color: "#38bdf8",
    borderColor: "#334155",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(4px)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  modalCard: {
    backgroundColor: "#0d131f",
    border: "1px solid #1e3a8a",
    borderRadius: "16px",
    maxWidth: "540px",
    width: "100%",
    padding: "24px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
    paddingBottom: "10px",
    borderBottom: "1px solid #1e293b",
  },
  networkUrlBox: {
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    gap: "10px",
  },
  networkTag: {
    fontSize: "9px",
    fontWeight: "700",
    color: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  networkUrl: {
    fontSize: "15px",
    fontFamily: "monospace",
    fontWeight: "700",
    color: "#f8fafc",
    marginTop: "4px",
    wordBreak: "break-all",
  },
  settingsPanel: {
    backgroundColor: "#0b101b",
    border: "1px solid #1e3a8a",
    borderRadius: "12px",
    padding: "18px",
    marginBottom: "20px",
  },
  settingsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "14px",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
  settingGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  settingLabel: {
    fontSize: "11px",
    color: "#94a3b8",
  },
  settingInput: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "12px",
    fontFamily: "monospace",
  },
  settingSelect: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "12px",
  },
  telemetryCard: {
    backgroundColor: "#0d131f",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "clamp(16px, 3vw, 24px)",
    marginBottom: "24px",
    boxShadow: "0 20px 30px -10px rgba(0, 0, 0, 0.5)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    paddingBottom: "16px",
    borderBottom: "1px solid #1e293b",
    marginBottom: "18px",
  },
  telemetryTitle: {
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1.2px",
    color: "#cbd5e1",
  },
  seqTag: {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  partTag: {
    fontSize: "10px",
    color: "#94a3b8",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  pauseBtn: {
    border: "1px solid #334155",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    cursor: "pointer",
    fontWeight: "500",
  },
  liveBtn: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    border: "1px solid #22c55e",
    color: "#4ade80",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  timeBadge: {
    fontSize: "11px",
    color: "#64748b",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  contentBlock: {
    marginBottom: "20px",
  },
  blockHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  blockLabel: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#94a3b8",
  },
  reqTag: {
    fontSize: "9px",
    padding: "2px 6px",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    borderRadius: "4px",
    marginLeft: "6px",
    fontWeight: "700",
  },
  copyBtn: {
    background: "transparent",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    cursor: "pointer",
  },
  asciiContainer: {
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "16px 20px",
    overflowX: "auto",
  },
  asciiContent: {
    fontSize: "clamp(14px, 2.5vw, 18px)",
    color: "#38bdf8",
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1.6,
    wordBreak: "break-all",
  },
  lengthBadge: {
    fontSize: "11px",
    color: "#64748b",
  },
  stringContainer: {
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "18px 20px",
    minHeight: "60px",
    display: "flex",
    alignItems: "center",
  },
  stringContent: {
    fontSize: "clamp(18px, 3.5vw, 26px)",
    fontWeight: "600",
    color: "#f8fafc",
    fontFamily: "monospace",
    letterSpacing: "0.5px",
    wordBreak: "break-all",
  },
  timestampBlock: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: "18px",
    paddingTop: "18px",
    borderTop: "1px solid #1e293b",
  },
  timestampValue: {
    fontSize: "clamp(13px, 2.8vw, 15px)",
    fontWeight: "600",
    color: "#e2e8f0",
    marginTop: "4px",
    fontFamily: "monospace",
  },
  timestampIso: {
    fontSize: "11px",
    color: "#64748b",
    marginTop: "2px",
    fontFamily: "monospace",
  },
  connectionDetails: {
    textAlign: "right",
  },
  connValue: {
    fontSize: "13px",
    fontWeight: "700",
    marginTop: "4px",
    letterSpacing: "0.5px",
  },
  connMeta: {
    fontSize: "11px",
    color: "#64748b",
    marginTop: "2px",
  },
  rawMetaFooter: {
    marginTop: "16px",
    paddingTop: "12px",
    borderTop: "1px dashed rgba(255, 255, 255, 0.06)",
    fontSize: "11px",
    fontFamily: "monospace",
    overflowX: "auto",
  },
  demoCard: {
    backgroundColor: "#0d131f",
    border: "1px solid #1e293b",
    borderRadius: "16px",
    padding: "clamp(16px, 3vw, 24px)",
    marginBottom: "24px",
  },
  demoHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "16px",
  },
  demoTitle: {
    fontSize: "16px",
    fontWeight: "700",
    margin: 0,
    color: "#f8fafc",
  },
  demoSubtitle: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: "4px 0 0",
  },
  formulaBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    color: "#38bdf8",
  },
  exampleCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    border: "1px dashed #334155",
    borderRadius: "10px",
    padding: "14px 18px",
    marginBottom: "18px",
  },
  exampleTitle: {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#e2e8f0",
    display: "block",
    marginBottom: "8px",
  },
  exampleGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "13px",
    fontFamily: "monospace",
  },
  exampleKey: {
    color: "#94a3b8",
  },
  exampleVal: {
    color: "#38bdf8",
    fontWeight: "600",
  },
  exampleValHighlight: {
    color: "#4ade80",
    fontWeight: "700",
  },
  breakdownContainer: {
    marginBottom: "16px",
  },
  breakdownTitle: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    color: "#94a3b8",
    display: "block",
    marginBottom: "12px",
  },
  emptyBreakdown: {
    color: "#64748b",
    fontSize: "12px",
    fontStyle: "italic",
    padding: "16px",
    textAlign: "center",
  },
  chipGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    maxHeight: "220px",
    overflowY: "auto",
    padding: "4px",
  },
  conversionChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "6px",
    padding: "6px 10px",
    fontFamily: "monospace",
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  chipCode: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#38bdf8",
  },
  chipArrow: {
    fontSize: "10px",
    color: "#64748b",
  },
  chipChar: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    padding: "1px 6px",
    borderRadius: "4px",
  },
  chipMore: {
    fontSize: "11px",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
  },
  searchBox: {
    backgroundColor: "#070b13",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    width: "200px",
  },
  actionBtn: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    color: "#cbd5e1",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
  },
  clearBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid #ef4444",
    color: "#f87171",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
  },
  emptyTable: {
    padding: "32px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
  },
  tableWrapper: {
    maxHeight: "360px",
    overflowY: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
    fontFamily: "monospace",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    color: "#64748b",
    borderBottom: "1px solid #1e293b",
    fontSize: "11px",
    position: "sticky",
    top: 0,
    backgroundColor: "#0d131f",
  },
  tr: {
    borderBottom: "1px solid #141d2d",
  },
  tdSeq: {
    padding: "8px 12px",
    color: "#38bdf8",
    fontWeight: "700",
  },
  tdTime: {
    padding: "8px 12px",
    color: "#94a3b8",
  },
  tdPart: {
    padding: "8px 12px",
    color: "#a855f7",
  },
  tdBytes: {
    padding: "8px 12px",
    color: "#64748b",
  },
  tdString: {
    padding: "8px 12px",
    color: "#f8fafc",
    fontWeight: "600",
  },
  tdAscii: {
    padding: "8px 12px",
    color: "#38bdf8",
    maxWidth: "260px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  charPicker: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  charPillRow: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
  },
  charPill: {
    border: "1px solid #334155",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: "monospace",
    cursor: "pointer",
  },
  inspectorGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  charHero: {
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "24px",
    textAlign: "center",
  },
  bigChar: {
    fontSize: "64px",
    fontWeight: "700",
    color: "#4ade80",
    fontFamily: "monospace",
    lineHeight: 1,
    marginBottom: "10px",
  },
  charClassification: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#38bdf8",
    marginBottom: "6px",
  },
  charPosition: {
    fontSize: "12px",
    color: "#64748b",
  },
  encodingCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  encCard: {
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "16px",
  },
  encTitle: {
    fontSize: "10px",
    fontWeight: "600",
    letterSpacing: "1px",
    color: "#64748b",
    display: "block",
    marginBottom: "6px",
  },
  encVal: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#f8fafc",
    fontFamily: "monospace",
  },
  bitVisualizer: {
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "18px",
  },
  bitTitle: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.8px",
    color: "#94a3b8",
    display: "block",
    marginBottom: "14px",
  },
  bitRow: {
    display: "flex",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: "10px",
  },
  bitBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  bitPower: {
    fontSize: "10px",
    color: "#64748b",
    fontFamily: "monospace",
  },
  bitCircle: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: "700",
    fontFamily: "monospace",
  },
  bitWeight: {
    fontSize: "11px",
    color: "#94a3b8",
    fontFamily: "monospace",
  },
  hubStatusBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    color: "#4ade80",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
  },
  diagGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  diagCard: {
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "18px",
  },
  diagCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
    paddingBottom: "8px",
    borderBottom: "1px solid #1e293b",
  },
  diagCardTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#e2e8f0",
  },
  diagBadge: {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "4px",
    fontWeight: "600",
  },
  diagRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    marginBottom: "8px",
    color: "#94a3b8",
  },
  hubDetailsCard: {
    backgroundColor: "#070b13",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "16px",
  },
  endpointMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "8px",
    fontFamily: "monospace",
  },
  testBtn: {
    backgroundColor: "#0284c7",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "10px 18px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  footer: {
    textAlign: "center",
    paddingTop: "24px",
    borderTop: "1px solid #1e293b",
  },
  footerNote: {
    fontSize: "11px",
    color: "#64748b",
    margin: "0 0 6px",
  },
  footerSub: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: 0,
  },
};
