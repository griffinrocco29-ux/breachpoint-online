# BREACHPOINT — 3D Online Tactical FPS Starter

A browser-based 3D first-person tactical shooter starter with a Node.js + Socket.IO multiplayer backend.

## What works in this starter
- Real Three.js 3D first-person environment.
- WASD movement, mouse look, pointer lock, sprint and crouch.
- 3D player avatars synchronized between connected browsers.
- Public quick-join and private room codes.
- Lobby player list and in-game chat.
- Round/preparation/action state timer.
- Basic server-validated room/team/phase damage events.
- Deployable as one Node web service, including Socket.IO.

## Run locally
Requires Node.js 18+.

```bash
npm install
npm start
```

Open http://localhost:3000 in multiple browser tabs. For testing movement and multiplayer, use different tabs or devices on the same network. For true internet play, deploy the server publicly.

## Deploy publicly (single-service approach)
1. Push this folder to a GitHub repository.
2. Create a new **Web Service** on Render (or Railway) connected to that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Set Node version to 18 or newer if the host asks.
6. Deploy. Open the generated HTTPS URL and share it with friends.
7. The frontend and Socket.IO backend are served from the same host, so no separate frontend URL or CORS configuration is needed.

## Important prototype limitations
This is a playable multiplayer foundation, not a finished competitive Siege-scale game. The starter has a compact arena, basic player capsules, a simple hitscan hit request, and round timing. It does **not** yet implement production-grade server-side physics/raycast validation, anti-cheat, persistent accounts, matchmaking at scale, full 5v5 balancing, operator gadgets, advanced destruction, voice chat, or polished animation/audio. Those need to be added and tested before treating it as a public competitive game.

## Next development milestones
1. Server-authoritative movement and collision/physics.
2. Server-side hit validation using synchronized aim and positions.
3. Proper team assignment and match lifecycle.
4. Destructible wall state replicated to all clients.
5. Weapon models, recoil, reload, sound, and animations.
6. Operator selection and gadgets.
7. Persistent accounts, friends, and statistics.
