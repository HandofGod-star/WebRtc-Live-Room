import React from 'react';
import './ControlBar.css';

interface ControlBarProps {
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  isConnected: boolean;
}

const ControlBar: React.FC<ControlBarProps> = ({
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  isConnected,
}) => {
  return (
    <div className="control-bar">
      <div className="control-status">
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● 已连接' : '○ 未连接'}
        </span>
      </div>

      <div className="control-buttons">
        <button
          className={`control-button ${isAudioEnabled ? 'enabled' : 'disabled'}`}
          onClick={onToggleAudio}
          title={isAudioEnabled ? '关闭麦克风' : '开启麦克风'}
        >
          {isAudioEnabled ? '🎤' : '🎤🚫'}
        </button>

        <button
          className={`control-button ${isVideoEnabled ? 'enabled' : 'disabled'}`}
          onClick={onToggleVideo}
          title={isVideoEnabled ? '关闭摄像头' : '开启摄像头'}
        >
          {isVideoEnabled ? '📹' : '📹🚫'}
        </button>

        <button
          className={`control-button ${isScreenSharing ? 'enabled' : 'disabled'}`}
          onClick={onToggleScreenShare}
          title={isScreenSharing ? '停止共享' : '共享屏幕'}
        >
          {isScreenSharing ? '🖥️' : '🖥️'}
        </button>
      </div>
    </div>
  );
};

export default ControlBar;

