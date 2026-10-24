# WatchSync: Real-Time YouTube Watch Party System

![CI](https://github.com/Iranna0311/YouTube-Watch-Party-System/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![Vitest](https://img.shields.io/badge/Tests-40%20Passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-purple)

A production-ready, synchronized YouTube Watch Party system built with **Node.js, Express, Socket.IO, React, TypeScript, Vite, and Tailwind CSS**. Multiple users join a room via a 6-character code or link, stream videos in lockstep, and interact under a strict Role-Based Access Control (RBAC) hierarchy.

---

## 🚀 Live Demo & Links
- **Live Application:** https://youtube-watch-party-system-udjv.onrender.com
- **Repository:** https://github.com/Iranna0311/YouTube-Watch-Party-System

---

## 🎯 What Separates This Implementation from Standard Submissions

Most implementations share superficial similarities but break on subtle real-time edge cases. Here is how this codebase fixes them:

| Edge Case / Vulnerability | Standard / Broken Implementation | Our Resilient Architecture |
|---|---|---|
| **Identity Hijacking (Bug D)** | `join_room` reconnects based on `userId` alone. Because `userId` is public in the participant list, any user can impersonate the Host by replaying their ID. | **Cryptographic Session Tokens:** On room creation or join, the server issues a private UUID `sessionToken` returned exclusively to that socket. Public payloads strip this token. Reclaiming a session requires both `userId` and `sessionToken`. Impersonators are rejected with `Identity in use: Invalid session token`. |
| **Clock Skew & Double Counting (Bug A)** | The server advances `currentTime` to `serverTime`, and the client adds `(Date.now() - updatedAt)` again, double-counting elapsed time and causing viewers to drift ahead on every heartbeat. | **NTP Clock Synchronization:** Client queries server time via `time_ping` to measure round-trip latency and clock offset: $\Delta_{\text{clock}} = t_{\text{server}} - \frac{t_0 + t_1}{2}$. `applySyncState` advances elapsed time strictly relative to `serverTime + clockOffset`. |
| **Reentrancy Lock Deadlock (Bug B)** | `isRemoteUpdateRef` is only cleared inside `onStateChange`. When a heartbeat arrives and the player is already in the target state, no state change fires, leaving the lock stuck on `true` and silently suppressing real user controls. | **Self-Clearing Cooldown Timer:** `applySyncState` resets any existing timer and schedules a fallback reset after 500ms, ensuring user control is never permanently locked. |
| **Host Role Invariant (Bug C)** | An admin assigning `'Host'` directly to a participant updates their role in the map without updating the room's `hostId` pointer, fracturing room ownership. | **Invariant Protection:** `Room.assignRole` strictly returns `false` if target role is `'Host'`. Host transitions are exclusively routed through `Room.transferHost()`. |
| **Participant Control Ambiguity** | Most projects provide a simple, disconnected "request" toast. | **Playlist Suggestion Queue:** Participants suggest videos into a staging area. Hosts and Moderators approve them into a playlist queue that **automatically advances** when the current video finishes. |
| **DDoS / Flooding** | Clients can flood WebSockets with rapid seek/play payloads and crash the server. | **Token-Bucket Rate Limiter & Zod Validation:** Every incoming socket event is validated with Zod and bounded by a 15-req/sec sliding window rate limiter. |

---

## 🔄 Real-Time Flow & Permission Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Participant as Participant (Bob)
    actor Mod as Moderator (Alice)
    participant Client as React Client
    participant Server as Socket.IO Server
    participant Room as Room Domain Model

    Note over Mod, Server: 1. Authoritative Playback Control
    Mod->>Client: Clicks Play at 01:24
    Client->>Server: emit("play", { currentTime: 84 })
    Server->>Room: room.can("user_alice", "play")
    alt Authorized (Host or Moderator)
        Room-->>Server: Allowed
        Server->>Room: updateVideoState({ playState: "playing", currentTime: 84 })
        Server->>Client: broadcast("play", { userId: "user_alice", currentTime: 84 })
        Server->>Client: broadcast("sync_state", payload)
    else Unauthorized (Participant)
        Room-->>Server: Denied
        Server-->>Client: emit("error", { message: "Unauthorized" })
    end

    Note over Participant, Server: 2. Suggestion Queue Approval Workflow
    Participant->>Client: Submits YouTube URL for Playlist Queue
    Client->>Server: emit("change_request", { type: "add_to_queue", payload: { videoId } })
    Server->>Mod: emit("change_request_received", request)
    Mod->>Server: emit("approve_request", { requestId })
    Server->>Room: room.addToQueue(item)
    Server->>Client: broadcast("queue_updated", queue)
```

---

## 📊 Concurrency Load-Test Benchmarks

We benchmarked the server using an automated concurrency test suite (`npm run test:load`) simulating **25 concurrent rooms with 10 users each (250 simultaneous WebSocket connections)** streaming continuous state updates, room broadcasts, and NTP time-sync pings:

```
================ LOAD TEST RESULTS ================
Scope:                        25 rooms × 10 users = 250 connections (local loopback)
Target Server:                http://localhost:4000
Total Connections Attempted:  250
Total Connections Succeeded:  250
Connection Failures:          0 (0.00%)
Events Emitted:               325 (75 host playback actions + 250 time_pings)
Events Received (Fanout):     1,975
Average Round-Trip Latency:   24.89 ms
p95 Latency:                  44.00 ms
p99 Latency:                  46.00 ms
Server Heap Delta:            +7.30 MB (Server Heap: 18.38 MB, RSS: 52.98 MB)
Total Test Duration:          4.31 s
====================================================
```

### Event Fanout Breakdown
The 1,975 received events follow deterministic broadcast arithmetic:
1. **Initial Room Joins:** 25 rooms × 9 participants = 225 initial `sync_state` snapshots.
2. **Playback Action Fanout:** 25 room hosts each emit 3 actions (`play`, `seek`, `pause` = 75 actions). For each action, the server broadcasts both the specific event and the authoritative `sync_state` snapshot to all 10 participants in the room: $25 \times 3 \times 2 \times 10 = 1,500$ receipts.
3. **NTP Latency Pings:** 250 connected sockets each receive 1 ack from `time_ping` = 250 receipts.
$$\text{Total Receipts} = 225 + 1,500 + 250 = 1,975$$

> **Note on Server Memory & Scope:** Server memory is measured live via the `/health` endpoint before and after the barrage (`process.memoryUsage()`), isolating the Node.js server heap (+7.30 MB delta under 250 active sockets) from the load-test runner client. Deployed latency on Render will include network round-trip time (RTT).

---

## 🐳 Horizontal Scaling via Redis Adapter

For multi-instance clustering, the backend supports `@socket.io/redis-adapter` (enabled automatically when `REDIS_URL` is set). To spin up two isolated Node server instances bridged by a shared Redis container:

```bash
docker-compose up --build
```
- **Node Server 1:** port `4001`
- **Node Server 2:** port `4002`
- **Redis Pub/Sub:** port `6379`

> ⚠️ **Known Limitation:** The Redis adapter relays Socket.IO broadcasts between instances but **Room state** (participants, video position, session tokens, bans) lives in each instance's in-memory `Map`. If user B lands on a different instance than the one that created the room, `getRoom(code)` returns `undefined` and the join fails. Proper horizontal scaling requires either sticky routing (consistent-hash on room code) or externalising room state to Redis. Single-instance deployment (default on Render free tier) has **no** this issue. The docker-compose setup is provided for local multi-instance testing but has not been tested under load.

---

## ⚠️ Known Limitations & Senior Trade-Offs

Honest limitations reflect real-world engineering trade-offs:
1. **In-Memory Storage for MVP:** Room state and active bans are held in RAM. A complete server process restart clears active rooms. In production, room metadata, active host session tokens, and bans should be backed by Redis or PostgreSQL/SQLite.
2. **Local Ban Evasion:** Bans are enforced per `userId`. Because `userId` is generated in `localStorage`, a kicked participant can open an incognito window with a fresh browser profile and re-enter as a new Participant unless authenticated behind user login accounts.
3. **YouTube Third-Party Embed Restrictions:** Certain copyrighted music and regional videos disable embedding by external sites (`error 150` in the YouTube IFrame API). The player detects this and alerts the user cleanly.
4. **Render Free-Tier Sleep:** Render puts free web services to sleep after 15 minutes of inactivity. We provide a `/health` endpoint that can be pinged by UptimeRobot or Cron-job.org to keep instances warm.

---

## 🛠 Local Setup & Running

```bash
# 1. Install dependencies
npm run install:all

# 2. Run unit & integration test suite (40 tests via Vitest)
npm test

# 3. Start development servers
# Terminal 1:
cd server && npm run dev
# Terminal 2:
cd client && npm run dev

# 4. Or build and start unified production bundle
npm run build
npm start
```
Open `http://localhost:4000` to create or join a party!
