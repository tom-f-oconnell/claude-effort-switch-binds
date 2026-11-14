# claude-effort-switch-binds

A [Claude Code](https://claude.com/claude-code) plugin that gives you slash commands to bind to keys: the effort
level a step lower or higher, the previous or next model, and the last prompt you typed sent again. Each runs the
command you would type yourself (`/effort <level>`, `/model <name>`), so the session, its status line and its saved
default change exactly as they do then.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install effort-switch-binds --marketplace tom-f-oconnell/claude-effort-switch-binds
```

From a shell instead: `claude plugin install effort-switch-binds --marketplace tom-f-oconnell/claude-effort-switch-binds`.

## Bind the keys

Claude Code has no keyboard action for these, so the plugin adds commands, and `~/.claude/keybindings.json` (open it
with `/keybindings`) runs them with `command:<name>` in a `Chat` block. For example:

```json
{
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "alt+a": "command:effort-down",
        "alt+d": "command:effort-up",
        "alt+q": "command:model-prev",
        "alt+e": "command:model-next",
        "alt+r": "command:rerun-last"
      }
    }
  ]
}
```

| Command | What it does |
| --- | --- |
| `/effort-down`, `/effort-up` | The effort level a step along low, medium, high, xhigh, max (held at the ends) |
| `/model-prev`, `/model-next` | The model before or after this one in `/model`'s list, wrapping round |
| `/rerun-last` | The last prompt you typed, sent again with the model and effort as they are now |

## Notes

- A key pressed while Claude is working takes effect once the turn ends. To redo an answer with another model or
  effort: Esc to stop it, change them, then rerun.
- `/rerun-last` sends the prompt as a new turn: the earlier answer stays in the conversation. To drop it first, rewind
  with Esc Esc.
- The plugin learns the effort level from what the session sends (or the saved settings), and the last prompt from
  what you type, so after a reload `/rerun-last` waits for your next prompt.
- Each model keeps its own effort level, as `/effort` does.

## Development

`claude plugin validate .` and `claude plugin test .` (the tests in `tests/`).

## Licence

GPL-3.0-only.
