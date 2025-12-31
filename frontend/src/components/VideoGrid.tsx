import React, { useRef, useEffect } from 'react';
import './VideoGrid.css';
import { User } from '../types';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  users: User[];
}

const VideoGrid: React.FC<VideoGridProps> = ({ localStream, remoteStreams, users }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<{ [key: string]: React.RefObject<HTMLVideoElement> }>({});

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    remoteStreams.forEach((stream, userId) => {
      if (!remoteVideoRefs.current[userId]) {
        remoteVideoRefs.current[userId] = React.createRef<HTMLVideoElement>();
      }
    });
    
    Object.keys(remoteVideoRefs.current).forEach((userId) => {
      if (!remoteStreams.has(userId)) {
        delete remoteVideoRefs.current[userId];
      }
    });
  }, [remoteStreams]);

  useEffect(() => {
    const streamEntries = Array.from(remoteStreams.entries());
    
    streamEntries.forEach(([userId, stream]) => {
      const videoRef = remoteVideoRefs.current[userId];
      if (!videoRef) {
        return;
      }
      
      setTimeout(() => {
        const videoElement = videoRef.current;
        if (videoElement && stream) {
          const currentSrcObject = videoElement.srcObject;
          const currentStreamId = currentSrcObject ? (currentSrcObject as MediaStream).id : null;
          
          if (currentStreamId !== stream.id) {
            videoElement.srcObject = stream;
          }
        }
      }, 0);
    });
  }, [remoteStreams]);

  const getUserName = (userId: string): string => {
    const user = users.find((u) => u.userId === userId);
    return user ? user.username : `用户${userId.substring(0, 8)}`;
  };

  const totalVideos = 1 + remoteStreams.size;
  const gridClass = `video-grid grid-${Math.min(totalVideos, 4)}`;
  const remoteStreamEntries = Array.from(remoteStreams.entries());

  return (
    <div className={gridClass}>
      <div className="video-item local-video">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="video-element"
        />
        <div className="video-label">我 (本地)</div>
      </div>

      {remoteStreamEntries.map(([userId, stream]) => {
        const setVideoRef = (element: HTMLVideoElement | null) => {
          if (element) {
            if (!remoteVideoRefs.current[userId]) {
              remoteVideoRefs.current[userId] = React.createRef<HTMLVideoElement>();
            }
            (remoteVideoRefs.current[userId] as any).current = element;
            element.srcObject = stream;
          }
        };
        
        return (
          <div key={userId} className="video-item remote-video">
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              className="video-element"
              onError={(e) => {
                console.error(`[VideoGrid] video error - 用户ID: ${userId}`, {
                  error: e.currentTarget.error,
                  networkState: e.currentTarget.networkState,
                });
              }}
            />
            <div className="video-label">{getUserName(userId)}</div>
          </div>
        );
      })}
    </div>
  );
};

export default VideoGrid;
