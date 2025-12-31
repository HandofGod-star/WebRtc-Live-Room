package com.webrtc.liveroom.service;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoomService {
    // 房间ID -> 用户会话列表
    private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();
    
    // 会话ID -> 房间ID
    private final Map<String, String> sessionToRoom = new ConcurrentHashMap<>();
    
    // 会话ID -> 用户信息
    private final Map<String, UserInfo> sessionToUser = new ConcurrentHashMap<>();
    
    // 房间ID -> 主持人用户ID
    private final Map<String, String> roomHosts = new ConcurrentHashMap<>();

    public static class UserInfo {
        public String userId;
        public String username;
        
        public UserInfo(String userId, String username) {
            this.userId = userId;
            this.username = username;
        }
    }

    public void createRoom(String roomId, WebSocketSession session, String userId, String username) {
        Set<WebSocketSession> roomSessions = rooms.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet());
        
        roomHosts.put(roomId, userId);
        
        roomSessions.add(session);
        sessionToRoom.put(session.getId(), roomId);
        sessionToUser.put(session.getId(), new UserInfo(userId, username));
    }

    public void joinRoom(String roomId, WebSocketSession session, String userId, String username) {
        Set<WebSocketSession> roomSessions = rooms.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet());
        
        roomSessions.add(session);
        sessionToRoom.put(session.getId(), roomId);
        sessionToUser.put(session.getId(), new UserInfo(userId, username));
    }

    public void leaveRoom(WebSocketSession session) {
        String roomId = sessionToRoom.remove(session.getId());
        UserInfo userInfo = sessionToUser.remove(session.getId());
        
        if (roomId != null) {
            Set<WebSocketSession> roomSessions = rooms.get(roomId);
            if (roomSessions != null) {
                roomSessions.remove(session);
                
                if (userInfo != null && userInfo.userId.equals(roomHosts.get(roomId))) {
                    roomHosts.remove(roomId);
                    if (!roomSessions.isEmpty()) {
                        WebSocketSession firstSession = roomSessions.iterator().next();
                        UserInfo firstUser = sessionToUser.get(firstSession.getId());
                        if (firstUser != null) {
                            roomHosts.put(roomId, firstUser.userId);
                        }
                    }
                }
                
                if (roomSessions.isEmpty()) {
                    rooms.remove(roomId);
                    roomHosts.remove(roomId);
                }
            }
        }
    }
    
    public String getRoomHost(String roomId) {
        return roomHosts.get(roomId);
    }
    
    public boolean isRoomHost(String roomId, String userId) {
        String hostId = roomHosts.get(roomId);
        return hostId != null && hostId.equals(userId);
    }
    
    public void setRoomHost(String roomId, String userId) {
        roomHosts.put(roomId, userId);
    }

    public Set<WebSocketSession> getRoomSessions(String roomId) {
        return rooms.getOrDefault(roomId, Collections.emptySet());
    }

    public String getRoomId(WebSocketSession session) {
        return sessionToRoom.get(session.getId());
    }

    public UserInfo getUserInfo(WebSocketSession session) {
        return sessionToUser.get(session.getId());
    }

    public List<UserInfo> getRoomUsers(String roomId) {
        List<UserInfo> users = new ArrayList<>();
        Set<WebSocketSession> sessions = getRoomSessions(roomId);
        for (WebSocketSession session : sessions) {
            UserInfo userInfo = sessionToUser.get(session.getId());
            if (userInfo != null) {
                users.add(userInfo);
            }
        }
        return users;
    }
    
    public List<UserInfo> getRoomUsersExcluding(String roomId, String excludeUserId) {
        List<UserInfo> users = new ArrayList<>();
        Set<WebSocketSession> sessions = getRoomSessions(roomId);
        for (WebSocketSession session : sessions) {
            UserInfo userInfo = sessionToUser.get(session.getId());
            if (userInfo != null && !userInfo.userId.equals(excludeUserId)) {
                users.add(userInfo);
            }
        }
        return users;
    }
}



