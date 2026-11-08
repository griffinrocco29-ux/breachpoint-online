const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 20000
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}
function getRoom(code) {
  return rooms.get(code);
}
function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, team: p.team,
    x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch,
    health: p.health, alive: p.alive, weapon: p.weapon
  }));
}
function emitState(code) {
  const room = getRoom(code);
  if (!room) return;
  io.to(code).emit("room-state", {
    code, phase: room.phase, round: room.round,
    timeLeft: room.timeLeft, players: publicPlayers(room)
  });
}
function createRoom(ownerId, isPrivate = false) {
  let code;
  do { code = makeCode(); } while (rooms.has(code));
  const room = {
    code, private: isPrivate, phase: "LOBBY", round: 1,
    timeLeft: 30, players: new Map(), ownerId,
    interval: null
  };
  rooms.set(code, room);
  return room;
}
function assignTeam(room) {
  const attackers = [...room.players.values()].filter(p => p.team === "ATTACK");
  const defenders = [...room.players.values()].filter(p => p.team === "DEFEND");
  return attackers.length <= defenders.length ? "ATTACK" : "DEFEND";
}
function startRound(room) {
  room.phase = "PREP";
  room.timeLeft = 15;
  room.round += room.round === 1 && room.players.size ? 0 : 0;
  for (const p of room.players.values()) {
    p.health = 100; p.alive = true;
    p.x = p.team === "ATTACK" ? -12 : 12;
    p.y = 1.7; p.z = (Math.random() - .5) * 5;
  }
  clearInterval(room.interval);
  room.interval = setInterval(() => {
    if (!rooms.has(room.code)) return;
    room.timeLeft--;
    if (room.timeLeft <= 0) {
      if (room.phase === "PREP") { room.phase = "ACTION"; room.timeLeft = 180; }
      else if (room.phase === "ACTION") { room.phase = "END"; room.timeLeft = 8; }
      else { room.round++; startRound(room); }
    }
    emitState(room.code);
  }, 1000);
  emitState(room.code);
}

io.on("connection", socket => {
  socket.on("create-room", ({ name, isPrivate } = {}, cb = () => {}) => {
    const room = createRoom(socket.id, !!isPrivate);
    const player = {
      id: socket.id, name: String(name || "Operator").slice(0, 16),
      team: "ATTACK", x: -12, y: 1.7, z: 0, yaw: 0, pitch: 0,
      health: 100, alive: true, weapon: "RIFLE"
    };
    room.players.set(socket.id, player);
    socket.join(room.code);
    cb({ ok: true, code: room.code, playerId: socket.id });
    emitState(room.code);
  });

  socket.on("quick-join", ({ name } = {}, cb = () => {}) => {
    let room = [...rooms.values()].find(r => !r.private && r.phase === "LOBBY" && r.players.size < 10);
    if (!room) room = createRoom(socket.id, false);
    const player = {
      id: socket.id, name: String(name || "Operator").slice(0, 16),
      team: assignTeam(room), x: 12, y: 1.7, z: (Math.random() - .5) * 5,
      yaw: Math.PI, pitch: 0, health: 100, alive: true, weapon: "RIFLE"
    };
    room.players.set(socket.id, player);
    socket.join(room.code);
    cb({ ok: true, code: room.code, playerId: socket.id });
    emitState(room.code);
  });

  socket.on("join-room", ({ code, name } = {}, cb = () => {}) => {
    code = String(code || "").toUpperCase().trim();
    const room = getRoom(code);
    if (!room) return cb({ ok: false, error: "Room not found." });
    if (room.players.size >= 10) return cb({ ok: false, error: "Room is full." });
    const player = {
      id: socket.id, name: String(name || "Operator").slice(0, 16),
      team: assignTeam(room), x: 12, y: 1.7, z: (Math.random() - .5) * 5,
      yaw: Math.PI, pitch: 0, health: 100, alive: true, weapon: "RIFLE"
    };
    room.players.set(socket.id, player);
    socket.join(code);
    cb({ ok: true, code, playerId: socket.id });
    emitState(code);
  });

  socket.on("start-match", ({ code } = {}) => {
    const room = getRoom(String(code || "").toUpperCase());
    if (!room || room.ownerId !== socket.id || room.players.size < 1) return;
    room.round = 1;
    startRound(room);
  });

  socket.on("player-update", data => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
    p.x = clamp(data.x, -22, 22);
    p.y = clamp(data.y, 0.5, 5);
    p.z = clamp(data.z, -16, 16);
    p.yaw = clamp(data.yaw, -1000, 1000);
    p.pitch = clamp(data.pitch, -1.55, 1.55);
    p.weapon = "RIFLE";
    socket.to(room.code).volatile.emit("player-moved", {
      id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch
    });
  });

  socket.on("fire", ({ targetId } = {}) => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.phase !== "ACTION") return;
    const shooter = room.players.get(socket.id);
    const target = room.players.get(targetId);
    if (!shooter || !target || !target.alive || target.team === shooter.team) return;
    // Starter implementation: server validates room, phase, life state and opposing team.
    // Upgrade with server-side ray/physics validation before public competitive use.
    target.health = Math.max(0, target.health - 34);
    if (target.health === 0) target.alive = false;
    io.to(room.code).emit("shot-result", {
      shooterId: socket.id, targetId, health: target.health, alive: target.alive
    });
    emitState(room.code);
  });

  socket.on("chat", ({ code, message } = {}) => {
    const room = getRoom(String(code || "").toUpperCase());
    const player = room && room.players.get(socket.id);
    if (!player) return;
    io.to(room.code).emit("chat", {
      name: player.name, message: String(message || "").slice(0, 180)
    });
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      if (room.players.delete(socket.id)) {
        io.to(code).emit("player-left", { id: socket.id });
        if (room.players.size === 0) {
          clearInterval(room.interval);
          rooms.delete(code);
        } else {
          if (room.ownerId === socket.id) room.ownerId = room.players.keys().next().value;
          emitState(code);
        }
      }
    }
  });
});

server.listen(PORT, () => console.log(`Breachpoint running on ${PORT}`));
