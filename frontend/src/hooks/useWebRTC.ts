import { useRef, useCallback, useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setVideoEnabled,
  setAudioEnabled,
  setScreenSharing,
  setConnected,
  addMessage,
  setUsers,
  addUser,
  removeUser,
  updateUser,
  addRemoteStreamId,
  clearRemoteStreamIds,
  reset,
} from '../store/slices/webrtcSlice';
import { ChatMessage, Message } from '../types';
import { setHost } from '../store/slices/roomSlice';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/api/ws';

export const useWebRTC = () => {
  const dispatch = useAppDispatch();
  const webrtcState = useAppSelector((state) => state.webrtc);
  
  const [remoteStreamsUpdate, setRemoteStreamsUpdate] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRefs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const userIdRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const usernameRef = useRef<string | null>(null);

  const getLocalStream = useCallback(async (video = true, audio = true): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: audio,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error('获取本地媒体流失败:', error);
      throw error;
    }
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.ontrack = (event) => {        const [remoteStream] = event.streams;
        if (remoteStream) {
          console.log(`[WebRTC DEBUG] 设置远程流 - 用户ID: ${targetUserId}`, {
            streamId: remoteStream.id,
            streamActive: remoteStream.active,
            tracks: remoteStream.getTracks().map(t => ({
              id: t.id,
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState,
            })),
            currentRemoteStreamsCount: remoteStreamsRef.current.size,
            currentRemoteStreamsKeys: Array.from(remoteStreamsRef.current.keys()),
          });
          remoteStreamsRef.current.set(targetUserId, remoteStream);
          dispatch(addRemoteStreamId(targetUserId));
          setRemoteStreamsUpdate((prev) => {
            const newValue = prev + 1;            return newValue;
          });
        } else {        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          console.log(`[WebRTC DEBUG] ICE candidate - 用户ID: ${targetUserId}`, {
            candidate: event.candidate.candidate?.substring(0, 50),
          });
          wsRef.current.send(
            JSON.stringify({
              type: 'ice-candidate',
              from: userIdRef.current,
              to: targetUserId,
              roomId: roomIdRef.current,
              data: event.candidate,
            })
          );
        }
      };

      pc.onconnectionstatechange = () => {      };
      
      pc.oniceconnectionstatechange = () => {      };


      return pc;
    },
    [dispatch]
  );

  const connectToRoom = useCallback(
    async (roomId: string, username: string, isCreate: boolean = false) => {
      try {
        usernameRef.current = username;
        // 获取本地媒体流
        await getLocalStream(webrtcState.isVideoEnabled, webrtcState.isAudioEnabled);

        // 连接WebSocket
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        roomIdRef.current = roomId;

        ws.onopen = () => {
          dispatch(setConnected(true));

          // 发送加入房间消息
          const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          userIdRef.current = userId;

          ws.send(
            JSON.stringify({
              type: isCreate ? 'create-room' : 'join',
              from: userId,
              roomId: roomId,
              username: username,
            })
          );
        };

        ws.onmessage = async (event) => {
          const message: Message = JSON.parse(event.data);

          switch (message.type) {
            case 'join-success':
              if (message.data) {
                const data = message.data as any;
                if (data.isHost !== undefined) {
                  const isCurrentUserHost = data.isHost === true;
                  dispatch(setHost({ hostId: userIdRef.current!, isHost: isCurrentUserHost }));
                }
              }
              break;

            case 'users-list':
              if (message.data && Array.isArray(message.data)) {
                const users = (message.data as any[])
                  .filter((user: any) => user.userId !== userIdRef.current)
                  .map((user: any) => ({
                    ...user,
                    isVideoEnabled: user.isVideoEnabled !== undefined ? user.isVideoEnabled : true,
                    isAudioEnabled: user.isAudioEnabled !== undefined ? user.isAudioEnabled : true,
                  }));
                dispatch(setUsers(users));

                users.forEach(async (user: any) => {
                  if (user.userId && user.userId !== userIdRef.current && userIdRef.current) {
                    let pc = pcRefs.current.get(user.userId);
                    if (!pc) {
                      const shouldCreateOffer = userIdRef.current < user.userId;
                      if (shouldCreateOffer) {
                        pc = createPeerConnection(user.userId);
                        pcRefs.current.set(user.userId, pc);
                        try {
                          const offer = await pc.createOffer();
                          await pc.setLocalDescription(offer);
                          ws.send(
                            JSON.stringify({
                              type: 'offer',
                              from: userIdRef.current,
                              to: user.userId,
                              roomId: roomId,
                              data: offer,
                            })
                          );
                        } catch (error) {
                          console.error('创建offer失败:', error);
                        }
                      }
                    }
                  }
                });
              }
              break;

            case 'user-joined':
              if (message.from && message.from !== userIdRef.current && message.username) {
                const existingUser = webrtcState.users.find((u) => u.userId === message.from);
                if (!existingUser) {
                  dispatch(addUser({
                    userId: message.from,
                    username: message.username,
                    isVideoEnabled: true,
                    isAudioEnabled: true,
                  }));
                }

                let pc = pcRefs.current.get(message.from);
                if (pc) {
                  if (pc.signalingState !== 'stable') {
                    pc.close();
                    pcRefs.current.delete(message.from);
                    pc = undefined;
                  }
                }

                if (!pc && userIdRef.current && message.from) {
                  const shouldCreateOffer = userIdRef.current < message.from;
                  if (shouldCreateOffer) {
                    pc = createPeerConnection(message.from);
                    pcRefs.current.set(message.from, pc);

                    try {
                      const offer = await pc.createOffer();
                      await pc.setLocalDescription(offer);

                      ws.send(
                        JSON.stringify({
                          type: 'offer',
                          from: userIdRef.current,
                          to: message.from,
                          roomId: roomId,
                          data: offer,
                        })
                      );
                    } catch (error) {
                      console.error('创建offer失败:', error);
                    }
                  }
                }
              }
              break;

            case 'user-left':
              if (message.from) {
                const leavingPc = pcRefs.current.get(message.from);
                if (leavingPc) {
                  leavingPc.close();
                  pcRefs.current.delete(message.from);
                }
                remoteStreamsRef.current.delete(message.from);
                dispatch(removeUser(message.from));
                setRemoteStreamsUpdate((prev) => prev + 1);
              }
              break;

            case 'offer':
              if (message.from && message.data) {
                let offerPc = pcRefs.current.get(message.from);
                
                if (offerPc && offerPc.signalingState !== 'stable') {
                  offerPc.close();
                  pcRefs.current.delete(message.from);
                  offerPc = undefined;
                }
                
                if (!offerPc) {
                  offerPc = createPeerConnection(message.from);
                  pcRefs.current.set(message.from, offerPc);
                }

                try {
                  await offerPc.setRemoteDescription(new RTCSessionDescription(message.data));
                  const answer = await offerPc.createAnswer();
                  await offerPc.setLocalDescription(answer);

                  ws.send(
                    JSON.stringify({
                      type: 'answer',
                      from: userIdRef.current,
                      to: message.from,
                      roomId: roomId,
                      data: answer,
                    })
                  );
                } catch (error) {
                  console.error('[WebRTC] 处理 offer 失败:', error);
                }
              }
              break;

            case 'answer':              if (message.from && message.data) {
                const answerPc = pcRefs.current.get(message.from);
                if (answerPc) {                  try {
                      if (answerPc.signalingState === 'have-local-offer') {
                      console.log(`[WebRTC DEBUG] 设置 remote description (answer) - 用户ID: ${message.from}`);
                      await answerPc.setRemoteDescription(new RTCSessionDescription(message.data));
                      console.log(`[WebRTC DEBUG] remote description (answer) 设置成功 - 用户ID: ${message.from}`);
                    } else {                    }
                  } catch (error) {                  }
                } else {
                  console.warn(`[WebRTC DEBUG] 收到 answer 但找不到对应的 PeerConnection - 用户ID: ${message.from}`, {
                    existingPcKeys: Array.from(pcRefs.current.keys()),
                  });
                }
              }
              break;

            case 'ice-candidate':
              if (message.from && message.data) {
                const candidatePc = pcRefs.current.get(message.from);
                if (candidatePc) {
                  try {
                    // 只有当 remote description 已设置时才添加 ICE candidate
                    if (candidatePc.remoteDescription) {
                      await candidatePc.addIceCandidate(new RTCIceCandidate(message.data));
                    } else {
                      // 如果 remote description 还没设置，尝试添加（浏览器通常会缓冲）
                      await candidatePc.addIceCandidate(new RTCIceCandidate(message.data)).catch(() => {
                        // 忽略错误，稍后会自动重试
                      });
                    }
                  } catch (error) {
                    console.error('添加 ICE candidate 失败:', error);
                  }
                }
              }
              break;

            case 'chat':
              if (message.username && message.content) {
                // 只有当消息不是自己发送的时候才添加（避免重复）
                // 自己发送的消息已经在 sendMessage 中添加了
                if (message.from !== userIdRef.current) {
                  const chatMessage: ChatMessage = {
                    username: message.username,
                    content: message.content,
                    time: new Date().toLocaleTimeString(),
                    isOwn: false,
                  };
                  dispatch(addMessage(chatMessage));
                }
              }
              break;

            case 'toggle-video':
              if (message.from && message.from !== userIdRef.current && message.data) {
                const data = message.data as any;                dispatch(updateUser({
                  userId: message.from,
                  isVideoEnabled: data.enabled !== undefined ? data.enabled : true,
                }));
              }
              break;

            case 'toggle-audio':
              if (message.from && message.from !== userIdRef.current && message.data) {
                const data = message.data as any;                dispatch(updateUser({
                  userId: message.from,
                  isAudioEnabled: data.enabled !== undefined ? data.enabled : true,
                }));
              }
              break;

            case 'host-updated':
              if (message.data && (message.data as any).hostId) {
                const newHostId = (message.data as any).hostId;
                dispatch(setHost({ hostId: newHostId, isHost: newHostId === userIdRef.current }));
              }
              break;

            case 'mute-user':
              if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((track) => {
                  track.enabled = false;
                });
                dispatch(setAudioEnabled(false));
                
                if (wsRef.current?.readyState === WebSocket.OPEN && roomIdRef.current) {
                  wsRef.current.send(
                    JSON.stringify({
                      type: 'toggle-audio',
                      from: userIdRef.current,
                      roomId: roomIdRef.current,
                      data: { enabled: false },
                    })
                  );
                }
              }
              break;

            case 'user-muted':
              if (message.from && message.from !== userIdRef.current && message.data) {
                const data = message.data as any;
                dispatch(updateUser({
                  userId: message.from,
                  isAudioEnabled: data.audioEnabled !== undefined ? data.audioEnabled : false,
                }));
              }
              break;

            case 'kick-user':
              if (wsRef.current) {
                wsRef.current.close();
              }
              pcRefs.current.forEach((pc) => pc.close());
              pcRefs.current.clear();
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => track.stop());
              }
              remoteStreamsRef.current.clear();
              dispatch(clearRemoteStreamIds());
              dispatch(reset());
              alert('您已被主持人移出会议');
              break;

            default:
              break;
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket错误:', error);
          dispatch(setConnected(false));
        };

        ws.onclose = () => {
          dispatch(setConnected(false));
        };
      } catch (error) {
        console.error('连接房间失败:', error);
      }
    },
    [getLocalStream, createPeerConnection, webrtcState.isVideoEnabled, webrtcState.isAudioEnabled, dispatch]
  );

  const disconnectFromRoom = useCallback(() => {
    // 关闭所有PeerConnection
    pcRefs.current.forEach((pc) => pc.close());
    pcRefs.current.clear();

    // 停止本地流
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    // 关闭WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    remoteStreamsRef.current.clear();
    dispatch(clearRemoteStreamIds());
    dispatch(reset());
    usernameRef.current = null;
    setRemoteStreamsUpdate(0);
  }, [dispatch]);

  const toggleVideo = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newEnabled = videoTrack.enabled;
        dispatch(setVideoEnabled(newEnabled));
        
        // 发送状态更新消息给其他用户
        if (wsRef.current?.readyState === WebSocket.OPEN && roomIdRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'toggle-video',
              from: userIdRef.current,
              roomId: roomIdRef.current,
              data: { enabled: newEnabled },
            })
          );
        }
      }
    } else if (!webrtcState.isVideoEnabled) {
      try {
        const stream = await getLocalStream(true, webrtcState.isAudioEnabled);
        // 更新所有PeerConnection
        pcRefs.current.forEach((pc) => {
          stream.getVideoTracks().forEach((track) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(track);
            } else {
              pc.addTrack(track, stream);
            }
          });
        });
        dispatch(setVideoEnabled(true));
        
        // 发送状态更新消息给其他用户
        if (wsRef.current?.readyState === WebSocket.OPEN && roomIdRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'toggle-video',
              from: userIdRef.current,
              roomId: roomIdRef.current,
              data: { enabled: true },
            })
          );
        }
      } catch (error) {
        console.error('开启视频失败:', error);
      }
    }
  }, [webrtcState.isVideoEnabled, webrtcState.isAudioEnabled, getLocalStream, dispatch]);

  const toggleAudio = useCallback(async () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newEnabled = audioTrack.enabled;
        dispatch(setAudioEnabled(newEnabled));
        
        // 发送状态更新消息给其他用户
        if (wsRef.current?.readyState === WebSocket.OPEN && roomIdRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'toggle-audio',
              from: userIdRef.current,
              roomId: roomIdRef.current,
              data: { enabled: newEnabled },
            })
          );
        }
      }
    } else if (!webrtcState.isAudioEnabled) {
      try {
        const stream = await getLocalStream(webrtcState.isVideoEnabled, true);
        // 更新所有PeerConnection
        pcRefs.current.forEach((pc) => {
          stream.getAudioTracks().forEach((track) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
            if (sender) {
              sender.replaceTrack(track);
            } else {
              pc.addTrack(track, stream);
            }
          });
        });
        dispatch(setAudioEnabled(true));
        
        // 发送状态更新消息给其他用户
        if (wsRef.current?.readyState === WebSocket.OPEN && roomIdRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'toggle-audio',
              from: userIdRef.current,
              roomId: roomIdRef.current,
              data: { enabled: true },
            })
          );
        }
      } catch (error) {
        console.error('开启音频失败:', error);
      }
    }
  }, [webrtcState.isAudioEnabled, webrtcState.isVideoEnabled, getLocalStream, dispatch]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (webrtcState.isScreenSharing) {
        // 停止屏幕共享，恢复摄像头
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop());
          screenStreamRef.current = null;
        }

        // 重新获取摄像头视频流
        if (localStreamRef.current) {
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({
              video: { width: 1280, height: 720 },
            });
            const videoTrack = videoStream.getVideoTracks()[0];
            
            // 替换所有PeerConnection中的视频轨道
            pcRefs.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
              if (sender && videoTrack) {
                sender.replaceTrack(videoTrack);
              }
            });

            // 更新本地显示
            const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
            if (oldVideoTrack) {
              localStreamRef.current.removeTrack(oldVideoTrack);
            }
            localStreamRef.current.addTrack(videoTrack);
          } catch (error) {
            console.error('恢复摄像头失败:', error);
          }
        }
        dispatch(setScreenSharing(false));
      } else {
        // 开始屏幕共享
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;

        const videoTrack = screenStream.getVideoTracks()[0];

        // 替换所有PeerConnection中的视频轨道
        pcRefs.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        });

        // 更新本地显示
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
          }
          localStreamRef.current.addTrack(videoTrack);
        }

        dispatch(setScreenSharing(true));

        // 监听屏幕共享停止
        videoTrack.onended = () => {
          dispatch(setScreenSharing(false));
          // 停止屏幕流
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => track.stop());
            screenStreamRef.current = null;
          }
        };
      }
    } catch (error) {
      console.error('屏幕共享失败:', error);
    }
  }, [webrtcState.isScreenSharing, dispatch]);

  const sendMessage = useCallback(
    (content: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && userIdRef.current && usernameRef.current) {
        // 立即添加到本地消息列表
        const chatMessage: ChatMessage = {
          username: usernameRef.current,
          content: content,
          time: new Date().toLocaleTimeString(),
          isOwn: true,
        };
        dispatch(addMessage(chatMessage));
        
        // 发送到服务器
        wsRef.current.send(
          JSON.stringify({
            type: 'chat',
            from: userIdRef.current,
            roomId: roomIdRef.current,
            content: content,
          })
        );
      }
    },
    [dispatch]
  );

  const muteRemoteUser = useCallback((targetUserId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userIdRef.current && roomIdRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'mute-user',
          from: userIdRef.current,
          to: targetUserId,
          roomId: roomIdRef.current,
        })
      );
    }
  }, []);

  const kickUser = useCallback((targetUserId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userIdRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'kick-user',
          from: userIdRef.current,
          to: targetUserId,
          roomId: roomIdRef.current,
        })
      );
    }
  }, []);

  // 设为主持人
  const makeHost = useCallback((targetUserId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userIdRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'make-host',
          from: userIdRef.current,
          to: targetUserId,
          roomId: roomIdRef.current,
        })
      );
    }
  }, []);

  // 使用 state 来存储远程流，确保 React 能检测到变化
  const [remoteStreamsForRender, setRemoteStreamsForRender] = useState(new Map<string, MediaStream>());
  
  useEffect(() => {
    const oldSize = remoteStreamsForRender.size;
    const oldKeys = Array.from(remoteStreamsForRender.keys());
    const newMap = new Map(remoteStreamsRef.current);
    const newSize = newMap.size;
    const newKeys = Array.from(newMap.keys());  console.log('[WebRTC DEBUG] remoteStreamsRefKeys:', Array.from(remoteStreamsRef.current.keys()));
    
    // 只有当 Map 内容真正改变时才更新 state
    if (oldSize !== newSize || oldKeys.some(key => !newKeys.includes(key)) || newKeys.some(key => !oldKeys.includes(key))) {
      console.log('[WebRTC DEBUG] remoteStreamsForRender state 已更新', {
        oldSize,
        newSize,
        oldKeys,
        newKeys,
        streams: Array.from(newMap.entries()).map(([userId, stream]) => ({
          userId,
          streamId: stream.id,
          streamActive: stream.active,
          trackCount: stream.getTracks().length,
          tracks: stream.getTracks().map(t => ({
            id: t.id,
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
          })),
        })),
      });
      setRemoteStreamsForRender(newMap);
    }
  }, [remoteStreamsUpdate, remoteStreamsForRender]);

  return {
    localStream: localStreamRef.current,
    remoteStreams: remoteStreamsForRender,
    isVideoEnabled: webrtcState.isVideoEnabled,
    isAudioEnabled: webrtcState.isAudioEnabled,
    isScreenSharing: webrtcState.isScreenSharing,
    messages: webrtcState.messages,
    isConnected: webrtcState.isConnected,
    users: webrtcState.users,
    currentUserId: userIdRef.current,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    sendMessage,
    connectToRoom,
    disconnectFromRoom,
    muteRemoteUser,
    kickUser,
    makeHost,
  };
};

