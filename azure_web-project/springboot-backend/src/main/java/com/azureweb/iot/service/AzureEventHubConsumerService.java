package com.azureweb.iot.service;

import com.azure.messaging.eventhubs.EventData;
import com.azure.messaging.eventhubs.EventHubClientBuilder;
import com.azure.messaging.eventhubs.EventHubConsumerAsyncClient;
import com.azure.messaging.eventhubs.models.EventPosition;
import com.azureweb.iot.model.TelemetryData;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class AzureEventHubConsumerService {

    @Value("${azure.eventhub.connection-string}")
    private String connectionString;

    @Value("${azure.eventhub.consumer-group:$default}")
    private String consumerGroup;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TelemetryData latestTelemetry = new TelemetryData();
    private final Deque<TelemetryData> historyLog = new ConcurrentLinkedDeque<>();

    private final AtomicLong totalEvents = new AtomicLong(0);
    private final AtomicLong totalBytes = new AtomicLong(0);
    private final Instant startTime = Instant.now();

    private EventHubConsumerAsyncClient asyncClient;

    @PostConstruct
    public void init() {
        // Initialize default state
        latestTelemetry.setStatus("connected");
        latestTelemetry.setRawData("Waiting for Azure telemetry...");
        latestTelemetry.setConvertedString("Waiting for Azure telemetry...");
        latestTelemetry.setMessage("Waiting for Azure telemetry...");
        latestTelemetry.setAsciiValues(Collections.emptyList());
        latestTelemetry.setAsciiString("");
        latestTelemetry.setTimestamp(Instant.now().toString());

        // Start background Event Hub consumer thread
        Thread listenerThread = new Thread(this::startEventHubConsumer, "AzureEventHub-Listener");
        listenerThread.setDaemon(true);
        listenerThread.start();
    }

    private void startEventHubConsumer() {
        System.out.println("[Spring Boot] Initializing Azure Event Hub consumer...");
        try {
            asyncClient = new EventHubClientBuilder()
                    .connectionString(connectionString)
                    .consumerGroup(consumerGroup)
                    .buildAsyncConsumerClient();

            // Receive from Partition 1 starting from latest
            asyncClient.receiveFromPartition("1", EventPosition.latest())
                    .subscribe(
                            partitionEvent -> processEvent(partitionEvent.getPartitionContext().getPartitionId(), partitionEvent.getData()),
                            error -> System.err.println("[Spring Boot] Event Hub Stream Error: " + error.getMessage()),
                            () -> System.out.println("[Spring Boot] Event Hub Stream Completed")
                    );

            System.out.println("[Spring Boot] Subscribed to live telemetry on Azure Event Hub Partition 1!");
        } catch (Exception e) {
            System.err.println("[Spring Boot] Could not connect to Azure Event Hub SDK: " + e.getMessage());
            System.out.println("[Spring Boot] Running in fallback mode. Rest API is active.");
        }
    }

    public TelemetryData processTelemetryPayload(String rawBody, String partitionId, Long sequenceNumber, String offset) {
        String trimmed = rawBody != null ? rawBody.trim() : "";
        List<Integer> asciiList = new ArrayList<>();
        String convertedString = trimmed;

        // Check if JSON array: [72, 101, 108, 108, 111]
        boolean decodedAsArray = false;
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                List<Integer> parsed = objectMapper.readValue(trimmed, new TypeReference<List<Integer>>() {});
                if (!parsed.isEmpty() && parsed.stream().allMatch(x -> x >= 0 && x <= 255)) {
                    asciiList = parsed;
                    StringBuilder sb = new StringBuilder();
                    for (int code : asciiList) {
                        sb.append((char) code);
                    }
                    convertedString = sb.toString();
                    decodedAsArray = true;
                }
            } catch (Exception ignored) {}
        }

        // Check if comma-separated: 72, 101, 108, 108, 111
        if (!decodedAsArray && trimmed.contains(",")) {
            String[] parts = trimmed.split("[,\\s]+");
            try {
                List<Integer> parsed = new ArrayList<>();
                for (String p : parts) {
                    if (!p.isBlank()) {
                        int val = Integer.parseInt(p.trim());
                        if (val >= 0 && val <= 255) {
                            parsed.add(val);
                        }
                    }
                }
                if (!parsed.isEmpty() && parsed.size() == parts.length) {
                    asciiList = parsed;
                    StringBuilder sb = new StringBuilder();
                    for (int code : asciiList) {
                        sb.append((char) code);
                    }
                    convertedString = sb.toString();
                    decodedAsArray = true;
                }
            } catch (Exception ignored) {}
        }

        // Default: Plain text string -> Extract ASCII codes
        if (!decodedAsArray) {
            for (char c : trimmed.toCharArray()) {
                asciiList.add((int) c);
            }
        }

        StringBuilder asciiStrBuilder = new StringBuilder();
        for (int i = 0; i < asciiList.size(); i++) {
            asciiStrBuilder.append(asciiList.get(i));
            if (i < asciiList.size() - 1) {
                asciiStrBuilder.append(", ");
            }
        }

        String nowIso = Instant.now().toString();
        int payloadBytes = trimmed.getBytes(StandardCharsets.UTF_8).length;

        TelemetryData data = new TelemetryData();
        data.setId((partitionId != null ? partitionId : "1") + "-" + (sequenceNumber != null ? sequenceNumber : System.currentTimeMillis()));
        data.setStatus("connected");
        data.setRawData(trimmed);
        data.setAsciiValues(asciiList);
        data.setAsciiString(asciiStrBuilder.toString());
        data.setConvertedString(convertedString);
        data.setMessage(convertedString);
        data.setTimestamp(nowIso);
        data.setPartition(partitionId != null ? partitionId : "1");
        data.setSequenceNumber(sequenceNumber != null ? sequenceNumber : totalEvents.get() + 1);
        data.setOffset(offset != null ? offset : "0");
        data.setPayloadBytes(payloadBytes);
        data.setLatencyMs(4L);

        synchronized (latestTelemetry) {
            latestTelemetry.setId(data.getId());
            latestTelemetry.setStatus(data.getStatus());
            latestTelemetry.setRawData(data.getRawData());
            latestTelemetry.setAsciiValues(data.getAsciiValues());
            latestTelemetry.setAsciiString(data.getAsciiString());
            latestTelemetry.setConvertedString(data.getConvertedString());
            latestTelemetry.setMessage(data.getMessage());
            latestTelemetry.setTimestamp(data.getTimestamp());
            latestTelemetry.setPartition(data.getPartition());
            latestTelemetry.setSequenceNumber(data.getSequenceNumber());
            latestTelemetry.setOffset(data.getOffset());
            latestTelemetry.setPayloadBytes(data.getPayloadBytes());
            latestTelemetry.setLatencyMs(data.getLatencyMs());

            historyLog.addFirst(data);
            if (historyLog.size() > 100) {
                historyLog.removeLast();
            }

            totalEvents.incrementAndGet();
            totalBytes.addAndGet(payloadBytes);
        }

        System.out.println("[Spring Boot] Telemetry: '" + convertedString + "' | ASCII: " + data.getAsciiString());
        return data;
    }

    private void processEvent(String partitionId, EventData event) {
        if (event == null) return;
        String rawBody = event.getBodyAsString();
        processTelemetryPayload(rawBody, partitionId, event.getSequenceNumber(), String.valueOf(event.getOffset()));
    }

    public TelemetryData getLatest() {
        synchronized (latestTelemetry) {
            return latestTelemetry;
        }
    }

    public List<TelemetryData> getHistory(int limit) {
        List<TelemetryData> list = new ArrayList<>(historyLog);
        return list.subList(0, Math.min(limit, list.size()));
    }

    public Map<String, Object> getStats() {
        long uptime = Instant.now().getEpochSecond() - startTime.getEpochSecond();
        double rate = uptime > 0 ? (totalEvents.get() / (uptime / 60.0)) : 0.0;

        Map<String, Object> map = new HashMap<>();
        map.put("status", "online");
        map.put("service", "spring_boot_azure_iot_backend");
        map.put("uptime_seconds", uptime);
        map.put("total_events", totalEvents.get());
        map.put("total_bytes", totalBytes.get());
        map.put("events_per_minute", Math.round(rate * 100.0) / 100.0);
        map.put("history_count", historyLog.size());
        map.put("port", 8080);
        return map;
    }

    @PreDestroy
    public void cleanup() {
        if (asyncClient != null) {
            asyncClient.close();
        }
    }
}
