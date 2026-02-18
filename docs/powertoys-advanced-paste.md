# PowerToys Advanced Paste — Complete Configuration Guide

Reference: [Microsoft Learn — Advanced Paste](https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste)

---

## Table of Contents

1. [Installation](#installation)
2. [Enable Advanced Paste](#enable-advanced-paste)
3. [Core Settings](#core-settings)
4. [Configure AI Providers (Ollama)](#1-configure-ai-providers-ollama-in-advanced-paste)
5. [OCR Text Extraction from Images](#2-ocr-text-extraction-from-images)
6. [Audio/Video Transcoding with Advanced Paste](#3-audiovideo-transcoding-with-advanced-paste)
7. [Custom AutoHotkey Scripts to Extend Advanced Paste](#4-custom-autohotkey-scripts-to-extend-advanced-paste)
8. [Local vs Cloud AI Limitations](#5-local-vs-cloud-ai-limitations-in-advanced-paste)
9. [Custom Actions (Saved Prompts)](#create-custom-actions-saved-prompts)
10. [Symphony Integration Flow](#key-symphony-integration-flow)

---

## Installation

Download from [Microsoft Store](https://apps.microsoft.com/detail/XP89DCGQ3K6VLD) or [GitHub Releases](https://github.com/microsoft/PowerToys/releases). Run the installer on your Windows 11 machine. Advanced Paste is bundled — no separate install needed.

## Enable Advanced Paste

1. Open PowerToys Settings (system tray icon or Start > PowerToys)
2. Left panel → **Advanced Paste**
3. Toggle **Enable Advanced Paste** → On
4. Default activation shortcut: `Win+Shift+V`

## Core Settings

| Setting | What It Does | Symphony Use |
|---|---|---|
| Clipboard history | Auto-saves clipboard history | Recall missed captures |
| Custom format preview | Preview output before paste | Verify JSON before POST |
| Paste as plain text shortcut | Strip formatting, paste clean | Clean AI chat text |
| Paste as JSON shortcut | Convert XML/text → JSON | Pre-format before Symphony POST |
| Paste as Markdown shortcut | Convert HTML → Markdown | NotebookLM-ready formatting |
| Image to Text (OCR) | Extract text from clipboard image | Capture screenshots of chats |

## Add AI Model Provider (for Paste with AI)

1. Settings > Advanced Paste > **Model providers** > **Add model**
2. Select provider from dropdown:
   - **Google** (Gemini API key — fits Philharmonic stack)
   - **Ollama** (local, free — runs on your GTX 1080 machine)
   - **Mistral** (online, low cost)
3. Enter API key + endpoint URL → Save
4. Now `Win+Shift+V` → type prompt (e.g., "Summarize this capture for NotebookLM") → paste transformed text

---

## Deep Dive: Five Key Capabilities

### 1. Configure AI Providers (Ollama) in Advanced Paste

**Description:** Ollama runs local LLMs (Llama, Mistral, Phi) on your GTX 1080 machine; plug endpoint into Advanced Paste for free, private, offline AI clipboard transforms with no API key cost.

**Detailed Explanation:**

Open PowerToys Settings > Advanced Paste > Model Providers > Add Model > Select **Ollama** from dropdown. Enter base URL: `http://localhost:11434` (default Ollama port). Select model name (e.g., `llama3.1:8b`, `phi3:mini`, `mistral:7b`). No API key required — Ollama serves locally. Save. Now `Win+Shift+V` > type prompt > Ollama transforms clipboard text on-device. Temperature/context window follows model defaults. Multiple providers can coexist; switch per-session. Gemini API key goes in same panel for cloud fallback.

**Interoperability:** Ollama on GTX 1080 laptop → Advanced Paste transform → AHK `Ctrl+Win+S` → Apps Script receiver → Drive. Fully offline mid-chain.

| | Point |
|---|---|
| Pro | Zero token cost, runs indefinitely on existing hardware |
| Pro | Private — clipboard text never leaves your machine |
| Con | GTX 1080 limits model size; 7-8B models only at reasonable speed |

---

### 2. OCR Text Extraction from Images

**Description:** PowerToys Text Extractor (`Win+Shift+T`) + Advanced Paste Image-to-Text grab any screen region or clipboard image and push extracted text straight into Symphony capture.

**Detailed Explanation:**

Two paths:

1. **Text Extractor** — press `Win+Shift+T`, crosshair overlay appears, drag selection over any screen region (chat screenshot, PDF, locked UI). Text copies to clipboard instantly.
2. **Advanced Paste Image-to-Text** — copy an image to clipboard (screenshot, photo), open `Win+Shift+V`, select "Paste as Text" → OCR runs locally via Windows OCR engine (no internet).

Both outputs land in clipboard ready for `Ctrl+Win+S` Symphony POST. Supports 30+ languages. Works on any app: Claude web, Gemini, PDFs, terminal.

**Interoperability:** Screen OCR → clipboard → AHK Symphony hotkey → Apps Script → Drive Doc. Captures anything visual, zero extra tools.

| | Point |
|---|---|
| Pro | Captures locked/uncopyable text (PDFs, screenshots, browser DRM) |
| Pro | Fully local OCR — Windows built-in engine, no cloud call |
| Con | Handwriting and low-res images reduce accuracy significantly |

---

### 3. Audio/Video Transcoding with Advanced Paste

**Description:** Advanced Paste has no native audio/video transcoding. This is outside its scope — pair with Whisper local transcription or PowerAutomate Desktop for media-to-text pipelines instead.

**Detailed Explanation:**

Advanced Paste is clipboard/text-only — it does not process audio or video files natively. For Symphony audio capture: use **Whisper.cpp** (local, free) on your laptops to transcribe recordings to text, then pipe output to clipboard → AHK POST. PowerAutomate Desktop has a "Run Application" action to trigger Whisper CLI on a file, grab stdout, then HTTP POST to Apps Script receiver. Alternatively, Advanced Paste's AI prompt step can reformat/summarize an already-transcribed text block. The gap is transcription → clipboard handoff, not Advanced Paste itself.

**Interoperability:** Whisper CLI → stdout → clipboard → Advanced Paste AI compress → AHK POST → Drive.

| | Point |
|---|---|
| Pro | Whisper local is free, accurate, runs on your GTX 1080 |
| Pro | PAD handles the CLI trigger visually without extra scripting |
| Con | Advanced Paste adds no value here until text is already in clipboard |

---

### 4. Custom AutoHotkey Scripts to Extend Advanced Paste

**Description:** AHK v2 chains with Advanced Paste via hotkey send — trigger transforms programmatically, intercept clipboard output, then route to Symphony receiver in one keystroke sequence.

**Detailed Explanation:**

AHK v2 cannot call Advanced Paste's internal API directly, but can send its hotkeys (`Win+Shift+V`) as keystrokes to trigger the paste window, then wait for clipboard mutation before firing Symphony POST. Add `ClipboardChanged` hook in AHK to detect when Advanced Paste finishes writing transformed text back to clipboard — then auto-POST without second keypress. Also: use AHK to build a tray menu cycling through saved Advanced Paste custom prompts (Symphony Compress, NotebookLM Format, Philharmonic Tag) mapped to `Ctrl+1/2/3` for one-key context switches.

**Interoperability:** AHK ClipboardChanged → detect Advanced Paste output → immediate Symphony POST — full chain, single `Ctrl+Win+S` press.

| | Point |
|---|---|
| Pro | Eliminates manual two-step (paste → copy → POST) |
| Pro | Tray menu for prompt switching costs ~20 lines of AHK |
| Con | `Win+Shift+V` send can conflict if PowerToys shortcut is remapped |

---

### 5. Local vs Cloud AI Limitations in Advanced Paste

**Description:** Local (Ollama/GTX 1080) = private, free, slower, small models. Cloud (Gemini/OpenAI) = faster, smarter, costs tokens, clipboard text leaves device. Choose per sensitivity.

**Detailed Explanation:**

- **Local (Ollama):** Limited to models your hardware can run (7-8B on GTX 1080 16GB VRAM); no internet needed; latency 2-8s per transform; no token cost; clipboard data stays on-device.
- **Cloud (Gemini/OpenAI/Azure):** Full model capability (Gemini 2.0, GPT-4o); sub-second transforms; costs API tokens per call; clipboard content sent to Google/OpenAI servers — privacy tradeoff.
- **Hybrid:** Advanced Paste supports multiple providers simultaneously; route sensitive captures (Strategy/Architecture) to Ollama, general Inbox captures to Gemini for speed. No automatic routing — user selects per session.

**Interoperability:** Strategy/Architecture clips → Ollama (private) → Symphony. Inbox/Context → Gemini (fast) → Symphony. Dual-path matches your Drive category fork model.

| | Point |
|---|---|
| Pro | Hybrid model matches Symphony's 5-category sensitivity tiers exactly |
| Pro | Gemini API key already in Philharmonic stack — reuse same credential |
| Con | No automatic provider routing per category — manual switch or AHK workaround needed |

---

## Create Custom Actions (Saved Prompts)

Settings > Advanced Paste > **Actions** > **Add action**:

- **Name:** Symphony Compress
- **Prompt:** `Summarize this AI dialogue in 3 bullet points, plain text, no formatting`
- **Assign hotkey:** e.g., `Ctrl+Shift+1`
- **Invoke without opening window** — fires directly to clipboard, then `Ctrl+Win+S` to Symphony receiver

## Key Symphony Integration Flow

```
Win+Shift+V (Advanced Paste)
  → AI compress/format clipboard
    → Ctrl+Win+S (AHK Symphony)
      → category picker
        → Apps Script POST
          → Drive Doc
```

All local processing; no extra server.
