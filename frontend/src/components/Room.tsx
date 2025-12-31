import React, { useState } from 'react';
import './Room.css';
import VideoGrid from './VideoGrid';
import ChatPanel from './ChatPanel';
import ControlBar from './ControlBar';
import JoinRoom from './JoinRoom';
import ParticipantsList from './ParticipantsList';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { joinRoom, leaveRoom } from '../store/slices/roomSlice';
import { useWebRTC } from '../hooks/useWebRTC';

const Room: React.FC = () => {
  const dispatch = useAppDispatch();
  const { roomId, username, isJoined, isHost } = useAppSelector((state: any) => state.room);
  const [showParticipants, setShowParticipants] = useState(false);

  const {
    localStream,
    remoteStreams,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    sendMessage,
    messages,
    users,
    currentUserId,
    connectToRoom,
    disconnectFromRoom,
    isConnected,
    muteRemoteUser,
    kickUser,
    makeHost,
  } = useWebRTC();

  const handleJoinRoom = (room: string, name: string, isCreate: boolean) => {
    dispatch(joinRoom({ roomId: room, username: name, isHost: isCreate }));
    connectToRoom(room, name, isCreate);
  };

  const handleLeaveRoom = () => {
    disconnectFromRoom();
    dispatch(leaveRoom());
  };

  React.useEffect(() => {
    return () => {
      if (isJoined) {
        disconnectFromRoom();
      }
    };
  }, [isJoined, disconnectFromRoom]);

  if (!isJoined) {
    return <JoinRoom onJoin={handleJoinRoom} />;
  }

  return (
    <div className="room-container">
      <div className="room-header">
        <div className="room-info">
          <h2>会议室: {roomId}</h2>
          <span className="username">用户名: {username}</span>
          {isHost && <span className="host-badge">主持人</span>}
        </div>
        <div className="header-actions">
          <button
            className={`toggle-button ${showParticipants ? 'active' : ''}`}
            onClick={() => setShowParticipants(!showParticipants)}
            title={showParticipants ? '显示聊天' : '显示参会者'}
          >
            {showParticipants ? '💬' : '👥'}
          </button>
          <button className="leave-button" onClick={handleLeaveRoom}>
            离开会议室
          </button>
        </div>
      </div>

      <div className="room-content">
        <div className="video-section">
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            users={users}
          />
        </div>

        {showParticipants ? (
          <ParticipantsList
            users={users}
            currentUserId={currentUserId || ''}
            isHost={isHost}
            onMuteUser={muteRemoteUser}
            onKickUser={kickUser}
            onMakeHost={makeHost}
            localVideoEnabled={isVideoEnabled}
            localAudioEnabled={isAudioEnabled}
          />
        ) : (
          <ChatPanel
            messages={messages}
            onSendMessage={sendMessage}
            username={username}
          />
        )}
      </div>

      <ControlBar
        isVideoEnabled={isVideoEnabled}
        isAudioEnabled={isAudioEnabled}
        isScreenSharing={isScreenSharing}
        onToggleVideo={toggleVideo}
        onToggleAudio={toggleAudio}
        onToggleScreenShare={toggleScreenShare}
        isConnected={isConnected}
      />
    </div>
  );
};

export default Room;

