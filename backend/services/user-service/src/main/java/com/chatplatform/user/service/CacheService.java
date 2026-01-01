package com.chatplatform.user.service;

import com.chatplatform.user.dto.UserDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class CacheService {

    private static final String USER_CACHE_PREFIX = "user:";
    private static final int USER_CACHE_TTL_MINUTES = 5;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public UserDto getUserFromCache(String userId) {
        try {
            String key = USER_CACHE_PREFIX + userId;
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                if (cached instanceof UserDto) {
                    return (UserDto) cached;
                } else if (cached instanceof String) {
                    return objectMapper.readValue((String) cached, UserDto.class);
                }
            }
        } catch (Exception e) {
            // Log error but don't fail - cache is optional
            System.err.println("Error reading from cache: " + e.getMessage());
        }
        return null;
    }

    public void cacheUser(String userId, UserDto user) {
        try {
            String key = USER_CACHE_PREFIX + userId;
            redisTemplate.opsForValue().set(key, user, USER_CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            // Log error but don't fail - cache is optional
            System.err.println("Error writing to cache: " + e.getMessage());
        }
    }

    public void evictUser(String userId) {
        try {
            String key = USER_CACHE_PREFIX + userId;
            redisTemplate.delete(key);
        } catch (Exception e) {
            // Log error but don't fail - cache is optional
            System.err.println("Error evicting from cache: " + e.getMessage());
        }
    }
}

