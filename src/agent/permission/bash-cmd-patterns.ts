export type BashCmdPattern = {
  cmd: RegExp;
  template?: string;
  description?: string;
};

export const dangerousCmdPatterns: BashCmdPattern[] = [
  { cmd: /(^|\s)rm\s+-rf\s+/i, template: "rm -rf .*", description: "递归强制删除文件或目录" },
  { cmd: /(^|\s)find\s+\/(\s|$)/i, template: "find / .*", description: "在根目录执行全域查找" },
  { cmd: /(^|\s)ls\s+-la\s+\/(\s|$)/i, template: "ls -la /", description: "枚举根目录敏感文件列表" },
  { cmd: /(^|\s)rm\s+/i, template: "rm .*", description: "删除文件或目录" },
  { cmd: /(^|\s)rmdir\s+/i, template: "rmdir .*", description: "删除空目录" },
  { cmd: /(^|\s)mv\s+/i, template: "mv .*", description: "移动或重命名文件" },
  { cmd: /(^|\s)dd\s+/i, template: "dd .*", description: "执行底层磁盘或数据块写入" },
  { cmd: /(^|\s)mkfs(\.[^\s]+)?\s+/i, template: "mkfs.*", description: "格式化文件系统" },
  { cmd: /(^|\s)chmod\s+/i, template: "chmod .*", description: "修改文件权限" },
  { cmd: /(^|\s)chown\s+/i, template: "chown .*", description: "修改文件所有者" },
  { cmd: /(^|\s)find\b.*\s-delete(\s|$)/i, template: "find .* -delete", description: "批量查找并删除文件" },
  { cmd: /git\s+clean\s+-/i, template: "git clean -.*", description: "清理 Git 未跟踪文件" },
  { cmd: /git\s+reset\s+--hard/i, template: "git reset --hard", description: "强制重置 Git 工作区" },
  { cmd: /(^|\s)sudo\s+/i, template: "sudo .*", description: "以管理员权限执行命令" },
];

export const sensitiveCmdPatterns: BashCmdPattern[] = [
  { cmd: /git\s+(commit|push|merge|rebase)/i, description: "执行 Git 提交、推送或历史改写操作" },
  { cmd: />\s*\S+/i, description: "将命令输出重定向写入文件" },
  { cmd: /\bnpm\s+(publish|install)\b/i, description: "安装或发布 npm 包" },
  { cmd: /\bpnpm\s+install\b/i, description: "安装 pnpm 依赖" },
  { cmd: /\byarn\s+add\b/i, description: "添加 Yarn 依赖" },
];
