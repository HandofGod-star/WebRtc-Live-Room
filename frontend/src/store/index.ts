import { configureStore } from '@reduxjs/toolkit';
import webrtcReducer from './slices/webrtcSlice';
import roomReducer from './slices/roomSlice';

export const store = configureStore({
  reducer: {
    webrtc: webrtcReducer,
    room: roomReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

