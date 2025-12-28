package com.chatplatform.user.service;

import com.chatplatform.user.dto.UserDto;
import com.chatplatform.user.model.User;
import com.chatplatform.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public UserDto getUser(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setPhone(user.getPhone());
        dto.setStatus(user.getStatus());
        dto.setLastSeen(user.getLastSeen());
        return dto;
    }

    public void updateStatus(String userId, String status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setStatus(status);
        if ("offline".equals(status)) {
            user.setLastSeen(LocalDateTime.now());
        }
        userRepository.save(user);
    }
}

