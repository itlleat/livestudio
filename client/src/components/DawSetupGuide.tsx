import { useState, useEffect, useCallback } from 'react';
import styles from './DawSetupGuide.module.css';

type OS = 'windows' | 'mac';

function detectOS(): OS {
  return navigator.userAgent.toLowerCase().includes('mac') ? 'mac' : 'windows';
}

interface Step {
  title: string;
  detail: string;
  link?: { href: string; label: string };
}

const WINDOWS_STEPS: Step[] = [
  {
    title: 'Install VB-CABLE',
    detail: 'Free virtual audio cable driver for Windows. Run the installer as Administrator, then restart.',
    link: { href: 'https://vb-audio.com/Cable/', label: 'Download VB-CABLE →' },
  },
  {
    title: 'Set Reaper output to CABLE Input',
    detail:
      'In Reaper: Options → Preferences → Audio → Device. Set the Output Device to "CABLE Input (VB-Audio Virtual Cable)". Click Apply.',
  },
  {
    title: 'Keep your headphones on a separate device',
    detail:
      'Set your headphone/monitor output as a separate output in Reaper (e.g. Output 3/4) so your mix goes to headphones AND the virtual cable — not just the cable.',
  },
  {
    title: 'Select CABLE Output in LiveStudio',
    detail:
      'In this Settings panel, open the Audio Input dropdown and select "CABLE Output (VB-Audio Virtual Cable)". This is what LiveStudio will send to your session.',
  },
  {
    title: 'Enable Audio Session Mode',
    detail:
      'Click the "Audio Mode" button in the header. This disables your camera, enables Music Mode, and optimizes the connection for instrument audio.',
  },
];

const MAC_STEPS: Step[] = [
  {
    title: 'Install BlackHole',
    detail:
      'Free open-source virtual audio driver for macOS. Download the 2ch version (stereo is enough). Run the installer.',
    link: { href: 'https://existential.audio/blackhole/', label: 'Download BlackHole →' },
  },
  {
    title: 'Set Reaper output to BlackHole 2ch',
    detail:
      'In Reaper: Reaper menu → Preferences → Audio → Device. Set the Output Device to "BlackHole 2ch". Click Apply.',
  },
  {
    title: 'Keep your headphones on a separate device',
    detail:
      'Create a Multi-Output Device in macOS Audio MIDI Setup that includes both BlackHole 2ch and your headphone interface. Set Reaper output to the Multi-Output Device so you hear the mix AND send it to LiveStudio.',
  },
  {
    title: 'Select BlackHole 2ch in LiveStudio',
    detail:
      'In this Settings panel, open the Audio Input dropdown and select "BlackHole 2ch". This is what LiveStudio will capture and send to your session.',
  },
  {
    title: 'Enable Audio Session Mode',
    detail:
      'Click the "Audio Mode" button in the header. This disables your camera, enables Music Mode, and optimizes the connection for instrument audio.',
  },
];

const SHARED_TIPS = [
  'Match sample rates: set 48 kHz in both your audio interface driver and Reaper to avoid pitch/speed drift.',
  'In Reaper, set the master send to your virtual cable at -6 dBFS or lower to avoid clipping the WebRTC codec.',
  'If you hear echo from the other person, lower their stream volume in LiveStudio — their mic is picking up your speaker.',
];

interface Props {
  onClose: () => void;
}

export default function DawSetupGuide({ onClose }: Props) {
  const [os, setOS] = useState<OS>(detectOS);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const steps = os === 'windows' ? WINDOWS_STEPS : MAC_STEPS;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="DAW Setup Guide">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="5" width="15" height="14" rx="2" fill="#6366f1" />
              <polygon points="17 9 23 6 23 18 17 15" fill="#a5b4fc" />
            </svg>
            <span className={styles.title}>Connect Your DAW</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close guide" type="button">
            ✕
          </button>
        </div>

        <p className={styles.subtitle}>
          Route audio from Reaper (or any DAW) into LiveStudio using a virtual audio cable.
        </p>

        <div className={styles.tabs}>
          <button
            className={os === 'windows' ? styles.tabActive : styles.tab}
            onClick={() => setOS('windows')}
            type="button"
          >
            🪟 Windows
          </button>
          <button
            className={os === 'mac' ? styles.tabActive : styles.tab}
            onClick={() => setOS('mac')}
            type="button"
          >
            🍎 macOS
          </button>
        </div>

        <ol className={styles.steps}>
          {steps.map((step, i) => (
            <li key={i} className={styles.step}>
              <div className={styles.stepNum}>{i + 1}</div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>{step.title}</div>
                <div className={styles.stepDetail}>{step.detail}</div>
                {step.link && (
                  <a
                    className={styles.stepLink}
                    href={step.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {step.link.label}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className={styles.tips}>
          <div className={styles.tipsHeader}>Pro tips</div>
          <ul className={styles.tipsList}>
            {SHARED_TIPS.map((tip, i) => (
              <li key={i} className={styles.tipItem}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
