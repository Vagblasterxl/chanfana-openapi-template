# Quad Commander — one key, four agents

`quad-commander.ahk` fires a stored prompt into four AI agent chats — one at a
time, in order, or all four at once. The agents can be **four browser windows
snapped into the four corners of your screen**, or **four tabs in one browser**.

## Install (once)

1. Install AutoHotkey v2 from https://www.autohotkey.com (big green button).
2. Double-click `quad-commander.ahk`. A tray icon appears. That's it running.
3. It runs fine alongside `symphony-advanced-paste.ahk` — that one uses
   **Ctrl+Win** keys, this one uses **Ctrl+Alt** keys. No overlap.

## Set up your four agents (each session)

**Quadrant mode (4 windows):** click on agent 1's browser window, press
`Ctrl+Alt+Shift+1`. Do the same on the other three windows with
`Shift+2`, `Shift+3`, `Shift+4`. Then press `Ctrl+Alt+Q` and the four windows
snap into the four corners: 1 top-left, 2 top-right, 3 bottom-left,
4 bottom-right.

**Tab mode (1 window, 4 tabs):** put your four agent tabs FIRST in the browser
(positions 1–4), click that window, press `Ctrl+Alt+Shift+0`.

## Daily use

| Key | Does |
|---|---|
| `Ctrl+Alt+Space` | Fire the prompt at the **next** agent (1→2→3→4→1…) |
| `Ctrl+Alt+1..4` | Fire at that specific agent |
| `Ctrl+Alt+A` | Fire at **all four**, one after another |
| `Ctrl+Alt+P` | Open the prompt file in Notepad |
| `Ctrl+Alt+H` | Status — what's registered, what fires next, queue depth |
| `Ctrl+Alt+0` | Reset the cycle back to agent 1 |
| `Ctrl+Alt+Q` | Re-snap the four windows into quadrants |
| `Ctrl+Alt+R` | Reload the script |

The prompt lives in `prompt.txt` next to the script. It's re-read **every
fire**, so edit → save → hit the key. No restart needed.

By default the script presses Enter for you (the prompt actually sends). While
testing, open the script and set `SEND_ENTER := false` — then it only pastes
and you press Enter yourself.

## The queue — how the launcher app plugs in

Next to the script there's a `queue\` folder. **If any `.txt` files are in it,
each fire consumes the oldest file instead of `prompt.txt`** (then moves it to
`queue\sent\` so nothing sends twice).

That folder is the whole integration contract for the Grok-built launcher app
(or Claude, or anything else):

> Write `01.txt`, `02.txt`, `03.txt`… into `queue\`. Ken hits
> `Ctrl+Alt+Space` (or `Ctrl+Alt+A`) and they flow out to the agents in order.

No API, no config — the app just writes text files.

## If pastes land in the wrong place

Some chat sites lose keyboard focus. Open the script, set
`CLICK_TO_FOCUS := true` — before pasting it clicks bottom-center of the
window, which is where every major AI chat puts its input box. If your machine
is slow, also raise `FOCUS_DELAY` from 350 to 600.
