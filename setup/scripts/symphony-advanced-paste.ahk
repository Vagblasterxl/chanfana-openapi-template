; ============================================================================
; Symphony + Advanced Paste + Multi-Clipboard Integration
; AHK v2 — Chains PowerToys Advanced Paste with Symphony capture pipeline
; ============================================================================
; FLOW: Win+Shift+V (Advanced Paste AI transform) → auto-detect clipboard
;       mutation → category picker → Apps Script POST → Drive Doc
;
; HOTKEYS:
;   Ctrl+Win+S        = Symphony capture (manual, with category picker)
;   Ctrl+Win+1-5      = Direct capture to category (skip picker)
;   Ctrl+Win+A        = Advanced Paste → auto-capture chain
;   Ctrl+Win+R        = Reload script
;
; REQUIRES: AutoHotkey v2.0+, PowerToys Advanced Paste enabled
; ============================================================================

#Requires AutoHotkey 2.0+
#SingleInstance Force
Persistent

; ============================================================================
; CONFIGURATION — Edit these values
; ============================================================================

; Your Apps Script Web App URL (Symphony receiver endpoint)
global APPS_SCRIPT_URL := "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"

; Symphony Drive categories (match your 5 Drive folders)
global CATEGORIES := Map(
    1, "Inbox",
    2, "Architecture",
    3, "Strategy",
    4, "Context",
    5, "Archive"
)

; Advanced Paste shortcut (default PowerToys binding)
global ADVANCED_PASTE_KEY := "#+v"  ; Win+Shift+V

; Timeouts
global PASTE_WAIT_MS := 8000        ; Max wait for AI transform (Ollama can be slow)
global CLIPBOARD_POLL_MS := 250     ; How often to check clipboard during wait

; ============================================================================
; TRAY MENU
; ============================================================================

A_TrayMenu.Delete()
A_TrayMenu.Add("Symphony Capture", (*) => ShowCategoryPicker())
A_TrayMenu.Add()
for idx, cat in CATEGORIES
    A_TrayMenu.Add(idx ". " cat, (name, *) => DirectCapture(SubStr(name, 1, 1)))
A_TrayMenu.Add()
A_TrayMenu.Add("Reload", (*) => Reload())
A_TrayMenu.Add("Exit", (*) => ExitApp())
A_TrayMenu.Default := "Symphony Capture"
TraySetIcon("shell32.dll", 172)

; ============================================================================
; HOTKEYS
; ============================================================================

; Ctrl+Win+S — Symphony capture with category picker
^#s:: ShowCategoryPicker()

; Ctrl+Win+1 through Ctrl+Win+5 — Direct capture to category
^#1:: DirectCapture(1)
^#2:: DirectCapture(2)
^#3:: DirectCapture(3)
^#4:: DirectCapture(4)
^#5:: DirectCapture(5)

; Ctrl+Win+A — Advanced Paste AI transform → auto-capture chain
^#a:: AdvancedPasteChain()

; Ctrl+Win+R — Reload
^#r:: Reload()

; ============================================================================
; CORE FUNCTIONS
; ============================================================================

ShowCategoryPicker() {
    clipText := A_Clipboard
    if (clipText = "") {
        ToolTip("Clipboard empty — copy something first")
        SetTimer(() => ToolTip(), -2000)
        return
    }

    ; Build picker GUI
    pickerGui := Gui("+AlwaysOnTop -MinimizeBox", "Symphony — Select Category")
    pickerGui.SetFont("s11", "Segoe UI")
    pickerGui.AddText("w300", "Capture to which category?")
    pickerGui.AddText("w300 0x10")  ; horizontal line

    for idx, cat in CATEGORIES {
        btn := pickerGui.AddButton("w300 h35", idx ". " cat)
        btn.OnEvent("Click", ((i, *) => (pickerGui.Destroy(), PostToSymphony(i))).Bind(idx))
    }

    pickerGui.AddText("w300 0x10")
    preview := (StrLen(clipText) > 120) ? SubStr(clipText, 1, 120) "..." : clipText
    pickerGui.AddText("w300 c666666", "Preview: " preview)
    pickerGui.Show("AutoSize Center")
}

DirectCapture(categoryNum) {
    clipText := A_Clipboard
    if (clipText = "") {
        ToolTip("Clipboard empty")
        SetTimer(() => ToolTip(), -2000)
        return
    }
    PostToSymphony(categoryNum)
}

AdvancedPasteChain() {
    ; Snapshot current clipboard
    oldClip := A_Clipboard

    ; Trigger Advanced Paste (Win+Shift+V)
    Send(ADVANCED_PASTE_KEY)
    ToolTip("Advanced Paste opened — waiting for AI transform...")

    ; Wait for clipboard to change (AI transform complete)
    startTime := A_TickCount
    changed := false

    while (A_TickCount - startTime < PASTE_WAIT_MS) {
        Sleep(CLIPBOARD_POLL_MS)
        if (A_Clipboard != oldClip && A_Clipboard != "") {
            changed := true
            break
        }
    }

    ToolTip()

    if (!changed) {
        ToolTip("Timeout — clipboard unchanged. Transform may still be running.")
        SetTimer(() => ToolTip(), -3000)
        return
    }

    ; Clipboard changed — show category picker with transformed text
    ToolTip("Transform complete — pick category")
    SetTimer(() => ToolTip(), -1500)
    Sleep(500)
    ShowCategoryPicker()
}

; ============================================================================
; APPS SCRIPT POST
; ============================================================================

PostToSymphony(categoryNum) {
    clipText := A_Clipboard
    category := CATEGORIES.Has(categoryNum) ? CATEGORIES[categoryNum] : "Inbox"

    ; Escape for JSON
    escaped := StrReplace(clipText, "\", "\\")
    escaped := StrReplace(escaped, "`"", "\`"")
    escaped := StrReplace(escaped, "`n", "\n")
    escaped := StrReplace(escaped, "`r", "\r")
    escaped := StrReplace(escaped, "`t", "\t")

    ; Build JSON payload
    json := '{"category":"' category '","content":"' escaped '","timestamp":"' FormatTime(, "yyyy-MM-dd HH:mm:ss") '","source":"AdvancedPaste+AHK"}'

    ; POST via WinHTTP
    try {
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        whr.Open("POST", APPS_SCRIPT_URL, true)
        whr.SetRequestHeader("Content-Type", "application/json")
        whr.Send(json)
        whr.WaitForResponse()

        status := whr.Status
        if (status = 200 || status = 302) {
            ToolTip("Captured to " category " [OK]")
        } else {
            ToolTip("POST failed — HTTP " status)
        }
    } catch as err {
        ToolTip("POST error: " err.Message)
    }

    SetTimer(() => ToolTip(), -2500)
}
