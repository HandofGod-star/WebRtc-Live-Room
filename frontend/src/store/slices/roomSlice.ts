import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RoomState } from '../../types';

const initialState: RoomState = {
  roomId: '',
  username: '',
  isJoined: false,
  isHost: false,
  hostId: null,
};

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    joinRoom: (state: RoomState, action: PayloadAction<{ roomId: string; username: string; isHost?: boolean; hostId?: string }>) => {
      state.roomId = action.payload.roomId;
      state.username = action.payload.username;
      state.isJoined = true;
      state.isHost = action.payload.isHost || false;
      state.hostId = action.payload.hostId || null;
    },
    leaveRoom: (state: RoomState) => {
      state.roomId = '';
      state.username = '';
      state.isJoined = false;
      state.isHost = false;
      state.hostId = null;
    },
    setHost: (state: RoomState, action: PayloadAction<{ hostId: string; isHost: boolean }>) => {
      state.hostId = action.payload.hostId;
      state.isHost = action.payload.isHost;
    },
  },
});

export const { joinRoom, leaveRoom, setHost } = roomSlice.actions;
export default roomSlice.reducer;

