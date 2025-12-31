export interface User {
  userId: string;
  username: string;
  isHost?: boolean;
  isVideoEnabled?: boolean;
  isAudioEnabled?: boolean;
  isScreenSharing?: boolean;
  connectionQuality?: 'good' | 'medium' | 'poor';
}

export interface ChatMessage {
  username: string;
  content: string;
  time: string;
  isOwn: boolean;
}

// WebRTCState 现在在 webrtcSlice.ts 中定义

export interface RoomState {
  roomId: string;
  username: string;
  isJoined: boolean;
  isHost: boolean;
  hostId: string | null;
}

export interface RootState {
  webrtc: import('../store/slices/webrtcSlice').WebRTCState;
  room: RoomState;
}

export interface Message {
  type: string;
  from?: string;
  to?: string;
  roomId?: string;
  data?: any;
  content?: string;
  username?: string;
}

