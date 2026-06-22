export type BashCmdPattern = {
  cmd: RegExp;
};

export const dangerousCmdPatterns: BashCmdPattern[] = [
  { cmd: /(^|\s)rm\s+/i },
  { cmd: /(^|\s)rmdir\s+/i },
  { cmd: /(^|\s)mv\s+/i },
  { cmd: /(^|\s)dd\s+/i },
  { cmd: /(^|\s)mkfs(\.[^\s]+)?\s+/i },
  { cmd: /(^|\s)chmod\s+/i },
  { cmd: /(^|\s)chown\s+/i },
  { cmd: /(^|\s)find\b.*\s-delete(\s|$)/i },
  { cmd: /git\s+clean\s+-/i },
  { cmd: /git\s+reset\s+--hard/i },
  { cmd: /(^|\s)sudo\s+/i },
];

export const sensitiveCmdPatterns: BashCmdPattern[] = [
  { cmd: /git\s+(commit|push|merge|rebase)/i },
  { cmd: />\s*\S+/i },
  { cmd: /\bnpm\s+(publish|install)\b/i },
  { cmd: /\bpnpm\s+install\b/i },
  { cmd: /\byarn\s+add\b/i },
];
