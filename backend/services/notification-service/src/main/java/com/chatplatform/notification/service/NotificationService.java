package com.chatplatform.notification.service;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.DeliverCallback;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.concurrent.TimeoutException;

@Service
public class NotificationService {

    @Value("${amqp.url:amqp://localhost}")
    private String amqpUrl;

    private Connection connection;
    private Channel channel;

    @PostConstruct
    public void init() {
        try {
            ConnectionFactory factory = new ConnectionFactory();
            factory.setUri(amqpUrl);
            connection = factory.newConnection();
            channel = connection.createChannel();

            // Declare exchange and queue
            channel.exchangeDeclare("chat_events", "topic", true);
            channel.queueDeclare("notification_queue", true, false, false, null);
            channel.queueBind("notification_queue", "chat_events", "message.sent");

            // Consume messages
            DeliverCallback deliverCallback = (consumerTag, delivery) -> {
                String message = new String(delivery.getBody(), "UTF-8");
                handleNotification(message);
                channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
            };

            channel.basicConsume("notification_queue", false, deliverCallback, consumerTag -> {});
            System.out.println("Notification service started");
        } catch (Exception e) {
            System.err.println("Failed to initialize notification service: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleNotification(String message) {
        // Parse event and send notification
        // In production, this would integrate with push notification services
        // (FCM, APNS, etc.) or email/SMS services
        System.out.println("Sending notification: " + message);
    }

    @PreDestroy
    public void cleanup() {
        try {
            if (channel != null) channel.close();
            if (connection != null) connection.close();
        } catch (IOException | TimeoutException e) {
            e.printStackTrace();
        }
    }
}

