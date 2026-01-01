package com.chatplatform.auth.service;

import com.chatplatform.auth.dto.AuthResponse;
import com.chatplatform.auth.model.User;
import com.chatplatform.auth.repository.UserRepository;
import com.chatplatform.auth.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private CacheService cacheService;

    public AuthResponse signup(String name, String phone, String password, String email) {
        // Check if user exists (try cache first, then database)
        Optional<User> existingUser = findUserByPhone(phone);
        if (existingUser.isPresent()) {
            throw new RuntimeException("User already exists");
        }

        User user = new User();
        user.setId(UUID.randomUUID().toString());
        user.setName(name);
        user.setPhone(phone);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setStatus("offline");

        user = userRepository.save(user);

        // Cache the newly created user
        cacheService.cacheUserByPhone(phone, user);

        String token = jwtUtil.generateToken(user.getId());

        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setUser(toDto(user));
        return response;
    }

    public AuthResponse login(String phone, String password) {
        // Try cache first, then database
        User user = findUserByPhone(phone)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        // Update status to online
        user.setStatus("online");
        user = userRepository.save(user);

        // Update cache with new status
        cacheService.cacheUserByPhone(phone, user);

        String token = jwtUtil.generateToken(user.getId());

        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setUser(toDto(user));
        return response;
    }

    /**
     * Find user by phone, checking cache first, then database
     * @param phone - Phone number
     * @return Optional<User>
     */
    private Optional<User> findUserByPhone(String phone) {
        // Try cache first
        User cached = cacheService.getUserByPhoneFromCache(phone);
        if (cached != null) {
            return Optional.of(cached);
        }

        // Cache miss - fetch from database
        Optional<User> user = userRepository.findByPhone(phone);
        if (user.isPresent()) {
            // Cache the result
            cacheService.cacheUserByPhone(phone, user.get());
        }
        return user;
    }

    private com.chatplatform.auth.dto.User toDto(User user) {
        com.chatplatform.auth.dto.User dto = new com.chatplatform.auth.dto.User();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setPhone(user.getPhone());
        dto.setEmail(user.getEmail());
        dto.setStatus(user.getStatus());
        dto.setLastSeen(user.getLastSeen());
        return dto;
    }
}

