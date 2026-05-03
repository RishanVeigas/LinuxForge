'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Virtual Filesystem ── */
const FS = {
  home: {
    user: {
      documents: {
        'report.txt': 'Q3 Financial Report\n====================\nCompany: Acme Corp\nPeriod: July - September 2024\n\nNET PROFIT: $400,000',
        'notes.md': '# Meeting Notes — Sprint Review\n\nDate: 2024-09-15\nAttendees: Alice, Bob, Carol, Dave\n\n## Action Items\n- [ ] Alice: Follow up with design\n- [x] Dave: Deploy hotfix',
        'todo.txt': 'PERSONAL TODO LIST\n==================\n\n[x] Set up dev environment\n[ ] Write first shell script',
        'secret.txt': 'API_KEY=sk-prod-abc123xyz\nDB_PASS=hunter2\nDO NOT COMMIT',
      },
      logs: {
        'server.log': Array.from({ length: 40 }, (_, i) => {
          const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'INFO', 'DEBUG'];
          const msgs = ['Server started on port 3000','GET /api/users 200 14ms','POST /api/login 200 88ms','Slow query detected: 1240ms','Memory usage: 412MB / 2048MB'];
          const h = String(9 + Math.floor(i / 4)).padStart(2, '0');
          const m = String((i * 7) % 60).padStart(2, '0');
          return `2024-09-15 ${h}:${m}:00 [${levels[i % levels.length]}]  ${msgs[i % msgs.length]}`;
        }).join('\n'),
        'error.log': '2024-09-15 10:00:01 [ERROR] Unhandled exception in worker\n2024-09-15 10:00:02 [ERROR] DB connection timeout\n2024-09-15 10:05:44 [ERROR] 503 upstream failed',
      },
      projects: {
        'webapp': {
          'index.html': '<!DOCTYPE html>\n<html>\n<head><title>App</title></head>\n<body><h1>Hello World</h1></body>\n</html>',
          'app.js': 'const express = require("express");\nconst app = express();\napp.listen(3000);',
          'package.json': '{\n  "name": "webapp",\n  "version": "1.0.0",\n  "dependencies": {\n    "express": "^4.18.0"\n  }\n}',
          'src': {
            'main.js': 'import App from "./App.js";\nApp.init();',
            'utils.js': 'export const formatDate = (d) => d.toISOString().split("T")[0];\nexport const clamp = (n, min, max) => Math.min(Math.max(n, min), max);',
            'config.js': 'export default {\n  port: 3000,\n  debug: false,\n  version: "1.0.0"\n};',
          },
          'tests': {
            'app.test.js': 'describe("App", () => { it("should start", () => { expect(true).toBe(true); }); });',
            'utils.test.js': 'import { formatDate } from "../src/utils.js";\ntest("formats date", () => { expect(formatDate(new Date("2024-01-15"))).toBe("2024-01-15"); });',
          },
        },
        'scripts': {
          'backup.sh': '#!/bin/bash\ntar -czf backup_$(date +%Y%m%d).tar.gz ~/documents\necho "Backup complete"',
          'deploy.sh': '#!/bin/bash\necho "Deploying..."\ngit pull origin main\nnpm install\npm restart server',
          'cleanup.sh': '#!/bin/bash\nfind /tmp -name "*.tmp" -mtime +7 -delete\necho "Cleaned up old temp files"',
        },
      },
      '.bashrc': '# ~/.bashrc\nexport PATH=$PATH:/usr/local/bin\nexport EDITOR=nano\nalias ll="ls -la"',
      '.ssh': {
        'config': 'Host production\n  HostName 10.0.0.1\n  User deploy\n  IdentityFile ~/.ssh/id_rsa',
        'known_hosts': '10.0.0.1 ssh-rsa AAAAB3NzaC1yc2EAAA...',
      },
    },
  },
  etc: {
    hosts: '127.0.0.1   localhost\n::1         localhost\n10.0.0.1    gateway',
    'os-release': 'NAME="Ubuntu"\nVERSION="22.04.3 LTS (Jammy Jellyfish)"\nID=ubuntu\nVERSION_ID="22.04"\nPRETTY_NAME="Ubuntu 22.04.3 LTS"',
    passwd: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000::/home/user:/bin/bash\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin',
  },
  tmp: {
    'session.tmp': 'SESSION_TOKEN=abc123\nEXPIRES=2024-09-16',
    'cache.tmp': 'cached data...',
    'old_backup': {
      'data.bak': 'old backup data from 2024-08-01',
    },
  },
  var: {
    log: {
      'syslog': 'Sep 15 09:00:01 linux systemd[1]: Started Daily apt upgrade and clean activities.\nSep 15 09:01:33 linux kernel: [12345.678] eth0: renamed from veth1a2b3c',
      'auth.log': 'Sep 15 10:22:31 linux sshd[1234]: Accepted publickey for user from 192.168.1.100\nSep 15 10:45:00 linux sudo[5678]: user : TTY=pts/0 ; COMMAND=/usr/bin/apt',
    },
  },
};

/* ── Path helpers ── */
function normalizePath(p) {
  const parts = p.split('/').filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return '/' + out.join('/');
}
function resolvePath(input, cwd) {
  if (!input || input === '~') return '/home/user';
  if (input.startsWith('~/')) return normalizePath('/home/user/' + input.slice(2));
  if (input.startsWith('/')) return normalizePath(input);
  if (input === '..') return normalizePath(cwd + '/..');
  if (input === '.') return cwd;
  return normalizePath(cwd + '/' + input);
}
function cwdDisplay(cwd) {
  if (cwd === '/home/user') return '~';
  if (cwd.startsWith('/home/user/')) return '~/' + cwd.slice('/home/user/'.length);
  return cwd;
}
function getNode(path) {
  if (path === '/') return FS;
  const parts = path.split('/').filter(Boolean);
  let node = FS;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return null;
  }
  return node;
}

/* ── find helper: walk tree collecting paths ── */
function walkFS(node, basePath, results = []) {
  if (!node || typeof node !== 'object') return results;
  for (const key of Object.keys(node)) {
    const fullPath = basePath === '/' ? '/' + key : basePath + '/' + key;
    const child = node[key];
    results.push({ path: fullPath, isDir: typeof child === 'object', content: typeof child === 'string' ? child : null });
    if (typeof child === 'object') walkFS(child, fullPath, results);
  }
  return results;
}

/* ── Objectives ── */
const OBJECTIVES = [
  {
    id:    'whoami',
    label: 'Find out the current user with whoami',
    desc:  'Use whoami to print the effective username of the current session.',
    hint:  'whoami',
    validate: (_cwd, hist) => hist.some(h => /^whoami$/.test(h.trim())),
    successMsg: 'whoami returns the effective user. Essential for scripts that need to know who is running them.',
  },
  {
    id:    'id_cmd',
    label: 'Show UID, GID and groups with id',
    desc:  'Use id to display user identity: UID, primary GID, and all group memberships.',
    hint:  'id',
    validate: (_cwd, hist) => hist.some(h => /^id(\s+\S+)?$/.test(h.trim())),
    successMsg: 'id shows uid/gid/groups. Use id <username> to inspect another user without switching to them.',
  },
  {
    id:    'uname',
    label: 'Print kernel/system info with uname -a',
    desc:  'Use uname -a to print all system information: kernel name, hostname, release, version, arch.',
    hint:  'uname -a',
    validate: (_cwd, hist) => hist.some(h => /^uname\s+-[a-z]*a[a-z]*/.test(h.trim())),
    successMsg: 'uname -a is the fastest way to fingerprint a machine. The kernel version tells you what features and patches are available.',
  },
  {
    id:    'history_cmd',
    label: 'Show command history with history',
    desc:  'Use history to list previously run commands with line numbers.',
    hint:  'history',
    validate: (_cwd, hist) => hist.some(h => /^history(\s+\d+)?$/.test(h.trim())),
    successMsg: 'history is invaluable for auditing, repeating, or scripting your past work. Use !N to re-run command N.',
  },
  {
    id:    'find_name',
    label: 'Find all .sh files under the home directory',
    desc:  'Use find to locate files by name pattern. Search ~ for any file matching *.sh',
    hint:  'find ~ -name "*.sh"',
    validate: (_cwd, hist) =>
      hist.some(h => /^find\s+[~\/\w]+\s+.*-name\s+["']?\*\.sh["']?/.test(h.trim())),
    successMsg: 'find -name uses glob patterns. Quote the pattern to stop the shell from expanding it before find sees it.',
  },
  {
    id:    'find_type',
    label: 'List only directories inside ~/projects',
    desc:  'Use find with -type d to list directories only, no files.',
    hint:  'find ~/projects -type d',
    validate: (_cwd, hist) =>
      hist.some(h => /^find\s+[~\/\w\/]+projects\s+.*-type\s+d/.test(h.trim()) ||
                     /^find\s+[~\/\w\/]+projects.*-type\s+d/.test(h.trim())),
    successMsg: 'find -type d lists directories, -type f lists files. Combining both -type f -name "*.js" is extremely powerful.',
  },
  {
    id:    'find_size',
    label: 'Find files larger than 100 bytes in /tmp',
    desc:  'Use find with -size to filter by file size. +100c means "more than 100 bytes".',
    hint:  'find /tmp -size +100c',
    validate: (_cwd, hist) =>
      hist.some(h => /^find\s+\/tmp\s+.*-size\s+\+\d+[ckMG]?/.test(h.trim())),
    successMsg: 'find -size +100c finds files > 100 bytes. Use k for kilobytes, M for megabytes. Great for hunting disk hogs.',
  },
  {
    id:    'find_maxdepth',
    label: 'Find .js files but only 2 levels deep in ~/projects',
    desc:  'Use -maxdepth to limit how deep find recurses into the directory tree.',
    hint:  'find ~/projects -maxdepth 2 -name "*.js"',
    validate: (_cwd, hist) =>
      hist.some(h => /^find\s+[~\/\w\/]+projects.*-maxdepth\s+\d+.*-name.*\.js/.test(h.trim()) ||
                     /^find\s+[~\/\w\/]+projects.*-name.*\.js.*-maxdepth\s+\d+/.test(h.trim())),
    successMsg: '-maxdepth prevents find from going too deep in large trees. -maxdepth 1 searches only the immediate directory.',
  },
];

const LESSONS_NAV = [
  { level: '01', title: 'Where Am I?',           status: 'done',   href: '/learn/beginner/level-1' },
  { level: '02', title: 'Moving Around',          status: 'done',   href: '/learn/beginner/level-2' },
  { level: '03', title: 'File & Dir Management', status: 'done',   href: '/learn/beginner/level-3' },
  { level: '04', title: 'Viewing File Contents', status: 'done',   href: '/learn/beginner/level-4' },
  { level: '05', title: 'System Info & Find',    status: 'active', href: '/learn/intermediate/level-5' },
  { level: '06', title: 'Pipes & Redirection',   status: 'locked', href: '#' },
];

const LESSON = {
  level:   '05',
  track:   'intermediate',
  title:   'System Info & Find',
  module:  'module_02 — intermediate',
  description: [
    { text: 'Knowing your environment is the first step to mastering it. ' },
    { text: 'whoami', code: true }, { text: ', ' },
    { text: 'id', code: true }, { text: ', and ' },
    { text: 'uname', code: true },
    { text: ' reveal who you are and what machine you\'re on. ' },
    { text: 'history', code: true },
    { text: ' tracks everything you\'ve done. And ' },
    { text: 'find', code: true },
    { text: ' — one of the most powerful CLI tools — lets you locate any file anywhere by name, type, size, or depth.' },
  ],
  commands: [
    { name: 'whoami',                    desc: 'print effective username' },
    { name: 'id',                        desc: 'show uid, gid, groups' },
    { name: 'id <user>',                 desc: 'inspect another user' },
    { name: 'uname -a',                  desc: 'all system info' },
    { name: 'uname -r',                  desc: 'kernel release only' },
    { name: 'uname -m',                  desc: 'machine architecture' },
    { name: 'history',                   desc: 'list command history' },
    { name: 'history N',                 desc: 'show last N commands' },
    { name: 'find <path> -name <pat>',   desc: 'find by filename glob' },
    { name: 'find <path> -type d',       desc: 'directories only' },
    { name: 'find <path> -type f',       desc: 'files only' },
    { name: 'find <path> -size +Nc',     desc: 'files > N bytes' },
    { name: 'find <path> -maxdepth N',   desc: 'limit recursion depth' },
    { name: 'find <path> -name "*.ext"', desc: 'glob by extension' },
  ],
  xp: 175,
  nextLevel: '/intermediate/level-6',
};

/* ── Tree builder ── */
function buildTree(node, prefix = '', depth = 0) {
  const lines = [];
  if (depth === 0) lines.push({ text: '.', isDir: true });
  if (typeof node !== 'object' || depth > 3) return lines;
  const keys = Object.keys(node);
  keys.forEach((key, idx) => {
    const isLast = idx === keys.length - 1;
    const isDir  = typeof node[key] === 'object';
    lines.push({ text: prefix + (isLast ? '└── ' : '├── ') + key + (isDir ? '/' : ''), isDir });
    if (isDir && depth < 2) lines.push(...buildTree(node[key], prefix + (isLast ? '    ' : '│   '), depth + 1));
  });
  return lines;
}

/* ── Output renderer ── */
function OutputLine({ line }) {
  const colorMap = {
    green:  'text-[#4ade80]',
    cyan:   'text-[#22d3ee]',
    yellow: 'text-[#fbbf24]',
    red:    'text-[#f87171]',
    dim:    'text-[#3f3f3f]',
    white:  'text-[#d4d4d4]',
    blue:   'text-[#60a5fa]',
    purple: 'text-[#a78bfa]',
    orange: 'text-[#fb923c]',
  };
  const cls = colorMap[line.color] || 'text-[#aaa]';

  if (line.type === 'prompt') {
    return (
      <div className="flex items-center gap-1 font-mono text-[13px] leading-relaxed">
        <span className="text-[#4ade80] font-bold">user</span>
        <span className="text-[#2a2a2a]">@</span>
        <span className="text-[#4ade80] font-bold">linux</span>
        <span className="text-[#2a2a2a]">:</span>
        <span className="text-[#60a5fa]">{line.path}</span>
        <span className="text-[#444]">$</span>
        <span className="text-[#d4d4d4] ml-1">{line.cmd}</span>
      </div>
    );
  }
  if (line.type === 'ls-grid') {
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-0.5 font-mono text-[13px]">
        {line.entries.map((e) => (
          <span key={e.name} style={{ color: e.isDir ? '#60a5fa' : '#aaa', fontWeight: e.isDir ? 700 : 400 }}>
            {e.name}{e.isDir ? '/' : ''}
          </span>
        ))}
      </div>
    );
  }
  if (line.type === 'ls-long') {
    return (
      <div className="font-mono text-[13px] flex gap-3">
        <span className="text-[#3f3f3f]">{line.perm}</span>
        <span className="text-[#555]">{line.size.padStart(5)}</span>
        <span className="text-[#555]">{line.date}</span>
        <span style={{ color: line.isDir ? '#60a5fa' : '#aaa', fontWeight: line.isDir ? 700 : 400 }}>
          {line.name}{line.isDir ? '/' : ''}
        </span>
      </div>
    );
  }
  if (line.type === 'tree') {
    return (
      <div className="font-mono text-[12px] leading-[1.6]">
        {line.lines.map((l, i) => (
          <div key={i} style={{ color: l.isDir ? '#60a5fa' : '#666' }}>{l.text}</div>
        ))}
      </div>
    );
  }
  if (line.type === 'id-line') {
    return (
      <div className="font-mono text-[13px] leading-relaxed">
        <span className="text-[#fbbf24]">uid=</span><span className="text-[#4ade80]">1000</span>
        <span className="text-[#555]">(user) </span>
        <span className="text-[#fbbf24]">gid=</span><span className="text-[#4ade80]">1000</span>
        <span className="text-[#555]">(user) </span>
        <span className="text-[#fbbf24]">groups=</span>
        <span className="text-[#4ade80]">1000</span><span className="text-[#555]">(user),</span>
        <span className="text-[#4ade80]">4</span><span className="text-[#555]">(adm),</span>
        <span className="text-[#4ade80]">27</span><span className="text-[#555]">(sudo),</span>
        <span className="text-[#4ade80]">1001</span><span className="text-[#555]">(docker)</span>
      </div>
    );
  }
  if (line.type === 'uname-line') {
    return (
      <div className="font-mono text-[13px] text-[#22d3ee] leading-relaxed">
        {line.parts.map((p, i) => (
          <span key={i}>
            <span className="text-[#22d3ee]">{p.val}</span>
            {i < line.parts.length - 1 && <span className="text-[#2a2a2a]"> </span>}
          </span>
        ))}
      </div>
    );
  }
  if (line.type === 'history-line') {
    return (
      <div className="font-mono text-[13px] flex gap-3 leading-relaxed">
        <span className="text-[#3f3f3f] min-w-[36px] text-right select-none">{line.num}</span>
        <span className="text-[#d4d4d4]">{line.cmd}</span>
      </div>
    );
  }
  if (line.type === 'find-result') {
    return (
      <div className="font-mono text-[13px] leading-relaxed">
        <span className="text-[#3f3f3f]">{line.dir}</span>
        <span style={{ color: line.isDir ? '#60a5fa' : '#a78bfa' }}>{line.base}{line.isDir ? '/' : ''}</span>
      </div>
    );
  }
  if (line.type === 'obj-complete') {
    return (
      <div className="flex items-start gap-2 bg-[#051305] border border-[#4ade80]/25 rounded px-3 py-2 my-1">
        <span className="text-[#4ade80] text-[13px] mt-[1px]">✓</span>
        <div>
          <div className="text-[12px] text-[#4ade80] font-bold">{line.label}</div>
          <div className="text-[11px] text-[#444] mt-0.5 leading-relaxed">{line.msg}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all ${cls}`}>
      {line.text}
    </div>
  );
}

/* ── Main component ── */
export default function Level5Page() {
  const [cwd, setCwd]               = useState('/home/user');
  const [prevCwd, setPrevCwd]       = useState('/home/user');
  const [output, setOutput]         = useState([]);
  const [inputVal, setInputVal]     = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx]       = useState(-1);
  const [hintOpen, setHintOpen]     = useState(false);
  const [objIdx, setObjIdx]         = useState(0);
  const [completed, setCompleted]   = useState([]);
  const [levelDone, setLevelDone]   = useState(false);
  const [showToast, setShowToast]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allHistory, setAllHistory] = useState([]);

  const inputRef   = useRef(null);
  const outputRef  = useRef(null);
  const cwdRef     = useRef(cwd);
  cwdRef.current   = cwd;
  const allHistRef = useRef(allHistory);
  allHistRef.current = allHistory;
  const cmdHistRef = useRef(cmdHistory);
  cmdHistRef.current = cmdHistory;

  const progress   = levelDone ? 100 : Math.round((completed.length / OBJECTIVES.length) * 90);
  const currentObj = OBJECTIVES[objIdx];

  useEffect(() => {
    setOutput([
      { id: 0, type: 'text', color: 'dim',    text: 'Linux Learning Platform  —  bash 5.2.21' },
      { id: 1, type: 'text', color: 'dim',    text: "Type 'help' to see commands. Files are in ~/documents, ~/logs, ~/projects." },
      { id: 2, type: 'text', color: 'dim',    text: '' },
      { id: 3, type: 'text', color: 'green',  text: 'Welcome to Level 05 — System Info & Find' },
      { id: 4, type: 'text', color: 'yellow', text: `Objective 1/${OBJECTIVES.length}: ${OBJECTIVES[0].label}` },
      { id: 5, type: 'text', color: 'dim',    text: OBJECTIVES[0].desc },
      { id: 6, type: 'text', color: 'dim',    text: '' },
    ]);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const addLines = useCallback((lines) => {
    setOutput(prev => {
      const base = prev.length;
      return [...prev, ...lines.map((l, i) => ({ ...l, id: base + i }))];
    });
  }, []);

  const checkObjective = useCallback((newAllHistory) => {
    setObjIdx(prevIdx => {
      if (levelDone) return prevIdx;
      const obj = OBJECTIVES[prevIdx];
      if (!obj) return prevIdx;
      if (obj.validate(cwdRef.current, newAllHistory)) {
        const nextIdx = prevIdx + 1;
        setTimeout(() => {
          addLines([
            { type: 'obj-complete', label: `✓ Objective ${prevIdx + 1}/${OBJECTIVES.length}: ${obj.label}`, msg: obj.successMsg },
            { type: 'text', color: 'dim', text: '' },
          ]);
          setCompleted(prev => [...prev, obj.id]);
          if (nextIdx >= OBJECTIVES.length) {
            setLevelDone(true);
            setTimeout(() => {
              addLines([{ type: 'text', color: 'green', text: '✓ All objectives complete! Level 05 passed.' }]);
              setShowToast(true);
            }, 400);
          } else {
            setTimeout(() => {
              addLines([
                { type: 'text', color: 'yellow', text: `▸ Objective ${nextIdx + 1}/${OBJECTIVES.length}: ${OBJECTIVES[nextIdx].label}` },
                { type: 'text', color: 'dim',    text: OBJECTIVES[nextIdx].desc },
                { type: 'text', color: 'dim',    text: '' },
              ]);
            }, 400);
          }
        }, 200);
        setHintOpen(false);
        return nextIdx;
      }
      return prevIdx;
    });
  }, [levelDone, addLines]);

  const runCommand = useCallback((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const currentCwd = cwdRef.current;
    setCmdHistory(prev => {
      const updated = [trimmed, ...prev];
      cmdHistRef.current = updated;
      return updated;
    });
    setHistIdx(-1);

    const newAllHistory = [trimmed, ...allHistRef.current];
    setAllHistory(newAllHistory);

    const promptLine = { type: 'prompt', path: cwdDisplay(currentCwd), cmd: trimmed };
    const parts   = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd     = parts[0];
    const rawArgs = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ''));
    const flags   = rawArgs.filter(a => a.startsWith('-'));
    const args    = rawArgs.filter(a => !a.startsWith('-'));

    let responseLines = [];

    const resolveFile = (argPath) => {
      const resolved = resolvePath(argPath, currentCwd);
      const node = getNode(resolved);
      if (node === null)            return { err: `${argPath}: No such file or directory` };
      if (typeof node === 'object') return { err: `${argPath}: Is a directory` };
      return { content: node, resolved };
    };

    switch (cmd) {

      /* ── navigation (carried over, no objectives for these) ── */
      case 'pwd': responseLines = [{ type: 'text', color: 'cyan', text: currentCwd }]; break;

      case 'cd': {
        const target = rawArgs[0];
        if (!target || target === '~') { setPrevCwd(currentCwd); setCwd('/home/user'); cwdRef.current = '/home/user'; break; }
        if (target === '-') {
          const prev = prevCwd; setPrevCwd(currentCwd); setCwd(prev); cwdRef.current = prev;
          responseLines = [{ type: 'text', color: 'cyan', text: prev }]; break;
        }
        const resolved = resolvePath(target, currentCwd);
        const node = getNode(resolved);
        if (!node) responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: No such file or directory` }];
        else if (typeof node === 'string') responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: Not a directory` }];
        else { setPrevCwd(currentCwd); setCwd(resolved); cwdRef.current = resolved; }
        break;
      }

      case 'ls': {
        const showHidden = flags.some(f => f.includes('a'));
        const longFmt    = flags.some(f => f.includes('l'));
        const targetArg  = args[0];
        const targetPath = targetArg ? resolvePath(targetArg, currentCwd) : currentCwd;
        const node = getNode(targetPath);
        if (!node || typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `ls: cannot access '${targetArg || '.'}': No such file or directory` }]; break;
        }
        const entries = Object.keys(node).filter(k => showHidden || !k.startsWith('.'));
        if (!entries.length) { responseLines = [{ type: 'text', color: 'dim', text: '(empty directory)' }]; break; }
        if (longFmt) {
          responseLines = [
            { type: 'text', color: 'dim', text: 'total ' + entries.length * 4 },
            ...entries.map(e => {
              const isDir = typeof node[e] === 'object';
              const content = typeof node[e] === 'string' ? node[e] : '';
              const min = String(Math.floor(Math.random() * 60)).padStart(2, '0');
              return { type: 'ls-long', perm: isDir ? 'drwxr-xr-x' : '-rw-r--r--', size: isDir ? '4096' : String(content.length), date: `Sep 15 10:${min}`, name: e, isDir };
            }),
          ];
        } else {
          responseLines = [{ type: 'ls-grid', entries: entries.map(e => ({ name: e, isDir: typeof node[e] === 'object' })) }];
        }
        break;
      }

      case 'tree': {
        const targetArg  = args[0];
        const targetPath = targetArg ? resolvePath(targetArg, currentCwd) : currentCwd;
        const node = getNode(targetPath);
        if (!node || typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `tree: ${targetArg || '.'}: No such file or directory` }]; break;
        }
        responseLines = [{ type: 'tree', lines: buildTree(node) }];
        break;
      }

      /* ── NEW: system info commands ── */

      case 'whoami':
        responseLines = [{ type: 'text', color: 'green', text: 'user' }];
        break;

      case 'id': {
        const targetUser = args[0];
        if (targetUser && targetUser !== 'user' && targetUser !== 'root') {
          responseLines = [{ type: 'text', color: 'red', text: `id: '${targetUser}': no such user` }]; break;
        }
        if (targetUser === 'root') {
          responseLines = [{
            type: 'text', color: 'yellow',
            text: 'uid=0(root) gid=0(root) groups=0(root)',
          }]; break;
        }
        responseLines = [{ type: 'id-line' }];
        break;
      }

      case 'uname': {
        const all     = flags.some(f => f.includes('a'));
        const kernel  = flags.some(f => f === '-s' || (f.startsWith('-') && f.includes('s') && !f.startsWith('--')));
        const release = flags.some(f => f === '-r' || (f.startsWith('-') && f.includes('r') && !f.startsWith('--')));
        const version = flags.some(f => f === '-v' || (f.startsWith('-') && f.includes('v') && !f.startsWith('--')));
        const machine = flags.some(f => f === '-m' || (f.startsWith('-') && f.includes('m') && !f.startsWith('--')));
        const nodename = flags.some(f => f === '-n' || (f.startsWith('-') && f.includes('n') && !f.startsWith('--')));

        if (all) {
          responseLines = [{
            type: 'uname-line',
            parts: [
              { val: 'Linux' },
              { val: 'linux' },
              { val: '5.15.0-91-generic' },
              { val: '#101-Ubuntu SMP Tue Nov 14 13:29:11 UTC 2023' },
              { val: 'x86_64' },
              { val: 'x86_64' },
              { val: 'x86_64' },
              { val: 'GNU/Linux' },
            ],
          }];
        } else if (!flags.length) {
          responseLines = [{ type: 'text', color: 'cyan', text: 'Linux' }];
        } else {
          const parts = [];
          if (kernel || all)   parts.push('Linux');
          if (nodename)        parts.push('linux');
          if (release)         parts.push('5.15.0-91-generic');
          if (version)         parts.push('#101-Ubuntu SMP Tue Nov 14 13:29:11 UTC 2023');
          if (machine)         parts.push('x86_64');
          responseLines = [{ type: 'text', color: 'cyan', text: parts.join(' ') }];
        }
        break;
      }

      case 'history': {
        const n = args[0] ? parseInt(args[0], 10) : null;
        // allHistRef contains newest-first; reverse for display
        const hist = [...allHistRef.current].reverse();
        const slice = n ? hist.slice(-n) : hist;
        const startNum = n ? Math.max(1, hist.length - n + 1) : 1;
        if (!slice.length) {
          responseLines = [{ type: 'text', color: 'dim', text: '(no history)' }];
        } else {
          responseLines = slice.map((h, i) => ({
            type: 'history-line',
            num: String(startNum + i).padStart(4),
            cmd: h,
          }));
        }
        break;
      }

      /* ── NEW: find ── */
      case 'find': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'find: missing path argument' }]; break; }

        const searchPath = resolvePath(args[0], currentCwd);
        const rootNode   = getNode(searchPath);
        if (!rootNode) { responseLines = [{ type: 'text', color: 'red', text: `find: '${args[0]}': No such file or directory` }]; break; }

        // parse options
        const nameFlag = (() => {
          const idx = rawArgs.findIndex(a => a === '-name');
          return idx !== -1 ? rawArgs[idx + 1] : null;
        })();
        const typeFlag = (() => {
          const idx = rawArgs.findIndex(a => a === '-type');
          return idx !== -1 ? rawArgs[idx + 1] : null;
        })();
        const sizeFlag = (() => {
          const idx = rawArgs.findIndex(a => a === '-size');
          return idx !== -1 ? rawArgs[idx + 1] : null;
        })();
        const maxDepthFlag = (() => {
          const idx = rawArgs.findIndex(a => a === '-maxdepth');
          return idx !== -1 ? parseInt(rawArgs[idx + 1], 10) : null;
        })();

        // glob -> regex
        const globToRe = (pattern) => {
          if (!pattern) return null;
          const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
          return new RegExp('^' + escaped + '$', 'i');
        };
        const nameRe = nameFlag ? globToRe(nameFlag) : null;

        // size parser: +100c, -2k, 1M etc
        const parseSizeFilter = (s) => {
          if (!s) return null;
          const match = s.match(/^([+-]?)(\d+)([ckMG]?)$/);
          if (!match) return null;
          const [, sign, num, unit] = match;
          const mults = { '': 1, c: 1, k: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024 };
          const bytes = parseInt(num, 10) * (mults[unit] || 1);
          return { sign: sign || '=', bytes };
        };
        const sizeFilter = parseSizeFilter(sizeFlag);

        // walk and collect
        const allEntries = typeof rootNode === 'object'
          ? [{ path: searchPath, isDir: true, content: null }, ...walkFS(rootNode, searchPath)]
          : [{ path: searchPath, isDir: false, content: rootNode }];

        const results = allEntries.filter(entry => {
          // depth check
          if (maxDepthFlag !== null) {
            const relDepth = entry.path.slice(searchPath.length).split('/').filter(Boolean).length;
            if (relDepth > maxDepthFlag) return false;
          }
          // type check
          if (typeFlag === 'd' && !entry.isDir) return false;
          if (typeFlag === 'f' && entry.isDir)  return false;
          // name check
          if (nameRe) {
            const base = entry.path.split('/').pop();
            if (!nameRe.test(base)) return false;
          }
          // size check (skip dirs)
          if (sizeFilter && !entry.isDir) {
            const byteLen = entry.content ? new TextEncoder().encode(entry.content).length : 0;
            if (sizeFilter.sign === '+' && byteLen <= sizeFilter.bytes) return false;
            if (sizeFilter.sign === '-' && byteLen >= sizeFilter.bytes) return false;
            if (sizeFilter.sign === '=' && byteLen !== sizeFilter.bytes) return false;
          }
          return true;
        });

        if (!results.length) {
          responseLines = [{ type: 'text', color: 'dim', text: '(no results)' }];
        } else {
          responseLines = results.map(entry => {
            const fullPath  = entry.path;
            const lastSlash = fullPath.lastIndexOf('/');
            const dir       = lastSlash === 0 ? '/' : fullPath.slice(0, lastSlash + 1);
            const base      = fullPath.slice(lastSlash + 1);
            const displayPath = fullPath.startsWith('/home/user')
              ? fullPath.replace('/home/user', '~')
              : fullPath;
            const displayDir  = displayPath.slice(0, displayPath.lastIndexOf('/') + 1);
            const displayBase = displayPath.slice(displayPath.lastIndexOf('/') + 1);
            return { type: 'find-result', dir: displayDir || './', base: displayBase || '.', isDir: entry.isDir };
          });
        }
        break;
      }

      case 'clear': { setOutput([]); return; }

      case 'help': {
        responseLines = [
          { type: 'text', color: 'green',  text: 'Level 05 commands:' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — System Info —' },
          { type: 'text', color: 'white',  text: '  whoami              print current username' },
          { type: 'text', color: 'white',  text: '  id [user]           show uid, gid, groups' },
          { type: 'text', color: 'white',  text: '  uname [-a|-r|-m|-n] system/kernel info' },
          { type: 'text', color: 'white',  text: '  history [N]         command history' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Find —' },
          { type: 'text', color: 'white',  text: '  find <path> [options]' },
          { type: 'text', color: 'white',  text: '    -name "*.ext"     match filename glob' },
          { type: 'text', color: 'white',  text: '    -type d|f         dirs or files only' },
          { type: 'text', color: 'white',  text: '    -size +Nc         files > N bytes' },
          { type: 'text', color: 'white',  text: '    -maxdepth N       limit recursion depth' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Navigation (from prev levels) —' },
          { type: 'text', color: 'white',  text: '  cd / ls / pwd / tree / clear' },
        ];
        break;
      }

      default:
        responseLines = [{ type: 'text', color: 'red', text: `bash: ${cmd}: command not found` }];
    }

    addLines([promptLine, ...responseLines, { type: 'text', color: 'dim', text: '' }]);
    checkObjective(newAllHistory);
  }, [levelDone, addLines, checkObjective, prevCwd]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const val = inputVal; setInputVal(''); runCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistIdx(prev => {
        const n = Math.min(prev + 1, cmdHistory.length - 1);
        setInputVal(cmdHistory[n] || '');
        return n;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistIdx(prev => {
        const n = Math.max(prev - 1, -1);
        setInputVal(n === -1 ? '' : cmdHistory[n] || '');
        return n;
      });
    }
  };

  return (
    <div
      className="h-screen flex flex-col bg-[#060606] text-[#d4d4d4] overflow-hidden font-mono"
      onClick={() => inputRef.current?.focus()}
    >
      {/* ── TOP BAR ── */}
      <header className="h-11 flex-shrink-0 bg-[#0c0c0c] border-b border-[#1c1c1c] flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-[#444] hover:text-[#4ade80] transition-colors mr-1"
            onClick={(e) => { e.stopPropagation(); setSidebarOpen(o => !o); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect y="2" width="16" height="1.5" rx="1"/>
              <rect y="7" width="16" height="1.5" rx="1"/>
              <rect y="12" width="16" height="1.5" rx="1"/>
            </svg>
          </button>
          <div className="w-6 h-6 rounded border border-[#4ade80]/40 flex items-center justify-center">
            <span className="text-[#4ade80] text-xs font-bold">$_</span>
          </div>
          <span className="text-white text-xs font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            LinuxMastery
          </span>
        </div>
        <div className="flex items-center gap-2">
          {LESSONS_NAV.map((l) => (
            <a key={l.level} href={l.href} title={`Level ${l.level}: ${l.title}`}
              className={`w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
                l.status === 'done'   ? 'bg-[#4ade80] border-[#4ade80]' :
                l.status === 'active' ? 'bg-[#fbbf24] border-[#fbbf24] shadow-[0_0_6px_#fbbf2488]' :
                'bg-[#1a1a1a] border-[#2a2a2a]'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#4ade80] border border-[#4ade80]/20 bg-[#4ade80]/5 px-2 py-0.5 rounded font-mono">
            +{LESSON.xp} XP
          </span>
          <a href="/" className="text-xs text-[#444] hover:text-[#4ade80] transition-colors">exit</a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <aside className={`
          w-72 flex-shrink-0 bg-[#0c0c0c] border-r border-[#1c1c1c] flex flex-col overflow-hidden
          md:relative md:translate-x-0 absolute inset-y-0 left-0 z-30 transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `} onClick={e => e.stopPropagation()}>

          <div className="bg-[#0a0f0a] border-b border-[#1c1c1c] px-5 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#4ade80] font-bold tracking-[0.15em] uppercase">Level {LESSON.level}</span>
              <span className="text-[10px] text-[#444] font-mono">{LESSON.track}</span>
            </div>
            <h1 className="text-white font-bold text-base leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              {LESSON.title}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">

            {/* Description */}
            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Description</div>
              <p className="text-[12px] text-[#555] leading-[1.8]">
                {LESSON.description.map((seg, i) => {
                  if (seg.code) return <code key={i} className="text-[#4ade80] bg-[#0a0f0a] px-1 rounded text-[11px]">{seg.text}</code>;
                  return <span key={i}>{seg.text}</span>;
                })}
              </p>
            </div>

            {/* Objectives */}
            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">
                Objectives <span className="ml-2 text-[#333] normal-case tracking-normal">{completed.length}/{OBJECTIVES.length}</span>
              </div>
              <div className="space-y-1.5">
                {OBJECTIVES.map((obj, i) => {
                  const done   = completed.includes(obj.id);
                  const active = i === objIdx && !levelDone;
                  return (
                    <div key={obj.id} className={`flex items-start gap-2.5 px-2.5 py-2 rounded text-[11px] transition-colors ${
                      done   ? 'bg-[#0a0f0a] border border-[#1a2e1a]' :
                      active ? 'bg-[#4ade80]/5 border border-[#4ade80]/20' :
                               'border border-transparent'
                    }`}>
                      <span className={`mt-[2px] flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold ${
                        done   ? 'border-[#4ade80] bg-[#4ade80] text-black' :
                        active ? 'border-[#fbbf24] text-[#fbbf24]' :
                                 'border-[#2a2a2a] text-[#333]'
                      }`}>
                        {done ? '✓' : i + 1}
                      </span>
                      <div>
                        <div className={done ? 'text-[#333] line-through' : active ? 'text-[#d4d4d4]' : 'text-[#2a2a2a]'}>{obj.label}</div>
                        {active && <div className="text-[#444] mt-0.5 leading-relaxed">{obj.desc}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hint */}
            {!levelDone && currentObj && (
              <div>
                <button
                  className={`w-full text-left border rounded px-3 py-2 text-[11px] transition-all duration-200 ${
                    hintOpen ? 'border-[#3a2800] text-[#ffa000] bg-[#1a1200]' :
                    'border-[#2a2a2a] text-[#444] hover:border-[#ffa000] hover:text-[#ffa000]'
                  }`}
                  onClick={() => setHintOpen(o => !o)}
                >
                  {hintOpen ? '[ hide hint ]' : `[ hint for objective ${objIdx + 1} ]`}
                </button>
                {hintOpen && (
                  <div className="mt-2 bg-[#1a1200] border border-[#3a2800] rounded px-3 py-2.5 text-[11px] text-[#ffa000] leading-[1.7]">
                    {currentObj.hint}
                  </div>
                )}
              </div>
            )}

            {/* Commands */}
            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Commands</div>
              <div className="space-y-1.5">
                {LESSON.commands.map((c) => (
                  <div key={c.name} className="flex gap-3 items-baseline">
                    <code className="text-[11px] text-[#4ade80] font-bold min-w-[96px] flex-shrink-0">{c.name}</code>
                    <span className="text-[11px] text-[#333]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* find flags reference */}
            <div className="bg-[#0a0f0a] border border-[#1c1c1c] rounded p-3">
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">find — Flags</div>
              <div className="space-y-1">
                {[
                  ['-name "pat"',   'glob match on filename'],
                  ['-type f',       'files only'],
                  ['-type d',       'directories only'],
                  ['-size +Nc',     'larger than N bytes'],
                  ['-size -Nk',     'smaller than N kilobytes'],
                  ['-maxdepth N',   'recurse at most N levels'],
                ].map(([flag, desc]) => (
                  <div key={flag} className="flex gap-3">
                    <code className="text-[11px] text-[#60a5fa] min-w-[80px]">{flag}</code>
                    <span className="text-[11px] text-[#333]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* File system overview */}
            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Filesystem to explore</div>
              <div className="space-y-1">
                {[
                  ['~/documents/',         'txt, md files'],
                  ['~/logs/',              'server & error logs'],
                  ['~/projects/webapp/',   'js, html, json, tests'],
                  ['~/projects/scripts/',  'bash scripts (.sh)'],
                  ['/tmp/',                'temp files of various sizes'],
                  ['/var/log/',            'system logs'],
                ].map(([path, desc]) => (
                  <div key={path} className="flex gap-2 items-baseline">
                    <code className="text-[11px] text-[#444] truncate">{path}</code>
                    <span className="text-[10px] text-[#2a2a2a] flex-shrink-0">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Level nav */}
            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Module</div>
              <div className="space-y-0.5">
                {LESSONS_NAV.map((l) => (
                  <a key={l.level} href={l.status === 'locked' ? undefined : l.href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-[11px] transition-colors duration-150 ${
                      l.status === 'active' ? 'bg-[#4ade80]/8 text-white' :
                      l.status === 'done'   ? 'text-[#444] hover:text-[#666]' :
                      'text-[#222] cursor-default'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      l.status === 'done'   ? 'bg-[#4ade80]' :
                      l.status === 'active' ? 'bg-[#fbbf24]' :
                      'bg-[#2a2a2a]'
                    }`} />
                    <span>{l.level}</span>
                    <span className="text-[#222] mx-0.5">—</span>
                    <span className="truncate">{l.title}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-[3px] bg-[#111] border-t border-[#1c1c1c] flex-shrink-0">
            <div className="h-full bg-[#4ade80] transition-all duration-500"
              style={{ width: `${progress}%`, boxShadow: '0 0 8px #4ade8060' }} />
          </div>
        </aside>

        {/* ── TERMINAL ── */}
        <div className="flex-1 bg-[#000] flex flex-col overflow-hidden relative">

          {/* Title bar */}
          <div className="h-[34px] bg-[#0c0c0c] border-b border-[#1c1c1c] flex-shrink-0 flex items-center justify-between px-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[11px] text-[#2a2a2a] tracking-[0.05em]">bash — user@linux</span>
            <div>
              {levelDone
                ? <span className="text-[10px] text-[#4ade80] border border-[#4ade80]/30 px-2 py-0.5 rounded-full">✓ complete</span>
                : <span className="text-[10px] text-[#333] font-mono">{completed.length}/{OBJECTIVES.length} done</span>
              }
            </div>
          </div>

          {/* Output */}
          <div ref={outputRef}
            className="flex-1 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-[2px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a #000' }}>
            {output.map((line) => <OutputLine key={line.id} line={line} />)}
          </div>

          {/* Success toast */}
          {showToast && (
            <div className="absolute bottom-[72px] right-5 bg-[#0a0f0a] border border-[#4ade80] rounded-lg px-5 py-4 w-72 shadow-[0_0_24px_#4ade8018] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#4ade80] font-bold mb-1.5">✓ Level 05 complete!</div>
              <div className="text-[11px] text-[#444] leading-relaxed mb-1">
                You can now inspect any system with <code className="text-[#4ade80]">whoami</code>, <code className="text-[#4ade80]">id</code>, and <code className="text-[#4ade80]">uname</code>, and hunt
                down any file with <code className="text-[#4ade80]">find</code>.
              </div>
              <div className="text-[11px] text-[#4ade80]/60 mb-3">+{LESSON.xp} XP earned</div>
              <div className="flex gap-2">
                <a href={LESSON.nextLevel}
                  className="flex-1 bg-[#4ade80] text-black text-[12px] font-bold py-1.5 rounded text-center hover:bg-[#4ade80]/90 transition-opacity">
                  Next Level →
                </a>
                <button onClick={() => setShowToast(false)} className="text-[11px] text-[#333] hover:text-[#555] px-2">✕</button>
              </div>
            </div>
          )}

          {/* Input row */}
          <div className="flex-shrink-0 border-t border-[#111] px-5 py-3 flex items-center gap-2">
            <div className="flex items-center gap-1 flex-shrink-0 text-[13px]">
              <span className="text-[#4ade80] font-bold">user</span>
              <span className="text-[#2a2a2a]">@</span>
              <span className="text-[#4ade80] font-bold">linux</span>
              <span className="text-[#2a2a2a]">:</span>
              <span className="text-[#60a5fa]">{cwdDisplay(cwd)}</span>
              <span className="text-[#444]">$</span>
            </div>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#d4d4d4] caret-[#4ade80] font-mono"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            />
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 3px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #1c1c1c; border-radius: 2px; }
      `}</style>
    </div>
  );
}