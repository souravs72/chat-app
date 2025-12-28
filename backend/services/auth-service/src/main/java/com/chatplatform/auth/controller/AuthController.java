package com.chatplatform.auth.controller;

import com.chatplatform.auth.dto.AuthRequest;
import com.chatplatform.auth.dto.AuthResponse;
import com.chatplatform.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody AuthRequest request) {
        AuthResponse response = authService.signup(request.getName(), request.getPhone(), request.getPassword());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        AuthResponse response = authService.login(request.getPhone(), request.getPassword());
        return ResponseEntity.ok(response);
    }

}

