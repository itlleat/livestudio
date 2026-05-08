export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Cloudflare free TURN — relay fallback for restrictive NATs
    {
      urls: 'turn:turn.cloudflare.com:3478?transport=udp',
      username: 'free',
      credential: 'free',
    },
    {
      urls: 'turn:turn.cloudflare.com:3478?transport=tcp',
      username: 'free',
      credential: 'free',
    },
  ],
  iceCandidatePoolSize: 10,
};
