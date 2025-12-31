import React from 'react';
import './ParticipantsList.css';
import { User } from '../types';

interface ParticipantsListProps {
  users: User[];
  currentUserId: string | null;
  isHost: boolean;
  onMuteUser?: (userId: string) => void;
  onKickUser?: (userId: string) => void;
  onMakeHost?: (userId: string) => void;
  localVideoEnabled?: boolean;
  localAudioEnabled?: boolean;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({
  users,
  currentUserId,
  isHost,
  onMuteUser,
  onKickUser,
  onMakeHost,
  localVideoEnabled = true,
  localAudioEnabled = true,
}) => {
  return (
    <div className="participants-list">
      <div className="participants-header">
        <h3>参会者 ({users.length + 1})</h3>
      </div>
      <div className="participants-content">
        <div className="participant-item current-user">
          <div className="participant-info">
            <span className="participant-name">我</span>
            {isHost && <span className="participant-badge host">主持人</span>}
          </div>
          <div className="participant-status">
            <span className={`status-icon video ${localVideoEnabled ? 'enabled' : 'disabled'}`}>📹</span>
            <span className={`status-icon audio ${localAudioEnabled ? 'enabled' : 'disabled'}`}>🎤</span>
          </div>
        </div>

        {users.map((user) => (
          <div key={user.userId} className="participant-item">
            <div className="participant-info">
              <span className="participant-name">{user.username}</span>
              {user.isHost && <span className="participant-badge host">主持人</span>}
            </div>
            <div className="participant-status">
              <span className={`status-icon video ${user.isVideoEnabled !== false ? 'enabled' : 'disabled'}`}>
                📹
              </span>
              <span className={`status-icon audio ${user.isAudioEnabled !== false ? 'enabled' : 'disabled'}`}>
                🎤
              </span>
              {user.connectionQuality && (
                <span className={`connection-quality ${user.connectionQuality}`}>
                  {user.connectionQuality === 'good' ? '●' : user.connectionQuality === 'medium' ? '◐' : '○'}
                </span>
              )}
            </div>
            {isHost && user.userId !== currentUserId && (
              <div className="participant-actions">
                {onMuteUser && (
                  <button
                    className="action-button mute"
                    onClick={() => {
                      onMuteUser(user.userId);
                    }}
                    title="静音"
                  >
                    🔇
                  </button>
                )}
                {onMakeHost && !user.isHost && (
                  <button
                    className="action-button host"
                    onClick={() => {
                      onMakeHost(user.userId);
                    }}
                    title="设为主持人"
                  >
                    👑
                  </button>
                )}
                {onKickUser && (
                  <button
                    className="action-button kick"
                    onClick={() => {
                      onKickUser(user.userId);
                    }}
                    title="移出会议"
                  >
                    🚪
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParticipantsList;

