#!/usr/bin/env python3
"""Native messaging host for Dia Command Palette.

Extensions can't trigger browser shortcuts, so this helper asks macOS to press
⌘E in Dia (open the side chat), paste the query and send it. Requires Dia to be
allowed under System Settings → Privacy & Security → Accessibility.
"""

import json
import struct
import subprocess
import sys

ASK_DIA = """
on run argv
  set query to item 1 of argv
  if query is not "" then set the clipboard to query
  tell application id "company.thebrowser.dia" to activate
  tell application "System Events"
    repeat 40 times
      if frontmost of process "Dia" then exit repeat
      delay 0.05
    end repeat
    keystroke "e" using command down
    if query is not "" then
      delay 0.5
      keystroke "v" using command down
      delay 0.15
      key code 36 -- Return
    end if
  end tell
end run
"""


def read_message():
    header = sys.stdin.buffer.read(4)
    if len(header) < 4:
        return None
    (length,) = struct.unpack("<I", header)
    return json.loads(sys.stdin.buffer.read(length))


def send_message(message):
    data = json.dumps(message).encode()
    sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
    sys.stdout.buffer.flush()


def main():
    message = read_message() or {}
    if message.get("action") == "ping":
        send_message({"ok": True})
    elif message.get("action") == "ask-dia":
        result = subprocess.run(
            ["osascript", "-e", ASK_DIA, str(message.get("query", ""))],
            capture_output=True,
            text=True,
        )
        send_message({"ok": result.returncode == 0, "error": result.stderr.strip()})
    else:
        send_message({"ok": False, "error": f"unknown action: {message.get('action')}"})


if __name__ == "__main__":
    main()
