package com.chatplatform.auth.service;

import com.chatplatform.auth.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class CacheService {

    private static final String USER_BY_PHONE_CACHE_PREFIX = "auth:user:phone:";
    private static final int USER_CACHE_TTL_MINUTES = 5;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    /**
     * Get user by phone from cache
     * @param phone - Phone number
     * @return User if found in cache, null otherwise
     */
    @SuppressWarnings("unchecked")
    public User getUserByPhoneFromCache(String phone) {
        try {
            String key = USER_BY_PHONE_CACHE_PREFIX + phone;
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null && cached instanceof User) {
                return (User) cached;
            }
        } catch (Exception e) {
            // Log error but don't fail - cache is optional
            System.err.println("Error reading from cache: " + e.getMessage());
        }
        return null;
    }

    /**
     * Cache user by phone number
     * @param phone - Phone number
     * @param user - User entity
     */
    public void cacheUserByPhone(String phone, User user) {
        try {
            String key = USER_BY_PHONE_CACHE_PREFIX + phone;
            redisTemplate.opsForValue().set(key, user, USER_CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            // Log error but don't fail - cache is optional
            System.err.println("Error writing to cache: " + e.getMessage());
        }
    }

    /**
     * Evict user from cache by phone
     * @param phone - Phone number
     */
    public void evictUserByPhone(String phone) {
        try {
            String key = USER_BY_PHONE_CACHE_PREFIX + phone;
            redisTemplate.delete(key);
        } catch (Exception e) {
            // Log error but don't fail - cache is optional
            System.err.println("Error evicting from cache: " + e.getMessage());
        }
    }
}

