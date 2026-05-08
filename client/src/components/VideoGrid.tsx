import { useEffect, useMemo, useRef, useState } from 'react';
import VideoTile from './VideoTile';
import { RemotePeer } from '../hooks/useWebRTC';
import styles from './VideoGrid.module.css';

interface VideoGridProps {
  localStream: MediaStream | null;
  remotePeers: RemotePeer[];
  isCamOff: boolean;
  isMuted: boolean;
  audioOnly?: boolean;
}

interface MeterReading {
  level: number;
  peak: number;
  clipping: boolean;
  clipUntil?: number;
}

export default function VideoGrid({ localStream, remotePeers, isCamOff, isMuted, audioOnly = false }: VideoGridProps) {
  const total = 1 + remotePeers.length;
  const levelInputs = useMemo(
    () => [
      { id: 'local', stream: localStream },
      ...remotePeers.map(peer => ({ id: peer.peerId, stream: peer.stream })),
    ],
    [localStream, remotePeers]
  );
  const levels = useAudioLevels(levelInputs);

  if (audioOnly) {
    return (
      <div className={styles.audioWrap}>
        <div className={styles.audioTitle}>Audio Session Mode</div>
        <div className={styles.audioSubtitle}>Camera feed hidden, music routing prioritized.</div>

        <div className={styles.audioList}>
          <div className={styles.audioCard}>
            <div className={styles.audioCardTop}>
              <span className={styles.audioName}>You</span>
              <div className={styles.audioStatusWrap}>
                {(levels.local?.clipping ?? false) && !isMuted && <span className={styles.audioClip}>Clip</span>}
                <span className={isMuted ? styles.audioMuted : styles.audioLive}>
                  {isMuted ? 'Muted' : 'Live'}
                </span>
              </div>
            </div>
            <LevelMeter level={levels.local?.level ?? 0} peak={levels.local?.peak ?? 0} muted={isMuted} />
          </div>

          {remotePeers.map(peer => (
            <div className={styles.audioCard} key={peer.peerId}>
              <div className={styles.audioCardTop}>
                <span className={styles.audioName}>{peer.peerId.slice(0, 8)}</span>
                <div className={styles.audioStatusWrap}>
                  {(levels[peer.peerId]?.clipping ?? false) && <span className={styles.audioClip}>Clip</span>}
                  <span className={styles.audioLive}>Connected</span>
                </div>
              </div>
              <LevelMeter
                level={levels[peer.peerId]?.level ?? 0}
                peak={levels[peer.peerId]?.peak ?? 0}
                muted={false}
              />
            </div>
          ))}
        </div>

        {remotePeers.length === 0 && (
          <div className={styles.waiting}>
            <div className={styles.waitingDot} />
            <span>Waiting for others to join…</span>
            <span className={styles.waitingHint}>Share the room link to start practicing</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.grid} data-count={Math.min(total, 9)}>
        <VideoTile
          stream={localStream}
          label="You"
          muted
          isCamOff={isCamOff}
          isMicOff={isMuted}
          isLocal
        />
        {remotePeers.map(peer => (
          <VideoTile key={peer.peerId} stream={peer.stream} label={peer.peerId.slice(0, 8)} />
        ))}
      </div>

      {remotePeers.length === 0 && (
        <div className={styles.waiting}>
          <div className={styles.waitingDot} />
          <span>Waiting for others to join…</span>
          <span className={styles.waitingHint}>Share the room link to invite people</span>
        </div>
      )}
    </div>
  );
}

interface LevelMeterProps {
  level: number;
  peak: number;
  muted: boolean;
}

function LevelMeter({ level, peak, muted }: LevelMeterProps) {
  const clamped = Math.max(0, Math.min(1, level));
  const peakClamped = Math.max(0, Math.min(1, peak));
  const width = muted ? 0 : Math.max(2, Math.round(clamped * 100));
  const peakLeft = muted ? 0 : Math.max(2, Math.round(peakClamped * 100));

  return (
    <div className={styles.meter} aria-hidden>
      <div className={styles.meterFill} style={{ width: `${width}%` }} />
      <div className={styles.meterPeak} style={{ left: `${peakLeft}%` }} />
    </div>
  );
}

interface LevelInput {
  id: string;
  stream: MediaStream | null;
}

function useAudioLevels(inputs: LevelInput[]): Record<string, MeterReading> {
  const [levels, setLevels] = useState<Record<string, MeterReading>>({});
  const analysersRef = useRef<
    Map<string, { ctx: AudioContext; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>
  >(new Map());

  useEffect(() => {
    const currentIds = new Set(inputs.map(input => input.id));

    // Tear down removed streams.
    for (const [id, state] of analysersRef.current) {
      if (!currentIds.has(id)) {
        void state.ctx.close();
        analysersRef.current.delete(id);
      }
    }

    // Create analyzers for active streams with audio tracks.
    for (const input of inputs) {
      if (!input.stream || input.stream.getAudioTracks().length === 0) {
        continue;
      }
      if (analysersRef.current.has(input.id)) {
        continue;
      }

      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.65;

        const source = ctx.createMediaStreamSource(input.stream);
        source.connect(analyser);

        const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        analysersRef.current.set(input.id, { ctx, analyser, data });
        void ctx.resume();
      } catch {
        // Some browsers may block audio context creation until user interaction.
      }
    }

    let rafId = 0;
    const tick = () => {
      setLevels(prev => {
        const next: Record<string, MeterReading> = {};
        const now = Date.now();

        for (const input of inputs) {
          const state = analysersRef.current.get(input.id);
          if (!state) {
            next[input.id] = {
              level: 0,
              peak: Math.max(0, (prev[input.id]?.peak ?? 0) * 0.94),
              clipping: false,
            };
            continue;
          }

          state.analyser.getByteTimeDomainData(state.data);
          let sum = 0;
          for (let i = 0; i < state.data.length; i += 1) {
            const normalized = (state.data[i] - 128) / 128;
            sum += normalized * normalized;
          }

          const rms = Math.sqrt(sum / state.data.length);
          // Boost low-level movement so instruments are easier to visualize.
          const boosted = Math.min(1, rms * 3.2);
          const priorLevel = prev[input.id]?.level ?? 0;
          const smoothed = priorLevel * 0.72 + boosted * 0.28;

          const priorPeak = prev[input.id]?.peak ?? 0;
          const risingPeak = smoothed > priorPeak ? smoothed : priorPeak * 0.97;

          const currentClipping = smoothed >= 0.92;
          const clipUntil = currentClipping
            ? now + 1200
            : (prev[input.id]?.clipUntil ?? 0);

          next[input.id] = {
            level: smoothed,
            peak: Math.max(risingPeak, smoothed),
            clipping: (clipUntil ?? 0) > now,
            clipUntil,
          };
        }

        return next;
      });

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      for (const [, state] of analysersRef.current) {
        void state.ctx.close();
      }
      analysersRef.current.clear();
    };
  }, [inputs]);

  return levels;
}
