# LiveStudio

Real-time music practice sessions with high-quality audio. Built with React, Node.js, WebRTC, and Socket.io.

---

## Local development

```bash
# Install dependencies for both client and server
npm run install:all

# Start the signaling server (port 3001)
npm run dev:server

# Start the client dev server (port 5173) — in a separate terminal
npm run dev:client
```

Open http://localhost:5173 in your browser.

---

## Deploying to Railway

1. Push the repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select this repo — Railway picks up `railway.json` automatically
4. Click **Generate Domain** once the deploy finishes

Railway runs `npm run build` (installs + builds client and server) then starts the server with `NODE_ENV=production`. The Node server serves the built React client as static files, so everything runs from one URL.

---

## Desktop app (.exe / .dmg)

The Electron app wraps the deployed Railway URL in a standalone desktop window.

### 1. Set your server URL

Edit `electron/src/config.ts` and replace the placeholder with your Railway URL:

```ts
export const SERVER_URL = 'https://your-app.railway.app';
```

### 2. Add an app icon

Save a **512×512 PNG** to `electron/build/icon.png`.  
You can export the SVG icons in `client/public/` to PNG using any browser or image tool.

### 3. Build

**Windows `.exe`** (run on Windows):
```powershell
cd electron
npm install
npm run dist:win
# Output: electron/release/LiveStudio Setup 1.0.0.exe
```

**macOS `.dmg`** (run on a Mac):
```bash
cd electron
npm install
npm run dist:mac
# Output: electron/release/LiveStudio-1.0.0.dmg
```

> You can only build each platform's installer on that platform. Share the output files directly, or add GitHub Actions to build both automatically (one Windows runner + one macOS runner).

---

## Connecting a DAW (Reaper, etc.)

Route your DAW's audio output into LiveStudio using a virtual audio cable:

| Platform | Software | Install |
|----------|----------|---------|
| Windows | VB-CABLE | https://vb-audio.com/Cable/ |
| macOS | BlackHole | https://existential.audio/blackhole/ |

In Reaper: **Preferences → Audio → Device** → set Output to the virtual cable.  
In LiveStudio: open **Settings → Audio Input** and select the virtual cable output.  
Enable **Audio Session Mode** (mic icon in the header) for instrument-optimized audio.

**Important:** set your audio interface and Reaper to **48 kHz** to avoid pitch drift.

There is a step-by-step **DAW Setup Guide** built into the Settings panel in the app.
