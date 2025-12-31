import React, { useState } from 'react';
import './JoinRoom.css';

interface JoinRoomProps {
  onJoin: (room: string, name: string, isCreate: boolean) => void;
}

const JoinRoom: React.FC<JoinRoomProps> = ({ onJoin }) => {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isCreateMode, setIsCreateMode] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim() && username.trim()) {
      onJoin(roomId.trim(), username.trim(), isCreateMode);
    }
  };

  return (
    <div className="join-room-container">
      <div className="join-room-card">
        <h1>WebRTC 会议室</h1>
        <div className="mode-selector">
          <button
            className={`mode-button ${isCreateMode ? 'active' : ''}`}
            onClick={() => setIsCreateMode(true)}
          >
            🏠 创建房间
          </button>
          <button
            className={`mode-button ${!isCreateMode ? 'active' : ''}`}
            onClick={() => setIsCreateMode(false)}
          >
            🚪 加入房间
          </button>
        </div>
        <form onSubmit={handleSubmit} className="join-room-form">
          <div className="form-group">
            <label htmlFor="roomId">
              {isCreateMode ? '房间ID（将创建新房间）' : '房间ID'}
            </label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="请输入房间ID"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入您的用户名"
              required
            />
          </div>
          {isCreateMode && (
            <div className="info-text">
              💡 提示：创建房间后，您将成为主持人，可以管理参会者
            </div>
          )}
          <button type="submit" className="join-button">
            {isCreateMode ? '创建并进入房间' : '加入房间'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinRoom;
