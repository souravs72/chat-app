package com.chatplatform.user.repository;

import com.chatplatform.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRepository extends JpaRepository<User, String> {
    @Query("SELECT u FROM User u WHERE u.id != :excludeUserId AND (LOWER(u.name) LIKE LOWER(CONCAT('%', :query, '%')) OR u.phone LIKE CONCAT('%', :query, '%') OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<User> searchUsers(@Param("query") String query, @Param("excludeUserId") String excludeUserId);
}

