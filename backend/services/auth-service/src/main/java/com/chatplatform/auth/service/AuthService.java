package com.chatplatform.auth.service;

import com.chatplatform.auth.dto.AuthResponse;
import com.chatplatform.auth.model.User;
import com.chatplatform.auth.repository.UserRepository;
import com.chatplatform.auth.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    public AuthResponse signup(String name, String phone, String password) {
        // Check if user exists
        if (userRepository.findByPhone(phone).isPresent()) {
            throw new RuntimeException("User already exists");
        }

        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setName(name);
        user.setPhone(phone);
        user.setPassword(passwordEncoder.encode(password));
        user.setStatus("offline");

        user = userRepository.save(user);

        String token = jwtUtil.generateToken(user.getId());

        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setUser(toDto(user));
        return response;
    }

    public AuthResponse login(String phone, String password) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        // Update status to online
        user.setStatus("online");
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getId());

        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setUser(toDto(user));
        return response;
    }

    private com.chatplatform.auth.dto.User toDto(User user) {
        com.chatplatform.auth.dto.User dto = new com.chatplatform.auth.dto.User();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setPhone(user.getPhone());
        dto.setStatus(user.getStatus());
        dto.setLastSeen(user.getLastSeen());
        return dto;
    }
}

