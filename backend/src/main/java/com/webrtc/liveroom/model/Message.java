package com.webrtc.liveroom.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Message {
    private String type; // offer, answer, ice-candidate, join, leave, chat, toggle-video, toggle-audio
    private String from; // 发送者ID
    private String to;   // 接收者ID (null表示广播)
    private String roomId; // 房间ID
    private Object data;   // 消息数据 (offer/answer/candidate等)
    private String content; // 聊天内容
    private String username; // 用户名
}

