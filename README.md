# Terminal Copier

One-click copy for the VS Code integrated terminal. No more drag-scrolling to select output.

## Install

**Option 1: download and install**
1. Download [`terminal-copier.vsix`](https://github.com/Harsha12022002/terminal-copier/releases/latest/download/terminal-copier.vsix).
2. In VS Code, open Extensions (`Ctrl+Shift+X`), click the `...` menu, and choose **Install from VSIX...**.
3. Pick the downloaded file and reload VS Code.

**Option 2: command line**
```bash
curl -L -o terminal-copier.vsix https://github.com/Harsha12022002/terminal-copier/releases/latest/download/terminal-copier.vsix
code --install-extension terminal-copier.vsix
```

## Features
- **Copy Terminal** (status bar, or `Ctrl+Shift+Alt+C`): copies everything currently in the terminal buffer. Works with any shell.
- **Last Output** (status bar): copies only the output of the last command.
- **Copy Full Recorded History**: every command's output is recorded as it runs, so you can copy it even after it scrolled out of the terminal. Needs shell integration (bash, zsh, fish, PowerShell).
- **Open Recorded History in Editor**: view and search recorded output in a normal editor tab.
- **Increase Terminal Scrollback**: sets `terminal.integrated.scrollback` to 100,000 lines.

## Settings
| Setting | Default | Description |
|---|---|---|
| `terminalCopier.recordOutput` | `true` | Record command output for later copying |
| `terminalCopier.maxCharsPerTerminal` | `5000000` | Max recorded characters per terminal |
| `terminalCopier.showStatusBar` | `true` | Show the status bar buttons |

## Notes
- Copy Terminal is limited by the terminal scrollback setting. For older output, use the recorded history commands.
- Recording starts when the extension loads, so it has no output from before that.

## Development
Open the folder in VS Code and press `F5` to launch an Extension Development Host. Build a package with `npx @vscode/vsce package`.

## Releasing
Push a version tag and the GitHub Action builds `terminal-copier.vsix` and attaches it to a release:
```bash
git tag v0.1.0
git push origin v0.1.0
```

## License
MIT