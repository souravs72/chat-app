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

    @Autowired
    private CacheService cacheService;

    public UserDto getUser(String userId) {
        // Try to get from cache first
        UserDto cached = cacheService.getUserFromCache(userId);
        if (cached != null) {
            return cached;
        }

        // Cache miss - fetch from database
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

        // Cache the result
        cacheService.cacheUser(userId, dto);

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

        // Evict cache on update
        cacheService.evictUser(userId);
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

        // Update cache with new data
        cacheService.cacheUser(userId, dto);

        return dto;
    }
}

