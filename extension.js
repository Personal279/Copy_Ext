const vscode = require('vscode');

// terminal -> { entries: [{ command, output, exitCode, time }], chars }
const records = new Map();

const ANSI = /\u001b\[[0-9;?]*[ -\/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g;

function clean(text) {
  return text
    .replace(ANSI, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.includes('\r') ? line.split('\r').filter(Boolean).pop() || '' : line))
    .join('\n');
}

function cfg() {
  return vscode.workspace.getConfiguration('terminalCopier');
}

function getRecord(terminal) {
  let r = records.get(terminal);
  if (!r) {
    r = { entries: [], chars: 0 };
    records.set(terminal, r);
  }
  return r;
}

function trim(r) {
  const max = cfg().get('maxCharsPerTerminal', 5000000);
  while (r.chars > max && r.entries.length > 1) {
    const dropped = r.entries.shift();
    r.chars -= dropped.output.length + dropped.command.length;
  }
}

function format(entries) {
  return entries
    .map((e) => `$ ${e.command}\n${clean(e.output).replace(/\n+$/, '')}`)
    .join('\n\n');
}

async function copyAll() {
  const terminal = vscode.window.activeTerminal;
  if (!terminal) {
    vscode.window.showWarningMessage('No active terminal.');
    return;
  }
  terminal.show(false);
  await vscode.commands.executeCommand('workbench.action.terminal.selectAll');
  await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
  await vscode.commands.executeCommand('workbench.action.terminal.clearSelection');
  vscode.window.setStatusBarMessage('$(check) Terminal copied to clipboard', 2500);
}

async function copyLastOutput() {
  const terminal = vscode.window.activeTerminal;
  const r = terminal && records.get(terminal);
  if (!r || r.entries.length === 0) {
    // Fall back to VS Code's built-in command (needs shell integration)
    try {
      await vscode.commands.executeCommand('workbench.action.terminal.copyLastCommandOutput');
      vscode.window.setStatusBarMessage('$(check) Last command output copied', 2500);
    } catch {
      vscode.window.showWarningMessage('No recorded commands yet. Shell integration must be active.');
    }
    return;
  }
  const last = r.entries[r.entries.length - 1];
  await vscode.env.clipboard.writeText(clean(last.output).replace(/\n+$/, ''));
  vscode.window.setStatusBarMessage('$(check) Last command output copied', 2500);
}

function recordedText() {
  const terminal = vscode.window.activeTerminal;
  const r = terminal && records.get(terminal);
  if (!r || r.entries.length === 0) return null;
  return format(r.entries);
}

async function copyRecorded() {
  const text = recordedText();
  if (!text) {
    vscode.window.showWarningMessage(
      'Nothing recorded for this terminal. Recording needs shell integration (bash, zsh, fish, PowerShell) and only covers commands run after the extension loaded.'
    );
    return;
  }
  await vscode.env.clipboard.writeText(text);
  vscode.window.setStatusBarMessage(`$(check) Copied ${text.length.toLocaleString()} characters`, 3000);
}

async function openRecorded() {
  const text = recordedText();
  if (!text) {
    vscode.window.showWarningMessage('Nothing recorded for this terminal yet.');
    return;
  }
  const doc = await vscode.workspace.openTextDocument({ content: text, language: 'log' });
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function increaseScrollback() {
  await vscode.workspace
    .getConfiguration('terminal.integrated')
    .update('scrollback', 100000, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage('Terminal scrollback set to 100,000 lines. Open a new terminal for it to apply.');
}

async function record(execution, terminal) {
  const r = getRecord(terminal);
  const entry = {
    command: (execution.commandLine && execution.commandLine.value) || '(unknown command)',
    output: '',
    exitCode: undefined,
    time: Date.now(),
  };
  r.entries.push(entry);
  r.chars += entry.command.length;
  try {
    for await (const chunk of execution.read()) {
      entry.output += chunk;
      r.chars += chunk.length;
      trim(r);
    }
  } catch {
    // terminal closed mid-read
  }
}

function activate(context) {
  const reg = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));
  reg('terminalCopier.copyAll', copyAll);
  reg('terminalCopier.copyLastOutput', copyLastOutput);
  reg('terminalCopier.copyRecorded', copyRecorded);
  reg('terminalCopier.openRecorded', openRecorded);
  reg('terminalCopier.increaseScrollback', increaseScrollback);

  // Status bar buttons
  if (cfg().get('showStatusBar', true)) {
    const all = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    all.text = '$(copy) Copy Terminal';
    all.tooltip = 'Copy everything in the active terminal (Ctrl+Shift+Alt+C)';
    all.command = 'terminalCopier.copyAll';
    all.show();

    const last = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    last.text = '$(output) Last Output';
    last.tooltip = 'Copy the output of the last command';
    last.command = 'terminalCopier.copyLastOutput';
    last.show();

    context.subscriptions.push(all, last);
  }

  // Record command output via shell integration
  if (typeof vscode.window.onDidStartTerminalShellExecution === 'function') {
    context.subscriptions.push(
      vscode.window.onDidStartTerminalShellExecution((e) => {
        if (!cfg().get('recordOutput', true)) return;
        record(e.execution, e.terminal);
      }),
      vscode.window.onDidEndTerminalShellExecution((e) => {
        const r = records.get(e.terminal);
        if (r && r.entries.length) r.entries[r.entries.length - 1].exitCode = e.exitCode;
      })
    );
  }

  context.subscriptions.push(vscode.window.onDidCloseTerminal((t) => records.delete(t)));
}

function deactivate() {
  records.clear();
}

module.exports = { activate, deactivate };