# PowerToys Advanced Paste — Full Setup & Symphony Integration

## Install PowerToys

Download from **Microsoft Store** or [GitHub releases](https://github.com/microsoft/PowerToys/releases).
Run installer on Lenovo Yoga 7 or HP nvx360. Advanced Paste is bundled.

## Enable Advanced Paste

1. Open PowerToys Settings (system tray icon or Start > PowerToys)
2. Left panel > **Advanced Paste**
3. Toggle **Enable Advanced Paste** > On
4. Default shortcut: **Win+Shift+V**

---

## Core Settings

| Setting | What It Does | Symphony Use |
|---|---|---|
| Clipboard history | Auto-saves clipboard history | Recall missed captures |
| Custom format preview | Preview output before paste | Verify JSON before POST |
| Paste as plain text | Strip formatting, paste clean | Clean AI chat text |
| Paste as JSON | Convert XML/text to JSON | Pre-format before Symphony POST |
| Paste as Markdown | Convert HTML to Markdown | NotebookLM-ready formatting |
| Image to Text (OCR) | Extract text from clipboard image | Capture screenshots of chats |

---

## 1. Configure AI Providers (Ollama on GTX 1080)

Ollama runs local LLMs (Llama, Mistral, Phi) on the GTX 1080 machine. Free,
private, offline AI clipboard transforms with no API key cost.

### Setup

1. Settings > Advanced Paste > **Model Providers** > **Add Model**
2. Select **Ollama** from dropdown
3. Enter base URL: `http://localhost:11434` (default Ollama port)
4. Select model name (e.g., `llama3.1:8b`, `phi3:mini`, `mistral:7b`)
5. No API key required — Ollama serves locally
6. Save

Multiple providers can coexist. Add **Gemini** as cloud fallback:

1. Settings > Advanced Paste > Model Providers > Add Model
2. Select **Google** (Gemini API key — same key from Philharmonic stack)
3. Enter API key > Save

Now **Win+Shift+V** > type prompt > local or cloud AI transforms clipboard text.

### Interoperability

Ollama on GTX 1080 > Advanced Paste transform > AHK `Ctrl+Win+S` >
Apps Script receiver > Drive. Fully offline mid-chain.

- Zero token cost, runs indefinitely on existing hardware
- Private — clipboard text never leaves machine
- GTX 1080 limits model size; 7-8B models only at reasonable speed

---

## 2. OCR Text Extraction from Images

PowerToys Text Extractor (`Win+Shift+T`) + Advanced Paste Image-to-Text grab
any screen region or clipboard image and push extracted text into Symphony.

### Two Paths

**Path 1 — Text Extractor:**
Press `Win+Shift+T`, crosshair overlay appears, drag selection over any screen
region (chat screenshot, PDF, locked UI). Text copies to clipboard instantly.

**Path 2 — Advanced Paste Image-to-Text:**
Copy an image to clipboard (screenshot, photo), open `Win+Shift+V`, select
"Paste as Text" > OCR runs locally via Windows OCR engine (no internet).

### Interoperability

Screen OCR > clipboard > AHK Symphony hotkey > Apps Script > Drive Doc.
Captures anything visual, zero extra tools.

- Captures locked/uncopyable text (PDFs, screenshots, browser DRM)
- Fully local OCR — Windows built-in engine, no cloud call
- Handwriting and low-res images reduce accuracy significantly

---

## 3. Audio/Video Transcoding

Advanced Paste has **no native audio/video transcoding**. Pair with Whisper
for media-to-text pipelines.

### Workaround Pipeline

1. **Whisper.cpp** (local, free) on GTX 1080 transcribes audio to text
2. Output goes to clipboard
3. Advanced Paste AI prompt step reformats/summarizes the transcript
4. AHK POST sends to Symphony

PowerAutomate Desktop can trigger Whisper CLI on a file, grab stdout,
then HTTP POST to Apps Script receiver.

### Interoperability

Whisper CLI > stdout > clipboard > Advanced Paste AI compress > AHK POST > Drive.

- Whisper local is free, accurate, runs on GTX 1080
- PAD handles the CLI trigger visually without extra scripting
- Advanced Paste adds no value until text is already in clipboard

---

## 4. Custom AutoHotkey Extensions

AHK v2 chains with Advanced Paste via hotkey send — trigger transforms
programmatically, intercept clipboard output, route to Symphony in one keystroke.

### How It Works

AHK v2 cannot call Advanced Paste's internal API directly, but can send its
hotkeys (`Win+Shift+V`) as keystrokes to trigger the paste window, then wait
for clipboard mutation before firing Symphony POST.

### ClipboardChanged Auto-POST

Add `ClipboardChanged` hook in AHK to detect when Advanced Paste finishes
writing transformed text back to clipboard — then auto-POST without second
keypress. See `symphony-advanced-paste.ahk` for the full implementation.

### Tray Menu Prompt Switching

Build an AHK tray menu cycling through saved Advanced Paste custom prompts
(Symphony Compress, NotebookLM Format, Philharmonic Tag) mapped to
`Ctrl+1/2/3` for one-key context switches.

### Interoperability

AHK ClipboardChanged > detect Advanced Paste output > immediate Symphony POST.
Full chain, single `Ctrl+Win+S` press.

- Eliminates manual two-step (paste > copy > POST)
- Tray menu for prompt switching costs ~20 lines of AHK
- `Win+Shift+V` send can conflict if PowerToys shortcut is remapped

---

## 5. Local vs Cloud AI Tradeoffs

| | Local (Ollama/GTX 1080) | Cloud (Gemini/OpenAI) |
|---|---|---|
| Models | 7-8B max on 16GB VRAM | Full capability (Gemini 2.5, GPT-4o) |
| Speed | 2-8s per transform | Sub-second |
| Cost | Free | API tokens per call |
| Privacy | Clipboard stays on-device | Sent to provider servers |
| Internet | Not needed | Required |

**Hybrid strategy:** Advanced Paste supports multiple providers simultaneously.
Route sensitive captures (Strategy/Architecture) to Ollama, general Inbox
captures to Gemini for speed. No automatic routing — manual switch or AHK
workaround needed.

### Interoperability

Strategy/Architecture clips > Ollama (private) > Symphony.
Inbox/Context clips > Gemini (fast) > Symphony.
Dual-path matches the 5-category Drive fork model.

- Hybrid model matches Symphony's 5-category sensitivity tiers exactly
- Gemini API key already in Philharmonic stack — reuse same credential
- No automatic provider routing per category — manual switch or AHK workaround

---

## 6. Create Custom Actions (Saved Prompts)

Settings > Advanced Paste > **Actions** > **Add action**:

### Symphony Compress
- **Name:** Symphony Compress
- **Prompt:** Summarize this AI dialogue in 3 bullet points, plain text, no formatting
- **Hotkey:** `Ctrl+Shift+1`

### NotebookLM Format
- **Name:** NotebookLM Format
- **Prompt:** Convert this to clean Markdown suitable for a NotebookLM source document
- **Hotkey:** `Ctrl+Shift+2`

### Legal Extract
- **Name:** Legal Extract
- **Prompt:** Extract key facts, dates, names, and legal claims from this text as a bullet list
- **Hotkey:** `Ctrl+Shift+3`

Invoke without opening window — fires directly to clipboard, then
`Ctrl+Win+S` to Symphony receiver.

---

## Full Integration Flow

```
Win+Shift+V (Advanced Paste)
  > AI compress/format clipboard
    > Ctrl+Win+S (AHK Symphony)
      > category picker
        > Apps Script POST
          > Drive Doc
```

All local processing; no extra server.

Source: [Microsoft Learn — Advanced Paste](https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste)
