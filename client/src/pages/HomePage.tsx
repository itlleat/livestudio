import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { PlusIcon, ArrowRightIcon } from '../components/Icons';
import styles from './HomePage.module.css';

export default function HomePage() {
  const [joinId, setJoinId] = useState('');
  const navigate = useNavigate();

  function createRoom() {
    navigate(`/room/${uuidv4()}`);
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const raw = joinId.trim();
    if (!raw) return;
    // Accept full URL or bare room ID
    const id = raw.includes('/room/') ? raw.split('/room/')[1].split('?')[0] : raw;
    navigate(`/room/${id}`);
  }

  return (
    <div className={styles.page}>
      {/* background blobs */}
      <div className={styles.blob1} aria-hidden />
      <div className={styles.blob2} aria-hidden />

      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.logoMark}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="15" height="14" rx="2" fill="#6366f1" />
              <polygon points="17 9 23 6 23 18 17 15" fill="#a5b4fc" />
            </svg>
          </div>
          <span className={styles.logoText}>LiveStudio</span>
        </header>

        <h1 className={styles.title}>
          Video calls,<br />done your way.
        </h1>
        <p className={styles.subtitle}>
          No accounts, no downloads. Just share a link and start talking.
        </p>

        <button className={styles.createBtn} onClick={createRoom}>
          <PlusIcon size={18} />
          New Room
        </button>

        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span>or join with a code</span>
          <div className={styles.dividerLine} />
        </div>

        <form onSubmit={joinRoom} className={styles.form}>
          <input
            className={styles.input}
            type="text"
            placeholder="Room ID or link…"
            value={joinId}
            onChange={e => setJoinId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={styles.joinBtn} disabled={!joinId.trim()}>
            <ArrowRightIcon size={18} />
          </button>
        </form>

        <p className={styles.note}>
          Open-source &middot; Peer-to-peer &middot; No data stored
        </p>
      </div>
    </div>
  );
}
