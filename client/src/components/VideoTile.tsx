import { useEffect, useRef } from 'react';
import { MicOffIcon } from './Icons';
import styles from './VideoTile.module.css';

interface VideoTileProps {
  stream: MediaStream | null;
  label?: string;
  muted?: boolean;
  isCamOff?: boolean;
  isMicOff?: boolean;
  isLocal?: boolean;
}

export default function VideoTile({
  stream,
  label,
  muted = false,
  isCamOff = false,
  isMicOff = false,
  isLocal = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = label ? label.slice(0, 2).toUpperCase() : '?';
  const showVideo = !isCamOff && !!stream;

  return (
    <div className={styles.tile}>
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={styles.video}
        />
      ) : (
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>{initials}</div>
        </div>
      )}

      <div className={styles.footer}>
        {isMicOff && (
          <span className={styles.micOff}>
            <MicOffIcon size={12} />
          </span>
        )}
        {label && <span className={styles.label}>{isLocal ? `${label} (You)` : label}</span>}
      </div>
    </div>
  );
}
