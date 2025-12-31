import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, ChatMessage } from '../../types';

export interface WebRTCState {
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  isConnected: boolean;
  messages: ChatMessage[];
  users: User[];
  remoteStreamIds: string[]; // 存储远程流的用户ID列表
}

const initialState: WebRTCState = {
  isVideoEnabled: true,
  isAudioEnabled: true,
  isScreenSharing: false,
  isConnected: false,
  messages: [],
  users: [],
  remoteStreamIds: [],
};

const webrtcSlice = createSlice({
  name: 'webrtc',
  initialState,
  reducers: {
    setVideoEnabled: (state: WebRTCState, action: PayloadAction<boolean>) => {
      state.isVideoEnabled = action.payload;
    },
    setAudioEnabled: (state: WebRTCState, action: PayloadAction<boolean>) => {
      state.isAudioEnabled = action.payload;
    },
    setScreenSharing: (state: WebRTCState, action: PayloadAction<boolean>) => {
      state.isScreenSharing = action.payload;
    },
    setConnected: (state: WebRTCState, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    addMessage: (state: WebRTCState, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    clearMessages: (state: WebRTCState) => {
      state.messages = [];
    },
    setUsers: (state: WebRTCState, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    addUser: (state: WebRTCState, action: PayloadAction<User>) => {
      if (!state.users.find((u: User) => u.userId === action.payload.userId)) {
        state.users.push(action.payload);
      }
    },
    removeUser: (state: WebRTCState, action: PayloadAction<string>) => {
      state.users = state.users.filter((u: User) => u.userId !== action.payload);
      state.remoteStreamIds = state.remoteStreamIds.filter((id: string) => id !== action.payload);
    },
    updateUser: (state: WebRTCState, action: PayloadAction<Partial<User> & { userId: string }>) => {
      const index = state.users.findIndex((u: User) => u.userId === action.payload.userId);
      if (index !== -1) {
        state.users[index] = { ...state.users[index], ...action.payload };
      }
    },
    addRemoteStreamId: (state: WebRTCState, action: PayloadAction<string>) => {
      if (!state.remoteStreamIds.includes(action.payload)) {
        state.remoteStreamIds.push(action.payload);
      }
    },
    removeRemoteStreamId: (state: WebRTCState, action: PayloadAction<string>) => {
      state.remoteStreamIds = state.remoteStreamIds.filter((id: string) => id !== action.payload);
    },
    clearRemoteStreamIds: (state: WebRTCState) => {
      state.remoteStreamIds = [];
    },
    reset: () => initialState,
  },
});

export const {
  setVideoEnabled,
  setAudioEnabled,
  setScreenSharing,
  setConnected,
  addMessage,
  clearMessages,
  setUsers,
  addUser,
  removeUser,
  updateUser,
  addRemoteStreamId,
  removeRemoteStreamId,
  clearRemoteStreamIds,
  reset,
} = webrtcSlice.actions;
export default webrtcSlice.reducer;
