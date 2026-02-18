# Filesystem Map

All pipelines use **Firebase/Gemini API** (NOT Vertex AI).
Assets save **locally** — you keep them when trial ends.

```
chanfana-openapi-template/
│
├── setup/
│   ├── config-templates/
│   │   ├── claude_desktop_config.json    ← MCP config (Firebase, no Vertex)
│   │   ├── firebase.env.example          ← Core Firebase/Gemini env vars
│   │   ├── discord-bot.env.example       ← Discord bot env vars
│   │   ├── notebooklm-mcp.env.example   ← NotebookLM MCP auth
│   │   ├── googledrivemcp.env.example    ← Google Drive MCP auth
│   │   ├── open-notebook.env.example     ← Open Notebook fallback
│   │   └── nblm.env.example              ← nblm SDK config
│   │
│   ├── discord-bot/                       ← Go Discord Bot
│   │   ├── go.mod                         ← Module definition
│   │   ├── main.go                        ← Entry point, event handlers
│   │   ├── config.go                      ← Config from env (Firebase, no Vertex)
│   │   ├── agents.go                      ← 8 AI slots + 1 human pool
│   │   ├── whisper.go                     ← Whisper STT (local, no cloud)
│   │   ├── channels.go                    ← Auto-create Discord channels
│   │   └── commands.go                    ← /audiobook /storyboard /veo /agents
│   │
│   ├── audiobook-pipeline/                ← Full Audiobook Creator
│   │   ├── go.mod                         ← Module definition
│   │   ├── pipeline.go                    ← Orchestrator: story→board→narrate→score→assemble
│   │   ├── story_builder.go              ← Story gen via Gemini API
│   │   ├── storyboard.go                 ← Panel imagery via Imagen (Firebase)
│   │   ├── narrator.go                   ← TTS narration via Chirp (Firebase)
│   │   ├── scorer.go                     ← Background music via Lyria (Firebase)
│   │   ├── assembler.go                  ← FFmpeg assembly (narration + score + video)
│   │   ├── assets.go                     ← Local asset manager (you keep files)
│   │   └── gemini_client.go              ← Firebase/Gemini REST client (NOT Vertex)
│   │
│   ├── veo-flow/                          ← Veo 3.1 Video Pipeline
│   │   ├── flow_config.json              ← Veo defaults + pipeline modes
│   │   └── veo_pipeline.go               ← Video gen via Veo 3.1 (Firebase)
│   │
│   └── repos/                             ← Git submodules
│       ├── notebooklm-mcp-secure/        ← NotebookLM MCP (Pantheon Security)
│       ├── googleDriveMCP/               ← Google Drive MCP
│       ├── open-notebook/                ← Self-hosted NotebookLM alternative
│       ├── AHK_Multi_Clipboard/          ← AHK multi-clipboard (5 slots)
│       └── nblm-rs/                      ← nblm CLI/SDK
│
├── generated/                             ← ALL ARTIFACTS SAVE HERE (local, you keep)
│   ├── images/                           ← Imagen output
│   ├── video/                            ← Veo 3.1 output
│   ├── music/                            ← Lyria output
│   ├── tts/                              ← Chirp TTS output
│   ├── av/                               ← AV tool output
│   ├── storyboards/                      ← Storyboard panel sets
│   ├── audiobooks/                       ← Full audiobook projects
│   │   └── {title}/
│   │       ├── story.md                  ← Full story text
│   │       ├── story_meta.json           ← Chapter metadata
│   │       ├── panels/                   ← Storyboard images
│   │       ├── narration/                ← Chapter audio files
│   │       ├── score/                    ← Background music
│   │       └── final/                    ← Assembled audiobook + slideshow
│   └── transcripts/                      ← Whisper transcriptions
│
├── docs/
│   ├── notebooklm-claude-mcp-integration.md
│   └── powertoys-advanced-paste.md
│
├── src/                                   ← Chanfana OpenAPI worker (Cloudflare)
├── tests/
├── migrations/
└── FILESYSTEM.md                          ← THIS FILE
```

## Key Architecture Decisions

| Decision | Choice | Why |
|---|---|---|
| AI Backend | Firebase/Gemini API | Free tier, no Vertex billing, artifacts persist |
| Asset Storage | Local `./generated/` | You keep files when trial ends |
| Discord Bot | Go (discordgo) | Fast, single binary, matches MCP Go tools |
| Voice-to-Text | Whisper (local) | Free, private, runs on CPU or GTX 1080 |
| TTS | Chirp 3 HD | Best quality via Gemini API |
| Music | Lyria 2 | Background score gen via Gemini API |
| Images | Imagen 3.0 | Storyboard panels via Gemini API |
| Video | Veo 3.1 | Via Gemini API (Firebase, not Vertex) |
| AV Assembly | FFmpeg | Local, no cloud, full control |

## Discord Channel Layout

```
Server
├── #ai-agents              ← 8 AI + 1 human, keyword routing
├── #audiobook-output        ← Generated audiobooks posted here
├── #storyboard-gallery      ← Storyboard panels posted here
├── #veo-renders             ← Veo 3.1 video output
└── whisper (category)
    ├── #whisper-text        ← Transcriptions appear here
    └── whisper-voice        ← Join to record for transcription
```

## Slash Commands

| Command | What It Does |
|---|---|
| `/audiobook <prompt>` | Full pipeline: story → storyboard → narrate → score → assemble |
| `/storyboard <outline>` | Generate visual panels from story outline |
| `/veo <prompt>` | Generate video with Veo 3.1 |
| `/agents` | Show all 8 AI slot statuses |
| `/assign <slot> <role>` | Reassign an AI agent's role |
| `/whisper <audio>` | Transcribe audio with local Whisper |

## Agent Roles (8 Slots)

| Slot | Default Role | What It Does |
|---|---|---|
| 1 | narrator | TTS narration via Chirp |
| 2 | artist | Image gen via Imagen |
| 3 | composer | Music gen via Lyria |
| 4 | editor | AV assembly via FFmpeg |
| 5 | researcher | Research via Gemini |
| 6 | coder | Code gen via Gemini |
| 7 | reviewer | QA/review via Gemini |
| 8 | general | General assistant |
| — | **human** | You (always active) |
