package com.chatplatform.user.controller;

import com.chatplatform.user.dto.UserDto;
import com.chatplatform.user.service.UserService;
import com.chatplatform.user.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    @GetMapping("/me")
    public ResponseEntity<UserDto> getCurrentUser(HttpServletRequest request) {
        String userId = getUserIdFromRequest(request);
        UserDto user = userService.getUser(userId);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/{userId}")
    public ResponseEntity<UserDto> getUser(@PathVariable String userId) {
        UserDto user = userService.getUser(userId);
        return ResponseEntity.ok(user);
    }

    @PatchMapping("/me/status")
    public ResponseEntity<Void> updateStatus(
            @RequestBody StatusUpdateRequest request,
            HttpServletRequest httpRequest) {
        String userId = getUserIdFromRequest(httpRequest);
        userService.updateStatus(userId, request.getStatus());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserDto>> searchUsers(
            @RequestParam String q,
            HttpServletRequest httpRequest) {
        String userId = getUserIdFromRequest(httpRequest);
        List<UserDto> users = userService.searchUsers(q, userId);
        return ResponseEntity.ok(users);
    }

    @PatchMapping("/me")
    public ResponseEntity<UserDto> updateProfile(
            @RequestBody UpdateProfileRequest request,
            HttpServletRequest httpRequest) {
        String userId = getUserIdFromRequest(httpRequest);
        UserDto user = userService.updateUser(userId, request.getName(), request.getEmail());
        return ResponseEntity.ok(user);
    }

    private String getUserIdFromRequest(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            return jwtUtil.getUserIdFromToken(token);
        }
        return null;
    }

    static class StatusUpdateRequest {
        private String status;
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    static class UpdateProfileRequest {
        private String name;
        private String email;
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
    }
}

