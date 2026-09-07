; ============================================================================
; QUAD COMMANDER — fire one stored prompt into four AI agents
; AHK v2 — companion to symphony-advanced-paste.ahk (which owns Ctrl+Win keys;
;          this script owns Ctrl+Alt keys — no collisions)
; ============================================================================
; THE IDEA:
;   Four agent chats live on screen — either 4 browser WINDOWS snapped into
;   the 4 quadrants of the laptop screen, or 4 TABS in one browser.
;   A prompt sits in a plain text file. You hit one key and the prompt is
;   pasted into the next agent. Hit it again — next agent. Or blast all 4.
;   Any outside app (the Grok-built launcher, Claude, a script) can drop
;   prompt files into the queue folder and this script fires them in order.
;
; SETUP (one time per session):
;   QUADRANT MODE:  focus each agent's browser window, press
;                   Ctrl+Alt+Shift+1 (then 2, 3, 4 on the other windows).
;                   Then Ctrl+Alt+Q snaps all four into quadrants.
;   TAB MODE:       put the 4 agent tabs FIRST in one browser window
;                   (tab positions 1-4), focus that window, press
;                   Ctrl+Alt+Shift+0. Done.
;
; FIRE:
;   Ctrl+Alt+Space   = send prompt to the NEXT agent (1 -> 2 -> 3 -> 4 -> 1)
;   Ctrl+Alt+1..4    = send prompt to that specific agent
;   Ctrl+Alt+A       = broadcast: send to ALL four, one after another
;   Ctrl+Alt+0       = reset the cycle back to agent 1
;
; PROMPT:
;   Ctrl+Alt+P       = open the prompt file in Notepad to edit it
;   The prompt is re-read from disk on EVERY fire — edit it anytime,
;   no reload needed.
;   QUEUE: if any .txt files exist in the queue\ folder, each fire consumes
;   the OLDEST one instead of prompt.txt (used file moves to queue\sent\).
;   That folder is the integration point for the launcher app.
;
; OTHER:
;   Ctrl+Alt+Q       = snap the 4 registered windows into screen quadrants
;   Ctrl+Alt+H       = show status (mode, agents, queue depth, next agent)
;   Ctrl+Alt+R       = reload this script
;
; REQUIRES: AutoHotkey v2.0+  (https://www.autohotkey.com)
; ============================================================================

#Requires AutoHotkey 2.0+
#SingleInstance Force
Persistent

; ============================================================================
; CONFIGURATION — edit these if you want, defaults are sane
; ============================================================================

; Press Enter automatically after pasting? true = prompt is SENT to the agent.
; false = prompt is pasted but you hit Enter yourself (safer while testing).
global SEND_ENTER := true

; Milliseconds to wait after activating a window before pasting.
; Raise this (e.g. 600) if pastes land in the wrong place on a slow machine.
global FOCUS_DELAY := 350

; Milliseconds between agents during a Ctrl+Alt+A broadcast.
global BROADCAST_GAP := 900

; Click into the chat box before pasting? Most AI chat sites keep keyboard
; focus in the input box, so pasting just works. If an agent site loses
; focus, set this true — it clicks near the bottom-center of the window
; (where every major chat UI puts its input box) before pasting.
global CLICK_TO_FOCUS := false

; Where the prompt lives. Default: prompt.txt next to this script.
global PROMPT_FILE := A_ScriptDir "\prompt.txt"

; Queue folder — outside apps drop numbered .txt prompts here.
global QUEUE_DIR := A_ScriptDir "\queue"
global SENT_DIR := A_ScriptDir "\queue\sent"

; ============================================================================
; STATE
; ============================================================================

global MODE := "quadrant"          ; "quadrant" (4 windows) or "tabs" (1 window)
global AGENTS := Map()             ; slot (1-4) -> window handle
global TAB_WINDOW := 0             ; the one browser window in tab mode
global NEXT_SLOT := 1              ; round-robin pointer

; Create the working files/folders on first run
if !FileExist(PROMPT_FILE)
    FileAppend "Type your prompt here, save, then hit Ctrl+Alt+Space.", PROMPT_FILE
if !DirExist(QUEUE_DIR)
    DirCreate QUEUE_DIR
if !DirExist(SENT_DIR)
    DirCreate SENT_DIR

TrayTip "Quad Commander armed", "Ctrl+Alt+H for status. Register agents with Ctrl+Alt+Shift+1..4 (or Shift+0 for tab mode).", 1
SetTimer () => TrayTip(), -4000

; ============================================================================
; REGISTRATION
; ============================================================================

^!+1:: RegisterAgent(1)
^!+2:: RegisterAgent(2)
^!+3:: RegisterAgent(3)
^!+4:: RegisterAgent(4)

RegisterAgent(slot) {
    global AGENTS, MODE
    hwnd := WinGetID("A")
    if !hwnd {
        Flash("No active window to register.")
        return
    }
    AGENTS[slot] := hwnd
    MODE := "quadrant"
    Flash("Agent " slot " = " CleanTitle(hwnd))
}

; Tab mode: register the single browser window that holds tabs 1-4
^!+0:: {
    global TAB_WINDOW, MODE
    TAB_WINDOW := WinGetID("A")
    if !TAB_WINDOW {
        Flash("No active window to register.")
        return
    }
    MODE := "tabs"
    Flash("TAB MODE: agents = tabs 1-4 of " CleanTitle(TAB_WINDOW))
}

; ============================================================================
; QUADRANT SNAP — arrange the 4 registered windows on screen
; ============================================================================

^!q:: {
    global AGENTS
    if (AGENTS.Count < 4) {
        Flash("Only " AGENTS.Count "/4 agents registered — use Ctrl+Alt+Shift+1..4 first.")
        return
    }
    MonitorGetWorkArea(MonitorGetPrimary(), &L, &T, &R, &B)
    w := (R - L) // 2
    h := (B - T) // 2
    pos := Map(1, [L, T], 2, [L + w, T], 3, [L, T + h], 4, [L + w, T + h])
    snapped := 0
    for slot, hwnd in AGENTS {
        if WinExist("ahk_id " hwnd) {
            WinRestore "ahk_id " hwnd
            WinMove pos[slot][1], pos[slot][2], w, h, "ahk_id " hwnd
            snapped++
        }
    }
    Flash(snapped "/4 windows snapped: 1=top-left 2=top-right 3=bottom-left 4=bottom-right")
}

; ============================================================================
; FIRING
; ============================================================================

^!Space:: {
    global NEXT_SLOT
    FireAt(NEXT_SLOT)
    NEXT_SLOT := Mod(NEXT_SLOT, 4) + 1
}

^!1:: FireAt(1)
^!2:: FireAt(2)
^!3:: FireAt(3)
^!4:: FireAt(4)

^!0:: {
    global NEXT_SLOT
    NEXT_SLOT := 1
    Flash("Cycle reset — next fire goes to agent 1.")
}

; Broadcast to all four, in order
^!a:: {
    prompt := NextPrompt()
    if (prompt = "") {
        Flash("Prompt file is empty and queue is empty — nothing to send.")
        return
    }
    sent := 0
    Loop 4 {
        if DeliverTo(A_Index, prompt) {
            sent++
            Sleep BROADCAST_GAP
        }
    }
    Flash("Broadcast done — reached " sent "/4 agents.")
}

FireAt(slot) {
    prompt := NextPrompt()
    if (prompt = "") {
        Flash("Prompt file is empty and queue is empty — nothing to send.")
        return
    }
    if DeliverTo(slot, prompt)
        Flash("Sent to agent " slot ".")
}

; ============================================================================
; DELIVERY MECHANICS
; ============================================================================

DeliverTo(slot, prompt) {
    global MODE, AGENTS, TAB_WINDOW, FOCUS_DELAY, CLICK_TO_FOCUS, SEND_ENTER

    if (MODE = "tabs") {
        if (!TAB_WINDOW || !WinExist("ahk_id " TAB_WINDOW)) {
            Flash("Tab-mode browser window is gone — re-register with Ctrl+Alt+Shift+0.")
            return false
        }
        WinActivate "ahk_id " TAB_WINDOW
        if !WinWaitActive("ahk_id " TAB_WINDOW, , 3) {
            Flash("Could not focus the browser window.")
            return false
        }
        Send "^" slot          ; Ctrl+1..4 jumps to tab N in Chrome/Edge/Firefox
        Sleep FOCUS_DELAY
    } else {
        if (!AGENTS.Has(slot)) {
            Flash("Agent " slot " not registered — focus its window, press Ctrl+Alt+Shift+" slot ".")
            return false
        }
        hwnd := AGENTS[slot]
        if !WinExist("ahk_id " hwnd) {
            Flash("Agent " slot " window was closed — re-register it.")
            return false
        }
        WinActivate "ahk_id " hwnd
        if !WinWaitActive("ahk_id " hwnd, , 3) {
            Flash("Could not focus agent " slot ".")
            return false
        }
        Sleep FOCUS_DELAY
    }

    if CLICK_TO_FOCUS {
        WinGetPos , , &ww, &wh, "A"
        Click ww // 2, wh - 120        ; bottom-center = chat input on every major AI site
        Sleep 150
    }

    ; Paste via clipboard, then restore whatever was on the clipboard before
    saved := ClipboardAll()
    A_Clipboard := prompt
    if !ClipWait(2) {
        A_Clipboard := saved
        Flash("Clipboard busy — try again.")
        return false
    }
    Send "^v"
    Sleep 250
    if SEND_ENTER
        Send "{Enter}"
    Sleep 150
    A_Clipboard := saved
    return true
}

; ============================================================================
; PROMPT SOURCE — queue first, prompt.txt as the fallback
; ============================================================================

NextPrompt() {
    global QUEUE_DIR, SENT_DIR, PROMPT_FILE
    ; Oldest queue file wins (sorted by name — number your files: 01.txt, 02.txt…)
    names := []
    Loop Files QUEUE_DIR "\*.txt"
        names.Push(A_LoopFileName)
    if (names.Length > 0) {
        low := names[1]
        for n in names
            if (StrCompare(n, low, "Logical") < 0)
                low := n
        text := Trim(FileRead(QUEUE_DIR "\" low), " `t`r`n")
        try FileMove QUEUE_DIR "\" low, SENT_DIR "\" A_Now "-" low, 1
        return text
    }
    if FileExist(PROMPT_FILE)
        return Trim(FileRead(PROMPT_FILE), " `t`r`n")
    return ""
}

^!p:: Run 'notepad.exe "' PROMPT_FILE '"'

; ============================================================================
; STATUS / UTILITY
; ============================================================================

^!h:: {
    global MODE, AGENTS, TAB_WINDOW, NEXT_SLOT, QUEUE_DIR
    q := 0
    Loop Files QUEUE_DIR "\*.txt"
        q++
    msg := "MODE: " MODE "`n"
    if (MODE = "tabs") {
        msg .= "Browser: " (TAB_WINDOW && WinExist("ahk_id " TAB_WINDOW) ? CleanTitle(TAB_WINDOW) : "NOT SET — Ctrl+Alt+Shift+0") "`n"
    } else {
        Loop 4 {
            s := A_Index
            msg .= "Agent " s ": " (AGENTS.Has(s) && WinExist("ahk_id " AGENTS[s]) ? CleanTitle(AGENTS[s]) : "not registered") "`n"
        }
    }
    msg .= "Next fire -> agent " NEXT_SLOT "`n"
    msg .= "Queue: " q " prompt(s) waiting" (q ? " (queue fires before prompt.txt)" : "") "`n"
    msg .= "Auto-Enter: " (SEND_ENTER ? "ON" : "OFF (paste only)")
    Flash(msg, 5000)
}

^!r:: Reload

CleanTitle(hwnd) {
    t := ""
    try t := WinGetTitle("ahk_id " hwnd)
    return (StrLen(t) > 60) ? SubStr(t, 1, 57) "..." : t
}

Flash(text, ms := 2500) {
    ToolTip text
    SetTimer () => ToolTip(), -ms
}
