package com.azureweb.iot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AzureIoTApplication {

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println(" Starting Azure IoT Hub Telemetry Spring Boot    ");
        System.out.println(" Student: Aakash K | Roll No: 24EIR002           ");
        System.out.println(" Kongu Engineering College - EIE                 ");
        System.out.println(" Listening on http://0.0.0.0:8080                ");
        System.out.println("=================================================");
        SpringApplication.run(AzureIoTApplication.class, args);
    }
}
