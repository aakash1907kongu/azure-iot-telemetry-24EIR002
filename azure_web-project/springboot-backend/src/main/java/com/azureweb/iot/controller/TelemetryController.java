package com.azureweb.iot.controller;

import com.azureweb.iot.model.TelemetryData;
import com.azureweb.iot.service.AzureEventHubConsumerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class TelemetryController {

    @Autowired
    private AzureEventHubConsumerService consumerService;

    @GetMapping({"/api/latest", "/api/data", "/data", "/json"})
    public ResponseEntity<TelemetryData> getLatest() {
        return ResponseEntity.ok(consumerService.getLatest());
    }

    @GetMapping({"/api/history", "/json/history"})
    public ResponseEntity<List<TelemetryData>> getHistory(
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return ResponseEntity.ok(consumerService.getHistory(limit));
    }

    @GetMapping({"/api/stats", "/json/stats"})
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = consumerService.getStats();
        stats.put("student_name", "Aakash K");
        stats.put("roll_no", "24EIR002");
        stats.put("department", "Electronics & Instrumentation Engineering");
        stats.put("college", "Kongu Engineering College");
        return ResponseEntity.ok(stats);
    }

    @PostMapping("/api/simulate")
    public ResponseEntity<Map<String, Object>> simulate(@RequestBody(required = false) Map<String, String> request) {
        String payload = (request != null && request.containsKey("payload"))
                ? request.get("payload")
                : "72, 101, 108, 108, 111";

        TelemetryData data = consumerService.processTelemetryPayload(payload, "simulated", null, "sim");
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("event", data);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> map = new HashMap<>();
        map.put("status", "ok");
        map.put("framework", "spring_boot_3");
        map.put("student_name", "Aakash K");
        map.put("roll_no", "24EIR002");
        map.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(map);
    }
}
