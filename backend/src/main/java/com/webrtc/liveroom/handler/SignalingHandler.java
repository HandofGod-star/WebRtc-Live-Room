package com.webrtc.liveroom.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.liveroom.model.Message;
import com.webrtc.liveroom.service.RoomService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.*;
import java.util.UUID;

@Slf4j
@Component
public class SignalingHandler extends TextWebSocketHandler {

    @Autowired
    private RoomService roomService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket连接建立: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            Message msg = objectMapper.readValue(message.getPayload(), Message.class);
            log.info("收到消息: type={}, from={}, roomId={}", msg.getType(), msg.getFrom(), msg.getRoomId());

            switch (msg.getType()) {
                case "create-room":
                    handleCreateRoom(session, msg);
                    break;
                case "join":
                    handleJoin(session, msg);
                    break;
                case "offer":
                case "answer":
                case "ice-candidate":
                    handleWebRTCSignal(session, msg);
                    break;
                case "chat":
                    handleChat(session, msg);
                    break;
                case "toggle-video":
                case "toggle-audio":
                    handleToggle(session, msg);
                    break;
                case "mute-user":
                    handleMuteUser(session, msg);
                    break;
                case "kick-user":
                    handleKickUser(session, msg);
                    break;
                case "make-host":
                    handleMakeHost(session, msg);
                    break;
                default:
                    log.warn("未知消息类型: {}", msg.getType());
            }
        } catch (Exception e) {
            log.error("处理消息时发生错误", e);
        }
    }

    private void handleCreateRoom(WebSocketSession session, Message msg) throws Exception {
        String userId = msg.getFrom() != null ? msg.getFrom() : UUID.randomUUID().toString();
        String username = msg.getUsername() != null ? msg.getUsername() : "用户" + userId.substring(0, 8);
        String roomId = msg.getRoomId();

        roomService.createRoom(roomId, session, userId, username);
        
        // 通知房间内其他用户有新用户加入
        Message joinMessage = new Message();
        joinMessage.setType("user-joined");
        joinMessage.setFrom(userId);
        joinMessage.setRoomId(roomId);
        joinMessage.setUsername(username);
        broadcastToRoom(roomId, session, joinMessage);

        // 向创建者发送房间内现有用户列表（应该为空，因为创建者是第一个）
        Message usersListMessage = new Message();
        usersListMessage.setType("users-list");
        usersListMessage.setRoomId(roomId);
        usersListMessage.setData(roomService.getRoomUsersExcluding(roomId, userId));
        sendToSession(session, usersListMessage);

        // 通知创建者连接成功，包含主持人信息
        Message joinSuccessMessage = new Message();
        joinSuccessMessage.setType("join-success");
        joinSuccessMessage.setFrom(userId);
        joinSuccessMessage.setRoomId(roomId);
        joinSuccessMessage.setUsername(username);
        Map<String, Object> data = new HashMap<>();
        data.put("isHost", true);
        data.put("hostId", userId);
        joinSuccessMessage.setData(data);
        sendToSession(session, joinSuccessMessage);
    }

    private void handleJoin(WebSocketSession session, Message msg) throws Exception {
        String userId = msg.getFrom() != null ? msg.getFrom() : UUID.randomUUID().toString();
        String username = msg.getUsername() != null ? msg.getUsername() : "用户" + userId.substring(0, 8);
        String roomId = msg.getRoomId();

        roomService.joinRoom(roomId, session, userId, username);

        // 通知房间内其他用户有新用户加入
        Message joinMessage = new Message();
        joinMessage.setType("user-joined");
        joinMessage.setFrom(userId);
        joinMessage.setRoomId(roomId);
        joinMessage.setUsername(username);
        broadcastToRoom(roomId, session, joinMessage);

        // 检查是否是主持人
        boolean isHost = roomService.isRoomHost(roomId, userId);
        
        // 向新加入的用户发送房间内现有用户列表（排除自己）
        Message usersListMessage = new Message();
        usersListMessage.setType("users-list");
        usersListMessage.setRoomId(roomId);
        usersListMessage.setData(roomService.getRoomUsersExcluding(roomId, userId));
        sendToSession(session, usersListMessage);

        // 通知新用户连接成功，包含主持人信息
        Message joinSuccessMessage = new Message();
        joinSuccessMessage.setType("join-success");
        joinSuccessMessage.setFrom(userId);
        joinSuccessMessage.setRoomId(roomId);
        joinSuccessMessage.setUsername(username);
        Map<String, Object> data = new HashMap<>();
        data.put("isHost", isHost);
        data.put("hostId", roomService.getRoomHost(roomId));
        joinSuccessMessage.setData(data);
        sendToSession(session, joinSuccessMessage);
        
        // 通知房间内所有用户更新主持人信息
        Message hostUpdateMessage = new Message();
        hostUpdateMessage.setType("host-updated");
        hostUpdateMessage.setRoomId(roomId);
        Map<String, Object> hostData = new HashMap<>();
        hostData.put("hostId", roomService.getRoomHost(roomId));
        hostUpdateMessage.setData(hostData);
        broadcastToRoom(roomId, null, hostUpdateMessage);
    }

    private void handleWebRTCSignal(WebSocketSession session, Message msg) throws Exception {
        String roomId = roomService.getRoomId(session);
        if (roomId == null) {
            return;
        }

        // 转发WebRTC信令消息
        if (msg.getTo() != null) {
            // 点对点消息
            Set<WebSocketSession> roomSessions = roomService.getRoomSessions(roomId);
            for (WebSocketSession targetSession : roomSessions) {
                RoomService.UserInfo userInfo = roomService.getUserInfo(targetSession);
                if (userInfo != null && userInfo.userId.equals(msg.getTo())) {
                    sendToSession(targetSession, msg);
                    break;
                }
            }
        } else {
            // 广播消息
            broadcastToRoom(roomId, session, msg);
        }
    }

    private void handleChat(WebSocketSession session, Message msg) throws Exception {
        String roomId = roomService.getRoomId(session);
        if (roomId == null) {
            return;
        }

        RoomService.UserInfo userInfo = roomService.getUserInfo(session);
        if (userInfo != null) {
            msg.setFrom(userInfo.userId);
            msg.setUsername(userInfo.username);
        }

        broadcastToRoom(roomId, session, msg);
    }

    private void handleToggle(WebSocketSession session, Message msg) throws Exception {
        String roomId = roomService.getRoomId(session);
        if (roomId == null) {
            return;
        }

        RoomService.UserInfo userInfo = roomService.getUserInfo(session);
        if (userInfo != null) {
            msg.setFrom(userInfo.userId);
            msg.setUsername(userInfo.username);
        }

        broadcastToRoom(roomId, session, msg);
    }

    private void broadcastToRoom(String roomId, WebSocketSession excludeSession, Message message) throws Exception {
        Set<WebSocketSession> sessions = roomService.getRoomSessions(roomId);
        for (WebSocketSession session : sessions) {
            if ((excludeSession == null || !session.equals(excludeSession)) && session.isOpen()) {
                sendToSession(session, message);
            }
        }
    }
    
    private void handleMuteUser(WebSocketSession session, Message msg) throws Exception {
        String roomId = roomService.getRoomId(session);
        RoomService.UserInfo userInfo = roomService.getUserInfo(session);
        if (roomId == null || userInfo == null) {
            return;
        }
        
        // 检查是否是主持人
        if (!roomService.isRoomHost(roomId, userInfo.userId)) {
            log.warn("非主持人尝试静音用户: {}", userInfo.userId);
            return;
        }
        
        // 转发静音消息给目标用户
        if (msg.getTo() != null) {
            Set<WebSocketSession> roomSessions = roomService.getRoomSessions(roomId);
            for (WebSocketSession targetSession : roomSessions) {
                RoomService.UserInfo targetUserInfo = roomService.getUserInfo(targetSession);
                if (targetUserInfo != null && targetUserInfo.userId.equals(msg.getTo())) {
                    msg.setFrom(userInfo.userId);
                    sendToSession(targetSession, msg);
                    
                    // 通知房间内所有用户该用户被静音（更新状态显示）
                    Message statusUpdateMessage = new Message();
                    statusUpdateMessage.setType("user-muted");
                    statusUpdateMessage.setFrom(targetUserInfo.userId);
                    statusUpdateMessage.setRoomId(roomId);
                    statusUpdateMessage.setUsername(targetUserInfo.username);
                    Map<String, Object> data = new HashMap<>();
                    data.put("audioEnabled", false);
                    statusUpdateMessage.setData(data);
                    broadcastToRoom(roomId, null, statusUpdateMessage);
                    break;
                }
            }
        }
    }
    
    private void handleKickUser(WebSocketSession session, Message msg) throws Exception {
        String roomId = roomService.getRoomId(session);
        RoomService.UserInfo userInfo = roomService.getUserInfo(session);
        if (roomId == null || userInfo == null) {
            return;
        }
        
        // 检查是否是主持人
        if (!roomService.isRoomHost(roomId, userInfo.userId)) {
            log.warn("非主持人尝试踢出用户: {}", userInfo.userId);
            return;
        }
        
        // 发送踢出消息给目标用户
        if (msg.getTo() != null) {
            Set<WebSocketSession> roomSessions = roomService.getRoomSessions(roomId);
            for (WebSocketSession targetSession : roomSessions) {
                RoomService.UserInfo targetUserInfo = roomService.getUserInfo(targetSession);
                if (targetUserInfo != null && targetUserInfo.userId.equals(msg.getTo())) {
                    msg.setFrom(userInfo.userId);
                    sendToSession(targetSession, msg);
                    // 关闭目标用户的连接
                    targetSession.close();
                    break;
                }
            }
        }
    }
    
    private void handleMakeHost(WebSocketSession session, Message msg) throws Exception {
        String roomId = roomService.getRoomId(session);
        RoomService.UserInfo userInfo = roomService.getUserInfo(session);
        if (roomId == null || userInfo == null) {
            return;
        }
        
        // 检查是否是主持人
        if (!roomService.isRoomHost(roomId, userInfo.userId)) {
            log.warn("非主持人尝试设置主持人: {}", userInfo.userId);
            return;
        }
        
        // 设置新的主持人
        if (msg.getTo() != null) {
            roomService.setRoomHost(roomId, msg.getTo());
            
            // 通知所有用户主持人变更
            Message hostUpdateMessage = new Message();
            hostUpdateMessage.setType("host-updated");
            hostUpdateMessage.setRoomId(roomId);
            Map<String, Object> data = new HashMap<>();
            data.put("hostId", msg.getTo());
            hostUpdateMessage.setData(data);
            broadcastToRoom(roomId, null, hostUpdateMessage);
        }
    }

    private void sendToSession(WebSocketSession session, Message message) throws Exception {
        if (session.isOpen()) {
            String json = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(json));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String roomId = roomService.getRoomId(session);
        RoomService.UserInfo userInfo = roomService.getUserInfo(session);

        if (roomId != null && userInfo != null) {
            // 通知房间内其他用户有用户离开
            Message leaveMessage = new Message();
            leaveMessage.setType("user-left");
            leaveMessage.setFrom(userInfo.userId);
            leaveMessage.setRoomId(roomId);
            leaveMessage.setUsername(userInfo.username);

            Set<WebSocketSession> sessions = roomService.getRoomSessions(roomId);
            for (WebSocketSession s : sessions) {
                if (!s.equals(session) && s.isOpen()) {
                    sendToSession(s, leaveMessage);
                }
            }
        }

        roomService.leaveRoom(session);
        log.info("WebSocket连接关闭: {}", session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("WebSocket传输错误: {}", session.getId(), exception);
        roomService.leaveRoom(session);
    }
}

