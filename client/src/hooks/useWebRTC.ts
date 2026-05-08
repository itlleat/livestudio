import { useEffect, useRef, useCallback, useState } from 'react';
import { getSocket } from '../lib/socket';
import { RTC_CONFIG } from '../lib/rtcConfig';

export type AudioQualityPreset = 'balanced' | 'high' | 'studio';

interface AudioQualityConfig {
  opusMaxAverageBitrate: number;
  senderMaxBitrate: number;
  ptime: number;
}

const AUDIO_QUALITY_CONFIG: Record<AudioQualityPreset, AudioQualityConfig> = {
  balanced: {
    opusMaxAverageBitrate: 128000,
    senderMaxBitrate: 128000,
    ptime: 20,
  },
  high: {
    opusMaxAverageBitrate: 256000,
    senderMaxBitrate: 256000,
    ptime: 10,
  },
  studio: {
    opusMaxAverageBitrate: 510000,
    senderMaxBitrate: 510000,
    ptime: 10,
  },
};

function buildAudioConstraints(musicMode: boolean, deviceId?: string): MediaTrackConstraints {
  const deviceConstraint = deviceId ? { exact: deviceId } : undefined;

  if (!musicMode) {
    return {
      deviceId: deviceConstraint,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
  }

  return {
    deviceId: deviceConstraint,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 2,
    sampleRate: 48000,
    sampleSize: 16,
  };
}

function tuneOpusSdpForMode(
  sdp: string | undefined,
  musicMode: boolean,
  preset: AudioQualityPreset
): string | undefined {
  if (!sdp || !musicMode) return sdp;

  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (!opusMatch) return sdp;

  const payloadType = opusMatch[1];
  const config = AUDIO_QUALITY_CONFIG[preset];
  const fmtpPattern = new RegExp(`a=fmtp:${payloadType} ([^\\r\\n]*)`, 'i');
  const musicParams = [
    'stereo=1',
    'sprop-stereo=1',
    `maxaveragebitrate=${config.opusMaxAverageBitrate}`,
    'cbr=1',
    `ptime=${config.ptime}`,
    `minptime=${config.ptime}`,
    'useinbandfec=1',
  ];

  if (fmtpPattern.test(sdp)) {
    return sdp.replace(fmtpPattern, (_line, existing) => {
      const merged = `${existing};${musicParams.join(';')}`
        .split(';')
        .map(p => p.trim())
        .filter(Boolean);
      const deduped = Array.from(new Set(merged));
      return `a=fmtp:${payloadType} ${deduped.join(';')}`;
    });
  }

  return sdp.replace(
    new RegExp(`a=rtpmap:${payloadType} opus\\/48000\\/2`, 'i'),
    `a=rtpmap:${payloadType} opus/48000/2\r\na=fmtp:${payloadType} ${musicParams.join(';')}`
  );
}

async function applyAudioSenderParams(
  peerConnections: Map<string, RTCPeerConnection>,
  musicMode: boolean,
  preset: AudioQualityPreset
) {
  const maxBitrate = musicMode ? AUDIO_QUALITY_CONFIG[preset].senderMaxBitrate : 64000;

  for (const [, pc] of peerConnections) {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'audio') continue;

      try {
        const params = sender.getParameters();
        const encodings = params.encodings && params.encodings.length > 0 ? params.encodings : [{}];
        encodings[0].maxBitrate = maxBitrate;
        params.encodings = encodings;
        await sender.setParameters(params);
      } catch {
        // Browser may not support setting sender parameters consistently.
      }
    }
  }
}

export interface RemotePeer {
  peerId: string;
  stream: MediaStream;
}

export interface UseWebRTCResult {
  localStream: MediaStream | null;
  remotePeers: RemotePeer[];
  isMuted: boolean;
  isCamOff: boolean;
  isScreenSharing: boolean;
  mediaError: string | null;
  musicMode: boolean;
  audioQualityPreset: AudioQualityPreset;
  audioInputs: MediaDeviceInfo[];
  selectedAudioInputId: string;
  toggleMute: () => void;
  toggleCam: () => void;
  toggleScreenShare: () => Promise<void>;
  retryCamera: () => Promise<void>;
  refreshAudioInputs: () => Promise<void>;
  setAudioInputDevice: (deviceId: string) => Promise<void>;
  setMusicMode: (enabled: boolean) => Promise<void>;
  setAudioQualityPreset: (preset: AudioQualityPreset) => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  leave: () => void;
}

export function useWebRTC(roomId: string): UseWebRTCResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [musicMode, setMusicModeState] = useState(true);
  const [audioQualityPreset, setAudioQualityPresetState] = useState<AudioQualityPreset>('high');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState('');

  // peerId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const musicModeRef = useRef(musicMode);
  const audioQualityPresetRef = useRef(audioQualityPreset);
  const selectedAudioInputIdRef = useRef(selectedAudioInputId);

  function mapMediaError(err: unknown): string {
    if (!(err instanceof DOMException)) {
      return 'Could not access media device. Check permissions and device availability.';
    }
    switch (err.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Camera or microphone access is blocked. Allow permissions in your browser and reload.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Required media device was not found.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Media device is in use by another app. Close that app and retry.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'Requested media settings are not supported on this device.';
      default:
        return 'Could not access media device. Check permissions and device availability.';
    }
  }

  const refreshAudioInputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter(d => d.kind === 'audioinput');
    setAudioInputs(inputs);

    if (!selectedAudioInputIdRef.current && inputs[0]?.deviceId) {
      selectedAudioInputIdRef.current = inputs[0].deviceId;
      setSelectedAudioInputId(inputs[0].deviceId);
    }
  }, []);

  // ── Helpers ────────────────────────────────────────────────
  const addRemotePeer = useCallback((peerId: string, stream: MediaStream) => {
    setRemotePeers(prev => {
      if (prev.some(p => p.peerId === peerId)) return prev;
      return [...prev, { peerId, stream }];
    });
  }, []);

  const removeRemotePeer = useCallback((peerId: string) => {
    setRemotePeers(prev => prev.filter(p => p.peerId !== peerId));
  }, []);

  const replaceLocalAudioTrack = useCallback(async (newAudioTrack: MediaStreamTrack) => {
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    localStreamRef.current.getAudioTracks().forEach(track => {
      localStreamRef.current?.removeTrack(track);
      track.stop();
    });

    localStreamRef.current.addTrack(newAudioTrack);

    for (const [, pc] of peerConnections.current) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) {
        await sender.replaceTrack(newAudioTrack);
      } else {
        pc.addTrack(newAudioTrack, localStreamRef.current);
      }
    }

    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    setIsMuted(!newAudioTrack.enabled);
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnections.current.set(peerId, pc);

      // Add local tracks
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      void applyAudioSenderParams(peerConnections.current, musicModeRef.current, audioQualityPresetRef.current);

      // Remote stream assembly
      const remoteStream = new MediaStream();
      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach(track => remoteStream.addTrack(track));
        addRemotePeer(peerId, remoteStream);
      };

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          getSocket().emit('ice-candidate', { to: peerId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          pc.close();
          peerConnections.current.delete(peerId);
          removeRemotePeer(peerId);
        }
      };

      return pc;
    },
    [addRemotePeer, removeRemotePeer]
  );

  // ── Setup local media + socket events ─────────────────────
  useEffect(() => {
    const socket = getSocket();
    let mounted = true;

    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('This browser does not support media access in this context. Use a modern browser on localhost or HTTPS.');
        setIsCamOff(true);
        setIsMuted(true);
        localStreamRef.current = new MediaStream();
        setLocalStream(localStreamRef.current);
        socket.emit('join-room', roomId);
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: buildAudioConstraints(musicModeRef.current, selectedAudioInputIdRef.current),
        });
        setMediaError(null);
      } catch {
        // Fallback: audio only, then empty
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: buildAudioConstraints(musicModeRef.current, selectedAudioInputIdRef.current),
          });
          setMediaError('Camera unavailable. You joined with audio only.');
        } catch {
          stream = new MediaStream();
          setMediaError('Could not access camera or microphone. Check permissions and device settings.');
        }
      }

      if (!mounted) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCamOff(stream.getVideoTracks().length === 0 || stream.getVideoTracks().every(t => !t.enabled));
      setIsMuted(stream.getAudioTracks().length === 0 || stream.getAudioTracks().every(t => !t.enabled));

      await refreshAudioInputs();
      socket.emit('join-room', roomId);
    }

    socket.on('room-peers', async (peerIds: string[]) => {
      // We are the joiner — initiate offer to every existing peer
      for (const peerId of peerIds) {
        const pc = createPeerConnection(peerId);
        const offer = await pc.createOffer();
        const tunedOffer: RTCSessionDescriptionInit = {
          type: 'offer',
          sdp: tuneOpusSdpForMode(offer.sdp, musicModeRef.current, audioQualityPresetRef.current),
        };
        await pc.setLocalDescription(tunedOffer);
        socket.emit('offer', { to: peerId, offer: tunedOffer });
      }
    });

    socket.on('peer-joined', async (_peerId: string) => {
      // A new peer joined after us — they will send us an offer.
    });

    socket.on('offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      const tunedAnswer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: tuneOpusSdpForMode(answer.sdp, musicModeRef.current, audioQualityPresetRef.current),
      };
      await pc.setLocalDescription(tunedAnswer);
      socket.emit('answer', { to: from, answer: tunedAnswer });
    });

    socket.on('answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(from);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(from);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // ignore stale candidates
        }
      }
    });

    socket.on('peer-left', (peerId: string) => {
      const pc = peerConnections.current.get(peerId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(peerId);
      }
      removeRemotePeer(peerId);
    });

    init();

    return () => {
      mounted = false;
      socket.off('room-peers');
      socket.off('peer-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('peer-left');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, refreshAudioInputs]);

  // ── Controls ───────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    for (const track of localStreamRef.current.getAudioTracks()) {
      track.enabled = !track.enabled;
    }
    setIsMuted(m => !m);
  }, []);

  const setCameraEnabled = useCallback(async (enabled: boolean) => {
    if (!localStreamRef.current) return;

    const videoTracks = localStreamRef.current.getVideoTracks();

    if (enabled) {
      if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
          track.enabled = true;
        });
        setIsCamOff(false);
        setMediaError(null);
        return;
      }

      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = camStream.getVideoTracks()[0];
        if (!videoTrack) return;

        localStreamRef.current.addTrack(videoTrack);
        for (const [, pc] of peerConnections.current) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, localStreamRef.current);
          }
        }

        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsCamOff(false);
        setMediaError(null);
      } catch (err) {
        setMediaError(mapMediaError(err));
      }
      return;
    }

    if (videoTracks.length === 0) {
      setIsCamOff(true);
      return;
    }

    videoTracks.forEach(track => {
      track.enabled = false;
    });
    setIsCamOff(true);
    setMediaError(null);
  }, []);

  const toggleCam = useCallback(() => {
    void setCameraEnabled(isCamOff);
  }, [isCamOff, setCameraEnabled]);

  const toggleScreenShare = useCallback(async () => {
    const socket = getSocket();

    if (isScreenSharing) {
      // Stop screen share, restore camera
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;

      let camStream: MediaStream;
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: buildAudioConstraints(musicModeRef.current, selectedAudioInputIdRef.current),
        });
      } catch {
        camStream = new MediaStream();
      }

      const videoTrack = camStream.getVideoTracks()[0];
      if (videoTrack) {
        for (const [, pc] of peerConnections.current) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(videoTrack);
        }
      }
      localStreamRef.current = camStream;
      setLocalStream(camStream);
      setIsScreenSharing(false);
    } else {
      // Start screen share
      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } catch {
        return; // user cancelled
      }

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      for (const [, pc] of peerConnections.current) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
      }

      const newStream = new MediaStream([
        screenTrack,
        ...(localStreamRef.current?.getAudioTracks() ?? []),
      ]);
      localStreamRef.current = newStream;
      setLocalStream(newStream);
      setIsScreenSharing(true);

      screenTrack.onended = () => {
        void toggleScreenShare();
      };
    }

    void socket;
  }, [isScreenSharing]);

  const retryCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('This browser does not support camera access in this context.');
      return;
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = camStream.getVideoTracks()[0];
      if (!videoTrack) {
        setMediaError('No camera was found on this device.');
        return;
      }

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }

      localStreamRef.current.getVideoTracks().forEach(track => {
        localStreamRef.current?.removeTrack(track);
        track.stop();
      });

      localStreamRef.current.addTrack(videoTrack);

      for (const [, pc] of peerConnections.current) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack, localStreamRef.current);
        }
      }

      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setIsCamOff(false);
      setMediaError(null);
    } catch (err) {
      setMediaError(mapMediaError(err));
    }
  }, []);

  const setAudioInputDevice = useCallback(async (deviceId: string) => {
    selectedAudioInputIdRef.current = deviceId;
    setSelectedAudioInputId(deviceId);

    if (!navigator.mediaDevices?.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(musicModeRef.current, deviceId),
      });
      const newTrack = stream.getAudioTracks()[0];
      if (!newTrack) {
        setMediaError('Selected audio input did not provide an audio track.');
        return;
      }
      await replaceLocalAudioTrack(newTrack);
      await applyAudioSenderParams(peerConnections.current, musicModeRef.current, audioQualityPresetRef.current);
      setMediaError(null);
    } catch (err) {
      setMediaError(mapMediaError(err));
    }
  }, [replaceLocalAudioTrack]);

  const setMusicMode = useCallback(async (enabled: boolean) => {
    musicModeRef.current = enabled;
    setMusicModeState(enabled);

    if (!navigator.mediaDevices?.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(enabled, selectedAudioInputIdRef.current),
      });
      const newTrack = stream.getAudioTracks()[0];
      if (newTrack) {
        await replaceLocalAudioTrack(newTrack);
      }
      await applyAudioSenderParams(peerConnections.current, enabled, audioQualityPresetRef.current);
      setMediaError(null);
    } catch (err) {
      setMediaError(mapMediaError(err));
    }
  }, [replaceLocalAudioTrack]);

  const setAudioQualityPreset = useCallback(async (preset: AudioQualityPreset) => {
    audioQualityPresetRef.current = preset;
    setAudioQualityPresetState(preset);
    await applyAudioSenderParams(peerConnections.current, musicModeRef.current, preset);
  }, []);

  const leave = useCallback(() => {
    getSocket().emit('leave-room', roomId);
    for (const [, pc] of peerConnections.current) {
      pc.close();
    }
    peerConnections.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    setRemotePeers([]);
  }, [roomId]);

  return {
    localStream,
    remotePeers,
    isMuted,
    isCamOff,
    isScreenSharing,
    mediaError,
    musicMode,
    audioQualityPreset,
    audioInputs,
    selectedAudioInputId,
    toggleMute,
    toggleCam,
    toggleScreenShare,
    retryCamera,
    refreshAudioInputs,
    setAudioInputDevice,
    setMusicMode,
    setAudioQualityPreset,
    setCameraEnabled,
    leave,
  };
}
