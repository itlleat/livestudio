import { useParams, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoGrid from '../components/VideoGrid';
import Controls from '../components/Controls';
import SettingsPanel from '../components/SettingsPanel';
import { LinkIcon, CheckIcon, UsersIcon, SlidersIcon, MicIcon } from '../components/Icons';
import styles from './RoomPage.module.css';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioSessionMode, setAudioSessionMode] = useState(false);
  const camWasOnBeforeAudioMode = useRef(false);

  const {
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
  } = useWebRTC(roomId ?? '');

  function handleLeave() {
    leave();
    navigate('/');
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  async function toggleAudioSessionMode() {
    if (!audioSessionMode) {
      camWasOnBeforeAudioMode.current = !isCamOff;

      await setMusicMode(true);
      await setAudioQualityPreset('high');
      if (isScreenSharing) {
        await toggleScreenShare();
      }
      await setCameraEnabled(false);
      setSettingsOpen(false);
      setAudioSessionMode(true);
      return;
    }

    if (camWasOnBeforeAudioMode.current) {
      await setCameraEnabled(true);
    }
    setAudioSessionMode(false);
  }

  if (!roomId) {
    return <div className={styles.error}>Invalid room.</div>;
  }

  const participantCount = 1 + remotePeers.length;

  return (
    <div className={styles.room}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="15" height="14" rx="2" fill="#6366f1" />
            <polygon points="17 9 23 6 23 18 17 15" fill="#a5b4fc" />
          </svg>
          <span className={styles.brandName}>LiveStudio</span>
        </div>

        <div className={styles.roomMeta}>
          <span className={styles.roomCode} title={roomId}>
            {roomId.slice(0, 8)}&hellip;
          </span>
        </div>

        <div className={styles.headerRight}>
          <button
            className={audioSessionMode ? styles.audioModeBtnActive : styles.audioModeBtn}
            onClick={() => void toggleAudioSessionMode()}
            title="Audio-only practice mode"
          >
            <MicIcon size={14} />
            <span>{audioSessionMode ? 'Audio Mode On' : 'Audio Mode'}</span>
          </button>
          <div className={styles.participants}>
            <UsersIcon size={14} />
            <span>{participantCount}</span>
          </div>
          <div className={styles.settingsWrap}>
            <button
              className={styles.settingsBtn}
              onClick={() => {
                if (!settingsOpen) {
                  void refreshAudioInputs();
                }
                setSettingsOpen(v => !v);
              }}
            >
              <SlidersIcon size={14} />
              <span>Settings</span>
            </button>
            {settingsOpen && (
              <SettingsPanel
                musicMode={musicMode}
                audioQualityPreset={audioQualityPreset}
                audioInputs={audioInputs}
                selectedAudioInputId={selectedAudioInputId}
                localStream={localStream}
                onToggleMusicMode={setMusicMode}
                onSetQualityPreset={setAudioQualityPreset}
                onSelectAudioInput={setAudioInputDevice}
                onRefreshAudioInputs={refreshAudioInputs}
              />
            )}
          </div>
          <button className={styles.copyBtn} onClick={copyLink}>
            {copied ? <CheckIcon size={14} /> : <LinkIcon size={14} />}
            <span>{copied ? 'Copied!' : 'Invite'}</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {mediaError && (
          <div className={styles.mediaError} role="alert">
            <span>{mediaError}</span>
            <button className={styles.retryBtn} onClick={retryCamera}>
              Retry Camera
            </button>
          </div>
        )}
        <VideoGrid
          localStream={localStream}
          remotePeers={remotePeers}
          isCamOff={isCamOff}
          isMuted={isMuted}
          audioOnly={audioSessionMode}
        />
      </main>

      <Controls
        isMuted={isMuted}
        isCamOff={isCamOff}
        isScreenSharing={isScreenSharing}
        onToggleMute={toggleMute}
        onToggleCam={toggleCam}
        onToggleScreenShare={toggleScreenShare}
        onLeave={handleLeave}
      />
    </div>
  );
}
