package com.azureweb.iot.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class TelemetryData {

    @JsonProperty("student_name")
    private String studentName = "Aakash K";

    @JsonProperty("roll_no")
    private String rollNo = "24EIR002";

    @JsonProperty("department")
    private String department = "Electronics & Instrumentation Engineering";

    @JsonProperty("college")
    private String college = "Kongu Engineering College";

    @JsonProperty("id")
    private String id;

    @JsonProperty("status")
    private String status = "connected";

    @JsonProperty("raw_data")
    private String rawData;

    @JsonProperty("ascii_values")
    private List<Integer> asciiValues;

    @JsonProperty("ascii_string")
    private String asciiString;

    @JsonProperty("converted_string")
    private String convertedString;

    @JsonProperty("message")
    private String message;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("partition")
    private String partition;

    @JsonProperty("sequence_number")
    private Long sequenceNumber;

    @JsonProperty("offset")
    private String offset;

    @JsonProperty("payload_bytes")
    private Integer payloadBytes;

    @JsonProperty("latency_ms")
    private Long latencyMs;

    public TelemetryData() {}

    // Getters and Setters
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getRollNo() { return rollNo; }
    public void setRollNo(String rollNo) { this.rollNo = rollNo; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getCollege() { return college; }
    public void setCollege(String college) { this.college = college; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRawData() { return rawData; }
    public void setRawData(String rawData) { this.rawData = rawData; }

    public List<Integer> getAsciiValues() { return asciiValues; }
    public void setAsciiValues(List<Integer> asciiValues) { this.asciiValues = asciiValues; }

    public String getAsciiString() { return asciiString; }
    public void setAsciiString(String asciiString) { this.asciiString = asciiString; }

    public String getConvertedString() { return convertedString; }
    public void setConvertedString(String convertedString) { this.convertedString = convertedString; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public String getPartition() { return partition; }
    public void setPartition(String partition) { this.partition = partition; }

    public Long getSequenceNumber() { return sequenceNumber; }
    public void setSequenceNumber(Long sequenceNumber) { this.sequenceNumber = sequenceNumber; }

    public String getOffset() { return offset; }
    public void setOffset(String offset) { this.offset = offset; }

    public Integer getPayloadBytes() { return payloadBytes; }
    public void setPayloadBytes(Integer payloadBytes) { this.payloadBytes = payloadBytes; }

    public Long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }
}
