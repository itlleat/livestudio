import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, MonitorIcon, PhoneOffIcon } from './Icons';
import styles from './Controls.module.css';

interface ControlsProps {
  isMuted: boolean;
  isCamOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
}

export default function Controls({
  isMuted,
  isCamOff,
  isScreenSharing,
  onToggleMute,
  onToggleCam,
  onToggleScreenShare,
  onLeave,
}: ControlsProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.pill}>
        <ControlBtn
          onClick={onToggleMute}
          active={isMuted}
          danger={isMuted}
          label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
        </ControlBtn>

        <ControlBtn
          onClick={onToggleCam}
          active={isCamOff}
          danger={isCamOff}
          label={isCamOff ? 'Start Cam' : 'Stop Cam'}
          title={isCamOff ? 'Start camera' : 'Stop camera'}
        >
          {isCamOff ? <VideoOffIcon size={20} /> : <VideoIcon size={20} />}
        </ControlBtn>

        <ControlBtn
          onClick={onToggleScreenShare}
          active={isScreenSharing}
          label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
          title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
        >
          <MonitorIcon size={20} />
        </ControlBtn>

        <div className={styles.sep} />

        <ControlBtn
          onClick={onLeave}
          leave
          label="Leave"
          title="Leave the call"
        >
          <PhoneOffIcon size={20} />
        </ControlBtn>
      </div>
    </div>
  );
}

interface ControlBtnProps {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  title?: string;
  active?: boolean;
  danger?: boolean;
  leave?: boolean;
}

function ControlBtn({ onClick, children, label, title, active, danger, leave }: ControlBtnProps) {
  let className = styles.btn;
  if (leave) className = `${styles.btn} ${styles.leaveBtn}`;
  else if (danger) className = `${styles.btn} ${styles.dangerBtn}`;
  else if (active) className = `${styles.btn} ${styles.activeBtn}`;

  return (
    <button className={className} onClick={onClick} title={title}>
      {children}
      <span className={styles.btnLabel}>{label}</span>
    </button>
  );
}
