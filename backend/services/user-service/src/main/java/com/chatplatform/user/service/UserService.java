package com.chatplatform.user.service;

import com.chatplatform.user.dto.UserDto;
import com.chatplatform.user.model.User;
import com.chatplatform.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

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
        dto.setEmail(user.getEmail());
        dto.setStatus(user.getStatus());
        dto.setLastSeen(user.getLastSeen());
        dto.setProfilePicture(user.getProfilePicture());
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

    public List<UserDto> searchUsers(String query, String excludeUserId) {
        List<User> users = userRepository.searchUsers(query, excludeUserId);
        return users.stream().map(user -> {
            UserDto dto = new UserDto();
            dto.setId(user.getId());
            dto.setName(user.getName());
            dto.setPhone(user.getPhone());
            dto.setEmail(user.getEmail());
            dto.setStatus(user.getStatus());
            dto.setLastSeen(user.getLastSeen());
            dto.setProfilePicture(user.getProfilePicture());
            return dto;
        }).toList();
    }

    public UserDto updateUser(String userId, String name, String email, String profilePicture) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (name != null && !name.trim().isEmpty()) {
            user.setName(name.trim());
        }
        if (email != null) {
            user.setEmail(email.trim().isEmpty() ? null : email.trim());
        }
        if (profilePicture != null) {
            user.setProfilePicture(profilePicture.isEmpty() ? null : profilePicture);
        }

        user = userRepository.save(user);

        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setPhone(user.getPhone());
        dto.setEmail(user.getEmail());
        dto.setStatus(user.getStatus());
        dto.setLastSeen(user.getLastSeen());
        dto.setProfilePicture(user.getProfilePicture());
        return dto;
    }
}

