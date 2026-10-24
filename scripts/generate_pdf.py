import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (on pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "YouTube Watch Party System — End-to-End Architecture & Interview Guide")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
            
        # Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 40, page_str)
        self.drawString(54, 40, "Confidential — Candidate Interview Preparation Document")
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(54, 52, 558, 52)
        self.restoreState()

def build_pdf(filename="YouTube_Watch_Party_System_Interview_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#0f172a") # Slate 900
    accent_blue = colors.HexColor("#2563eb")   # Blue 600
    dark_gray = colors.HexColor("#334155")     # Slate 700
    light_bg = colors.HexColor("#f8fafc")      # Slate 50
    border_color = colors.HexColor("#cbd5e1")  # Slate 300
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=accent_blue,
        spaceAfter=15
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=accent_blue,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=dark_gray,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )
    
    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f1f5f9"),
        borderPadding=6,
        spaceAfter=6
    )
    
    qa_q_style = ParagraphStyle(
        'QA_Q',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )

    qa_a_style = ParagraphStyle(
        'QA_A',
        parent=body_style,
        leftIndent=10,
        spaceAfter=8
    )

    story = []
    
    # ─── COVER / HEADER ──────────────────────────────────────────────────────────
    story.append(Paragraph("YouTube Watch Party System", title_style))
    story.append(Paragraph("Full-Stack Architecture, Deep-Dive Security Solves & Senior Interview Guide", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_blue, spaceAfter=12))

    # Meta table
    meta_data = [
        [Paragraph("<b>Candidate:</b> Iranna Aribenchi", body_style), Paragraph("<b>Tech Stack:</b> React 18, TypeScript, Socket.IO, Express", body_style)],
        [Paragraph("<b>Repository:</b> github.com/Iranna0311/YouTube-Watch-Party-System", body_style), Paragraph("<b>Database:</b> Supabase (PostgreSQL)", body_style)],
        [Paragraph("<b>Production URL:</b> youtube-watch-party-system-udjv.onrender.com", body_style), Paragraph("<b>Test Suite:</b> 40 Passing Tests (Vitest)", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[250, 254])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, border_color),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # ─── SECTION 1: ARCHITECTURE OVERVIEW ───────────────────────────────────────
    story.append(Paragraph("1. High-Level Architecture & End-to-End Flow", h1_style))
    story.append(Paragraph(
        "The project enables multiple distributed users to stream YouTube videos in tight frame synchronization (&lt;100ms drift) "
        "governed by a strict Role-Based Access Control (RBAC) hierarchy. The architecture is cleanly divided into an "
        "<b>ephemeral real-time state layer</b> (Socket.IO + in-memory Room domain models) and a <b>durable persistence layer</b> (Supabase PostgreSQL).",
        body_style
    ))
    
    arch_data = [
        [Paragraph("<b>Layer</b>", body_style), Paragraph("<b>Technology</b>", body_style), Paragraph("<b>Responsibility</b>", body_style)],
        [Paragraph("Frontend Client", body_style), Paragraph("React 18, Vite, TypeScript, Tailwind CSS, socket.io-client", body_style), Paragraph("Renders video player, NTP ping sampler, chat panel, suggestion queue, role controls.", body_style)],
        [Paragraph("Real-Time Server", body_style), Paragraph("Node.js, Express, Socket.IO, Zod, Rate Limiter", body_style), Paragraph("Authoritative single source of truth for video position, RBAC checks, broadcast fanout.", body_style)],
        [Paragraph("Persistence DB", body_style), Paragraph("Supabase (Managed PostgreSQL)", body_style), Paragraph("Durable records for created rooms, chat history, and moderation audit trails.", body_style)],
        [Paragraph("Hosting / CDN", body_style), Paragraph("Render (WebSocket Web Service) + Vercel Edge", body_style), Paragraph("Persistent full-duplex TCP connections on Render; global asset caching on Vercel.", body_style)],
    ]
    arch_table = Table(arch_data, colWidths=[90, 150, 264])
    arch_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(arch_table)
    story.append(Spacer(1, 14))

    # ─── SECTION 2: THE 4 CRITICAL VULNERABILITIES SOLVED ────────────────────────
    story.append(Paragraph("2. The 4 Critical Synchronization & Security Bugs Solved", h1_style))
    story.append(Paragraph(
        "Standard YouTube sync projects suffer from subtle concurrency and authentication flaws. Here is how our codebase solves each:",
        body_style
    ))

    bugs_data = [
        [Paragraph("<b>Vulnerability</b>", body_style), Paragraph("<b>Flawed Standard Implementation</b>", body_style), Paragraph("<b>Our Production Solution</b>", body_style)],
        [
            Paragraph("<b>Bug A: Clock Skew & Double-Counting</b>", body_style),
            Paragraph("Server advances currentTime to serverTime, and client adds (Date.now() - updatedAt) again. On every heartbeat, client advances ahead of the host.", body_style),
            Paragraph("<b>NTP Clock Sync:</b> Client measures roundtrip latency and clock offset: &Delta; = t_server - (t0+t1)/2. applySyncState strictly computes authoritative time relative to serverTime + clockOffset.", body_style)
        ],
        [
            Paragraph("<b>Bug B: Reentrancy Lock Deadlock</b>", body_style),
            Paragraph("isRemoteUpdate flag is only cleared inside onStateChange. If player is already in target state, no event fires, permanently locking user controls.", body_style),
            Paragraph("<b>Self-Clearing Cooldown:</b> applySyncState arms a 500ms fallback timeout that forcibly clears isRemoteUpdateRef, ensuring user controls never freeze.", body_style)
        ],
        [
            Paragraph("<b>Bug C: Host Invariant Fracture</b>", body_style),
            Paragraph("Host promotes participant to 'Host' via assignRole. This changes role in map but leaves hostId pointing to old user, fracturing room ownership.", body_style),
            Paragraph("<b>Invariant Enforcement:</b> Room.assignRole explicitly rejects 'Host'. All ownership changes must pass through Room.transferHost() atomically.", body_style)
        ],
        [
            Paragraph("<b>Bug D: Identity Hijacking</b>", body_style),
            Paragraph("join_room reconnects using public userId from participant list. Any malicious participant can replay Host's userId and steal admin privileges.", body_style),
            Paragraph("<b>Cryptographic Session Tokens:</b> Private UUID token generated on connect, stored in memory, and stripped from all public broadcasts. Reclaim requires matching sessionToken.", body_style)
        ],
    ]
    bugs_table = Table(bugs_data, colWidths=[105, 185, 214])
    bugs_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#fee2e2")),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(bugs_table)
    story.append(Spacer(1, 14))

    # ─── SECTION 3: QUEUE AUTO-ADVANCE & DEBOUNCING ──────────────────────────────
    story.append(Paragraph("3. Video Queue Auto-Advance & Anti-Abuse Debouncing", h1_style))
    story.append(Paragraph(
        "<b>The Problem:</b> When a YouTube video finishes, 10+ clients connected to the same room will emit <code>video_ended</code> "
        "at nearly the exact same millisecond. Without deduplication, the server would skip 10 songs ahead in the queue. "
        "Furthermore, malicious Participants could forge <code>video_ended</code> packets to skip songs they dislike.",
        body_style
    ))
    story.append(Paragraph("<b>The Solution in Room.ts:</b>", h2_style))
    story.append(Paragraph(
        "• <b>Role Guard:</b> Only Host or Moderator can trigger queue advances (<code>this.can(userId, 'manage_queue')</code>).<br/>"
        "• <b>State Match:</b> The reported <code>videoId</code> must strictly match <code>this.videoState.videoId</code>.<br/>"
        "• <b>3000ms Time Window Debounce:</b> <code>if (Date.now() - this.lastAdvanceAt &lt; 3000) return null;</code>. "
        "The first valid signal advances the queue and stamps <code>lastAdvanceAt = Date.now()</code>. All subsequent simultaneous client signals are dropped.",
        body_style
    ))
    story.append(Spacer(1, 14))

    # ─── SECTION 4: LOAD TESTING & BENCHMARK MATHEMATICS ────────────────────────
    story.append(Paragraph("4. Concurrency Load-Test Benchmarks & Fanout Mathematics", h1_style))
    story.append(Paragraph(
        "The server was benchmarked using an automated WebSocket load-test suite (<code>npm run test:load</code>) simulating "
        "<b>25 rooms &times; 10 users = 250 concurrent WebSocket connections</b> emitting high-frequency playback barrages:",
        body_style
    ))

    load_data = [
        [Paragraph("<b>Metric</b>", body_style), Paragraph("<b>Measured Result</b>", body_style), Paragraph("<b>Engineering Explanation</b>", body_style)],
        [Paragraph("Connections Attempted / Succeeded", body_style), Paragraph("250 / 250 (100%)", body_style), Paragraph("Zero dropped handshakes or connection timeouts under load.", body_style)],
        [Paragraph("Failures / Dropped Packets", body_style), Paragraph("0 (0.00%)", body_style), Paragraph("Sliding-window token bucket (15 req/s) absorbed valid traffic without dropping.", body_style)],
        [Paragraph("Events Emitted / Received", body_style), Paragraph("325 / 1,975", body_style), Paragraph("Exact deterministic broadcast arithmetic (detailed below).", body_style)],
        [Paragraph("Round-Trip Event Latency", body_style), Paragraph("Avg: 24.89ms | p95: 44ms", body_style), Paragraph("Well within the 100ms threshold for human imperceptible video sync.", body_style)],
        [Paragraph("Server Process Heap Delta", body_style), Paragraph("+7.30 MB (Total: 18.38 MB)", body_style), Paragraph("Queried live via /health endpoint; isolates server memory from test runner.", body_style)],
    ]
    load_table = Table(load_data, colWidths=[130, 120, 254])
    load_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#dcfce7")),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(load_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>The Exact Mathematical Proof for 1,975 Events:</b>", h2_style))
    story.append(Paragraph(
        "1. <b>Initial Room Joins:</b> 25 rooms &times; 9 joiners = <b>225</b> initial sync snapshots.<br/>"
        "2. <b>Playback Action Fanout:</b> 25 hosts each emit 3 actions (play, seek, pause = 75 actions). "
        "For each action, the server broadcasts both the specific event AND the authoritative sync_state snapshot to all 10 room members: "
        "25 &times; 3 &times; 2 &times; 10 = <b>1,500</b> receipts.<br/>"
        "3. <b>NTP Latency Pings:</b> 250 connected sockets each receive 1 ping response = <b>250</b> receipts.<br/>"
        "<b>Total Fanout:</b> 225 + 1,500 + 250 = <b>1,975 receipts</b>.",
        body_style
    ))
    story.append(Spacer(1, 14))

    # ─── SECTION 5: TOP 15 INTERVIEW QUESTIONS & ANSWERS ───────────────────────
    story.append(PageBreak())
    story.append(Paragraph("5. Top 15 Technical Interview Questions & Senior Answers", h1_style))
    story.append(Paragraph("Prepare these answers for technical interviews and architectural code walkthroughs:", body_style))
    story.append(Spacer(1, 6))

    qa_list = [
        (
            "Q1: Why did you choose WebSockets over HTTP polling or Server-Sent Events (SSE)?",
            "A: Video watch parties require full-duplex bidirectional streaming with sub-100ms latency. HTTP polling incurs heavy HTTP header overhead (1KB per poll) and introduces latency intervals. SSE is unidirectional (server-to-client only), requiring separate HTTP POST requests for client actions like seek or pause. WebSockets establish a single persistent TCP connection with a lightweight 2-to-6 byte framing overhead, enabling instantaneous bidirectional broadcast."
        ),
        (
            "Q2: How does the server guarantee it remains the single source of truth for video time?",
            "A: The server maintains an internal VideoState { playState, currentTime, updatedAt }. When playing, the server does not tick an internal timer on every frame; instead, it dynamically computes authoritative time on demand: currentTime + (Date.now() - updatedAt)/1000. Clients never tell the server what time it should be; clients send requests (e.g., 'seek to 45s'), the server validates RBAC permissions, updates its state timestamp, and broadcasts the authoritative snapshot."
        ),
        (
            "Q3: How do you prevent event echo loops when broadcasting playback state?",
            "A: When user A scrubs the player, their client emits a 'seek' event. The server broadcasts this seek to all room participants, including user A. If user A's player blindly reacts to incoming server events, it would fire another seek event, triggering an infinite broadcast loop. We solve this by setting an isRemoteUpdateRef flag before calling player.seekTo(). Additionally, we attach a 500ms self-clearing timer fallback so user controls are never permanently deadlocked if YouTube fails to fire a state change."
        ),
        (
            "Q4: Why does the YouTube IFrame API not provide a native 'seek' event, and how did you detect scrubbing?",
            "A: YouTube's IFrame API only fires onStateChange (PLAYING, PAUSED, BUFFERING, ENDED) without a dedicated onSeek event. To capture scrubbing, our custom hook runs a 500ms polling interval comparing player.getCurrentTime() against the previously recorded time. If the delta exceeds 1.5 seconds while playState remains unchanged, we know the user scrubbed the progress bar and emit a 'seek' event."
        ),
        (
            "Q5: How do you prevent clock drift between clients on different operating systems?",
            "A: Clients may have system clocks skewed by seconds or minutes. Comparing Date.now() directly against the server's updatedAt causes drift. We implement NTP-style clock synchronization: on connect and every 30 seconds, the client emits time_ping with timestamp t0. The server echoes serverTime. Upon response at t1, the client calculates clockOffset = serverTime - (t0 + t1)/2. All elapsed time calculations strictly reference (serverNow = Date.now() + clockOffset)."
        ),
        (
            "Q6: How does your Role-Based Access Control (RBAC) work, and how is it enforced?",
            "A: We use an Object-Oriented Permissions class with a static Map defining allowed actions per role: Host (all permissions, transfer host, kick, assign roles), Moderator (play/pause, seek, change video, manage queue), and Participant (view only). Every socket event passes through room.can(userId, action) before executing. Unauthorized events return an immediate error event. UI buttons are conditionally disabled for UX, but the backend never trusts client-side validation."
        ),
        (
            "Q7: Explain the Bug D vulnerability (Identity Hijacking) and your cryptographic solution.",
            "A: In naive WebSocket watch parties, reconnecting users identify themselves using userId stored in localStorage. However, the participant list broadcasts all userIds publicly. A malicious participant could copy the Host's userId from dev tools, emit join_room with that userId, and take over host privileges. We solved this by issuing a private randomUUID() sessionToken upon room creation. This token is returned exclusively to the socket, never broadcasted, and stripped from toJSON() payloads. Reclaiming a session requires matching both userId and sessionToken."
        ),
        (
            "Q8: What happens when the Host abruptly disconnects or refreshes the page?",
            "A: If the Host loses connection, we don't immediately disband the room or demote them. The server triggers a 10-second grace period timer. If the Host reconnects within 10 seconds presenting their valid sessionToken, they reclaim their Host socket seamlessly. If the timer expires without a reclaim, the server auto-promotes the oldest connected Moderator (or oldest Participant if no moderators exist) and broadcasts the role change and audit log."
        ),
        (
            "Q9: How do you handle kicked or banned users to prevent them from rejoining?",
            "A: When the Host kicks a participant, the server adds their userId to a per-room bannedUserIds Set and forcibly calls socket.disconnect(true). Any subsequent join_room event matching that userId is immediately rejected with an error. In Known Limitations, we acknowledge that in-memory bans can be bypassed if an anonymous user clears localStorage/cookies, and in production, this should be anchored to authenticated user accounts."
        ),
        (
            "Q10: Why do you store room state in-memory rather than querying Supabase on every WebSocket tick?",
            "A: High-frequency video sync events occur hundreds of times per minute across multiple rooms. Writing play/pause/seek ticks to a relational database like PostgreSQL on every second would exhaust database connection pools, introduce 20-50ms disk I/O latency, and create database bottlenecks. The industry standard is keeping real-time sync in-memory/WebSockets and snapshotting durable milestones (room creation, video change, chat, audit logs) to Supabase asynchronously."
        ),
        (
            "Q11: What are the architectural trade-offs of using Socket.IO Redis Adapter for horizontal scaling?",
            "A: @socket.io/redis-adapter uses Redis Pub/Sub to relay broadcasts between multiple Node instances. However, our Room objects and participant Maps live in each server instance's RAM. If User A connects to Instance 1 and creates room 'ABC123', User B connecting to Instance 2 will receive 'Room not found' unless sticky routing (consistent IP or room code hashing at the load balancer) routes all participants of room 'ABC123' to the same instance, or room domain models are externalized to Redis Hashes."
        ),
        (
            "Q12: How do you protect the server from WebSocket flood attacks or DDoS?",
            "A: We implement a two-layer defense: First, every socket connection is bounded by a SocketRateLimiter implementing a sliding-window token bucket capped at 15 requests/second per socket ID. Second, every incoming payload is validated using Zod schemas (validating 11-char YouTube ID regex, finite non-negative seek timestamps, trimmed string lengths). Floods are dropped before touching the Room domain model."
        ),
        (
            "Q13: How did you solve the browser autoplay policy restriction?",
            "A: Modern browsers (Chrome, Safari) block video playback with audio unless preceded by user interaction (gesture/click). If a late-joining participant connects to a room where the video is already playing, calling player.playVideo() directly triggers an unhandled DOMException error. We handle this in React with an overlay 'Click to Join Watch Party' banner, ensuring a valid user gesture enables the YouTube audio context."
        ),
        (
            "Q14: Explain your suggestion queue and approval workflow.",
            "A: Instead of only letting Hosts change videos, Participants can submit video URLs as a change_request. The server stores requests in pendingRequests and broadcasts change_request_received exclusively to staff (Host and Moderators). When approved, the video is added to videoQueue. When the active video ends, tryAdvanceOnVideoEnd automatically plays the next queued video with a 3-second debounce window."
        ),
        (
            "Q15: How does your monolithic Render deployment avoid CORS issues entirely?",
            "A: In production, the compiled server (server/dist/index.js) checks if client/dist exists and serves the built Vite bundle statically via express.static(), paired with an SPA catch-all (app.get('*')). The frontend client connects to window.location.origin (io('/')). Because the frontend and WebSocket backend share the exact same host and port, cross-origin resource sharing (CORS) is eliminated entirely."
        )
    ]

    for q, a in qa_list:
        story.append(Paragraph(q, qa_q_style))
        story.append(Paragraph(a, qa_a_style))
        story.append(Spacer(1, 3))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully created: {filename}")

if __name__ == '__main__':
    output_filename = "YouTube_Watch_Party_System_Interview_Guide.pdf"
    if len(sys.argv) > 1:
        output_filename = sys.argv[1]
    build_pdf(output_filename)

