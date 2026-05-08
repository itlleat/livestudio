import { useState, useEffect, useRef } from 'react';
import { AudioQualityPreset } from '../hooks/useWebRTC';
import DawSetupGuide from './DawSetupGuide';
import styles from './SettingsPanel.module.css';

const VIRTUAL_CABLE_PATTERNS = [
  /cable/i,
  /blackhole/i,
  /vb-audio/i,
  /loopback/i,
  /soundflower/i,
  /virtual/i,
];

function isVirtualCable(label: string): boolean {
  return VIRTUAL_CABLE_PATTERNS.some(p => p.test(label));
}

type DawStatus = 'no-device' | 'device-no-signal' | 'device-signal';

function useDawStatus(
  stream: MediaStream | null,
  deviceLabel: string
): DawStatus {
  const [hasSignal, setHasSignal] = useState(false);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const isVirtual = isVirtualCable(deviceLabel);

  useEffect(() => {
    if (!isVirtual || !stream) {
      setHasSignal(false);
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteTimeDomainData(buf);
      // RMS over the time-domain buffer; silence = all values 128
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      setHasSignal(rms > 0.005);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      void ctx.close();
    };
  }, [isVirtual, stream]);

  if (!isVirtual) return 'no-device';
  return hasSignal ? 'device-signal' : 'device-no-signal';
}

interface SettingsPanelProps {
  musicMode: boolean;
  audioQualityPreset: AudioQualityPreset;
  audioInputs: MediaDeviceInfo[];
  selectedAudioInputId: string;
  localStream: MediaStream | null;
  onToggleMusicMode: (enabled: boolean) => Promise<void>;
  onSetQualityPreset: (preset: AudioQualityPreset) => Promise<void>;
  onSelectAudioInput: (deviceId: string) => Promise<void>;
  onRefreshAudioInputs: () => Promise<void>;
}

const DAW_STATUS_LABEL: Record<DawStatus, string> = {
  'no-device': 'Not a virtual cable',
  'device-no-signal': 'Virtual cable — no signal',
  'device-signal': 'DAW connected',
};

export default function SettingsPanel({
  musicMode,
  audioQualityPreset,
  audioInputs,
  selectedAudioInputId,
  localStream,
  onToggleMusicMode,
  onSetQualityPreset,
  onSelectAudioInput,
  onRefreshAudioInputs,
}: SettingsPanelProps) {
  const [dawGuideOpen, setDawGuideOpen] = useState(false);

  const selectedDevice = audioInputs.find(d => d.deviceId === selectedAudioInputId);
  const deviceLabel = selectedDevice?.label ?? '';
  const dawStatus = useDawStatus(localStream, deviceLabel);

  return (
    <>
    <div className={styles.panel} role="dialog" aria-label="Audio settings">
      <div className={styles.sectionHeader}>Audio Settings</div>

      <label className={styles.row}>
        <span className={styles.label}>Music Mode</span>
        <button
          className={musicMode ? styles.toggleOn : styles.toggleOff}
          onClick={() => void onToggleMusicMode(!musicMode)}
          type="button"
          aria-pressed={musicMode}
        >
          <span className={styles.knob} />
        </button>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Quality Preset</span>
        <select
          className={styles.select}
          value={audioQualityPreset}
          onChange={e => void onSetQualityPreset(e.target.value as AudioQualityPreset)}
          disabled={!musicMode}
        >
          <option value="balanced">Balanced</option>
          <option value="high">High</option>
          <option value="studio">Studio</option>
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Audio Input</span>
        <div className={styles.dawIndicator} data-status={dawStatus}>
          <span className={styles.dawDot} />
          <span className={styles.dawLabel}>{DAW_STATUS_LABEL[dawStatus]}</span>
        </div>
        <div className={styles.inputRow}>
          <select
            className={styles.select}
            value={selectedAudioInputId}
            onChange={e => void onSelectAudioInput(e.target.value)}
            disabled={audioInputs.length === 0}
          >
            {audioInputs.length === 0 && <option value="">No input devices</option>}
            {audioInputs.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Input ${device.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
          <button className={styles.refreshBtn} onClick={() => void onRefreshAudioInputs()} type="button">
            Refresh
          </button>
        </div>
      </label>

      <p className={styles.hint}>
        Use Music Mode for instruments. Studio preset prioritizes fidelity over bandwidth.
      </p>

      <button
        className={styles.dawGuideBtn}
        onClick={() => setDawGuideOpen(true)}
        type="button"
      >
        🎛 DAW Setup Guide
      </button>
    </div>
    {dawGuideOpen && <DawSetupGuide onClose={() => setDawGuideOpen(false)} />}
    </>
  );
}
