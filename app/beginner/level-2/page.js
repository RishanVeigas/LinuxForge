'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Virtual Filesystem ── */
const FS = {
  home: {
    user: {
      documents: {
        'report.txt':    'Q3 Financial Report\nRevenue: $1.2M\nExpenses: $0.8M\nProfit: $0.4M',
        'notes.md':      '# Meeting Notes\n- Follow up with team\n- Review Q3 numbers\n- Schedule sprint review',
        'todo.txt':      'TODO:\n[ ] Buy groceries\n[ ] Fix bug #42\n[x] Learn Linux navigation',
        projects: {
          'web-app': {
            'index.html': '<!DOCTYPE html><html><body>Hello World</body></html>',
            'style.css':  'body { margin: 0; font-family: sans-serif; }',
          },
          'scripts': {
            'deploy.sh':  '#!/bin/bash\necho "Deploying..."',
            'backup.sh':  '#!/bin/bash\necho "Backing up..."',
          },
        },
      },
      downloads: {
        'setup.sh':    '#!/bin/bash\necho "installing..."',
        'archive.tar': '[binary data]',
        'readme.txt':  'Extract archive before running setup.sh',
      },
      pictures: {
        'vacation.jpg':  '[image data]',
        'profile.png':   '[image data]',
      },
      '.bashrc':   '# bash config\nexport PATH=$PATH:/usr/local/bin',
      '.profile':  '# profile loaded on login',
      '.ssh':      { 'config': 'Host *\n  ServerAliveInterval 60' },
    },
  },
  etc: {
    hosts:  '127.0.0.1 localhost\n::1 localhost',
    passwd: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000::/home/user:/bin/bash',
    apt:    { 'sources.list': 'deb http://archive.ubuntu.com/ubuntu focal main' },
  },
  var:  { log: { 'syslog': '[system log entries...]', 'auth.log': '[auth entries...]' } },
  tmp:  { 'session.tmp': '[temp data]' },
  usr:  { bin: {}, local: { bin: {} } },
};

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
  if (input.startsWith('/'))   return normalizePath(input);
  if (input === '..')          return normalizePath(cwd + '/..');
  if (input === '.')           return cwd;
  return normalizePath(cwd + '/' + input);
}

function cwdDisplay(cwd) {
  if (cwd === '/home/user')          return '~';
  if (cwd.startsWith('/home/user/')) return '~/' + cwd.slice('/home/user/'.length);
  return cwd;
}

/* ── Multi-step objective system ── */
const OBJECTIVES = [
  {
    id: 'go_documents',
    label: 'Navigate to ~/documents',
    desc: 'Use cd to move into the documents folder.',
    hint: 'Try: cd documents (if you\'re in ~) or cd ~/documents from anywhere.',
    validate: (cwd, _hist) => cwd === '/home/user/documents',
    successMsg: 'You moved into documents. cd is your primary navigation tool.',
  },
  {
    id: 'go_projects',
    label: 'Go deeper: cd into projects',
    desc: 'Navigate one level deeper into the projects subdirectory.',
    hint: 'You\'re in documents. Type: cd projects',
    validate: (cwd, _hist) => cwd === '/home/user/documents/projects',
    successMsg: 'One level deeper. Directories can nest as deep as you need.',
  },
  {
    id: 'go_back',
    label: 'Go back up with cd ..',
    desc: 'Use cd .. to go back to the parent directory.',
    hint: 'cd .. moves you one level up the tree.',
    validate: (cwd, hist) => hist.some(h => h.trim() === 'cd ..') && cwd === '/home/user/documents',
    successMsg: 'cd .. is how you climb back up the directory tree.',
  },
  {
    id: 'go_home',
    label: 'Return home with cd ~',
    desc: 'Jump straight back to your home directory.',
    hint: 'cd ~ or just cd will take you home from anywhere.',
    validate: (cwd, _hist) => cwd === '/home/user',
    successMsg: '~ is always home. cd ~ is a shortcut you\'ll use constantly.',
  },
  {
    id: 'absolute_path',
    label: 'Use an absolute path',
    desc: 'Navigate to /etc using an absolute path (starting with /).',
    hint: 'Absolute paths start with /. Try: cd /etc',
    validate: (cwd, _hist) => cwd === '/etc',
    successMsg: 'Absolute paths work from anywhere in the filesystem. / is the root.',
  },
];

/* ── Lesson definition ── */
const LESSON = {
  level:       '02',
  track:       'beginner',
  title:       'Moving Around',
  module:      'module_01 — foundations',
  description: [
    { text: 'The filesystem is a tree of directories. ' },
    { text: 'cd', code: true },
    { text: ' (change directory) is how you move through it. Paths can be ' },
    { text: 'relative', highlight: true },
    { text: ' (from where you are) or ' },
    { text: 'absolute', highlight: true },
    { text: ' (from the root ' },
    { text: '/', code: true },
    { text: '). ' },
    { text: '..', code: true },
    { text: ' means "parent directory" and ' },
    { text: '~', code: true },
    { text: ' is always your home.' },
  ],
  commands: [
    { name: 'cd <dir>',  desc: 'enter a directory' },
    { name: 'cd ..',     desc: 'go up one level' },
    { name: 'cd ~',      desc: 'go home' },
    { name: 'cd /',      desc: 'go to filesystem root' },
    { name: 'cd -',      desc: 'go to previous directory' },
    { name: 'pwd',       desc: 'show current path' },
    { name: 'ls',        desc: 'list contents' },
    { name: 'ls -la',    desc: 'list with hidden files' },
    { name: 'tree',      desc: 'show directory tree' },
    { name: 'clear',     desc: 'clear the screen' },
    { name: 'help',      desc: 'list all commands' },
  ],
  xp: 75,
  nextLevel: '/beginner/level-3',
};

const LESSONS_NAV = [
  { level: '01', title: 'Where Am I?',             status: 'done',   href: '/beginner/level-1' },
  { level: '02', title: 'Moving Around',           status: 'active', href: '/beginner/level-2' },
  { level: '03', title: 'Creating Things',         status: 'locked', href: '#' },
  { level: '04', title: 'Reading & Writing Files', status: 'locked', href: '#' },
  { level: '05', title: 'Permissions',             status: 'locked', href: '#' },
];

/* ── Output line renderer ── */
function OutputLine({ line }) {
  const colorMap = {
    green:  'text-[#3ddc84]',
    cyan:   'text-[#22d3ee]',
    yellow: 'text-[#f59e0b]',
    red:    'text-[#ff5252]',
    dim:    'text-[#444]',
    white:  'text-[#e0e0e0]',
    purple: 'text-[#c792ea]',
  };
  const cls = colorMap[line.color] || 'text-[#ccc]';

  if (line.type === 'prompt') {
    return (
      <div className="flex items-center gap-1 font-mono text-[13px] leading-relaxed">
        <span className="text-[#3ddc84] font-bold">user@linux</span>
        <span className="text-[#444]">:</span>
        <span className="text-[#64b5f6]">{line.path}</span>
        <span className="text-[#666]">$</span>
        <span className="text-[#e0e0e0] ml-1">{line.cmd}</span>
      </div>
    );
  }

  if (line.type === 'ls-grid') {
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-0.5 font-mono text-[13px]">
        {line.entries.map((e) => (
          <span key={e.name} style={{ color: e.isDir ? '#64b5f6' : '#ccc', fontWeight: e.isDir ? 700 : 400 }}>
            {e.name}{e.isDir ? '/' : ''}
          </span>
        ))}
      </div>
    );
  }

  if (line.type === 'ls-long') {
    return (
      <div className="font-mono text-[13px] flex gap-3">
        <span className="text-[#444]">{line.perm}</span>
        <span className="text-[#555]">{line.size.padStart(5)}</span>
        <span className="text-[#555]">{line.date}</span>
        <span style={{ color: line.isDir ? '#64b5f6' : '#ccc', fontWeight: line.isDir ? 700 : 400 }}>
          {line.name}{line.isDir ? '/' : ''}
        </span>
      </div>
    );
  }

  if (line.type === 'tree') {
    return (
      <div className="font-mono text-[12px] leading-[1.6]">
        {line.lines.map((l, i) => (
          <div key={i} style={{ color: l.isDir ? '#64b5f6' : '#888' }}>{l.text}</div>
        ))}
      </div>
    );
  }

  if (line.type === 'obj-complete') {
    return (
      <div className="flex items-start gap-2 bg-[#0a1a0a] border border-[#3ddc84]/30 rounded px-3 py-2 my-1">
        <span className="text-[#3ddc84] text-[13px] mt-[1px]">✓</span>
        <div>
          <div className="text-[12px] text-[#3ddc84] font-bold">{line.label}</div>
          <div className="text-[11px] text-[#555] mt-0.5">{line.msg}</div>
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

/* ── Tree builder ── */
function buildTree(node, prefix = '', name = '/', depth = 0) {
  const lines = [];
  if (depth === 0) {
    lines.push({ text: '.', isDir: true });
  }
  if (typeof node !== 'object' || depth > 3) return lines;
  const keys = Object.keys(node);
  keys.forEach((key, idx) => {
    const isLast  = idx === keys.length - 1;
    const isDir   = typeof node[key] === 'object';
    const branch  = isLast ? '└── ' : '├── ';
    const child   = isLast ? '    ' : '│   ';
    lines.push({ text: prefix + branch + key + (isDir ? '/' : ''), isDir });
    if (isDir && depth < 2) {
      const sub = buildTree(node[key], prefix + child, key, depth + 1);
      lines.push(...sub);
    }
  });
  return lines;
}

/* ── Main component ── */
export default function Level2Page() {
  const [cwd, setCwd]             = useState('/home/user');
  const [prevCwd, setPrevCwd]     = useState('/home/user');
  const [output, setOutput]       = useState([]);
  const [inputVal, setInputVal]   = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx]     = useState(-1);
  const [hintOpen, setHintOpen]   = useState(false);
  const [objIdx, setObjIdx]       = useState(0);
  const [completed, setCompleted] = useState([]);
  const [levelDone, setLevelDone] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allHistory, setAllHistory] = useState([]);

  const inputRef  = useRef(null);
  const outputRef = useRef(null);
  const cwdRef    = useRef(cwd);
  cwdRef.current  = cwd;
  const allHistRef = useRef(allHistory);
  allHistRef.current = allHistory;

  const progress = levelDone ? 100 : Math.round((completed.length / OBJECTIVES.length) * 90);
  const currentObj = OBJECTIVES[objIdx];

  /* boot */
  useEffect(() => {
    setOutput([
      { id: 0, type: 'text', color: 'dim',    text: 'Linux Learning Platform  —  bash 5.2.21' },
      { id: 1, type: 'text', color: 'dim',    text: "Type 'help' to see available commands. Use 'tree' to visualize the filesystem." },
      { id: 2, type: 'text', color: 'dim',    text: '' },
      { id: 3, type: 'text', color: 'green',  text: 'Welcome to Level 02 — Moving Around' },
      { id: 4, type: 'text', color: 'yellow', text: `Objective 1/${OBJECTIVES.length}: ${OBJECTIVES[0].label}` },
      { id: 5, type: 'text', color: 'dim',    text: OBJECTIVES[0].desc },
      { id: 6, type: 'text', color: 'dim',    text: '' },
    ]);
    inputRef.current?.focus();
  }, []);

  /* auto-scroll */
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const addLines = useCallback((lines) => {
    setOutput(prev => {
      const base = prev.length;
      return [...prev, ...lines.map((l, i) => ({ ...l, id: base + i }))];
    });
  }, []);

  const runCommand = useCallback((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const currentCwd = cwdRef.current;
    setCmdHistory(prev => [trimmed, ...prev]);
    setHistIdx(-1);

    const newAllHistory = [trimmed, ...allHistRef.current];
    setAllHistory(newAllHistory);

    const promptLine = { type: 'prompt', path: cwdDisplay(currentCwd), cmd: trimmed };
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd   = parts[0];
    const args  = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

    let responseLines = [];
    let newCwd = currentCwd;

    switch (cmd) {
      case 'pwd': {
        responseLines = [{ type: 'text', color: 'cyan', text: currentCwd }];
        break;
      }
      case 'whoami': {
        responseLines = [{ type: 'text', color: 'white', text: 'user' }];
        break;
      }
      case 'ls': {
        const showHidden = args.some(a => a.includes('a'));
        const longFmt    = args.some(a => a.includes('l'));
        const targetArg  = args.find(a => !a.startsWith('-'));
        const targetPath = targetArg ? resolvePath(targetArg, currentCwd) : currentCwd;
        const node = getNode(targetPath);
        if (!node || typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `ls: cannot access '${targetArg || '.'}': No such file or directory` }];
          break;
        }
        const entries = Object.keys(node).filter(k => showHidden || !k.startsWith('.'));
        if (entries.length === 0) { responseLines = [{ type: 'text', color: 'dim', text: '(empty directory)' }]; break; }
        if (longFmt) {
          responseLines = [
            { type: 'text', color: 'dim', text: 'total ' + entries.length * 4 },
            ...entries.map(e => {
              const isDir = typeof node[e] === 'object';
              const min   = String(Math.floor(Math.random() * 60)).padStart(2, '0');
              return {
                type:  'ls-long',
                perm:  isDir ? 'drwxr-xr-x' : '-rw-r--r--',
                size:  isDir ? '4096' : String((node[e] || '').length),
                date:  `Apr 20 10:${min}`,
                name:  e,
                isDir,
              };
            }),
          ];
        } else {
          responseLines = [{
            type: 'ls-grid',
            entries: entries.map(e => ({ name: e, isDir: typeof node[e] === 'object' })),
          }];
        }
        break;
      }
      case 'cd': {
        const target = args[0];
        // cd - goes to previous
        if (target === '-') {
          const prev = prevCwd;
          setPrevCwd(currentCwd);
          setCwd(prev);
          cwdRef.current = prev;
          newCwd = prev;
          responseLines = [{ type: 'text', color: 'cyan', text: prev }];
          break;
        }
        const resolved = resolvePath(target, currentCwd);
        const node     = getNode(resolved);
        if (node === null) {
          responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: No such file or directory` }];
        } else if (typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: Not a directory` }];
        } else {
          setPrevCwd(currentCwd);
          setCwd(resolved);
          cwdRef.current = resolved;
          newCwd = resolved;
          responseLines = [];
        }
        break;
      }
      case 'cat': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'cat: missing operand' }]; break; }
        const filePath = resolvePath(args[0], currentCwd);
        const node = getNode(filePath);
        if (node === null) {
          responseLines = [{ type: 'text', color: 'red', text: `cat: ${args[0]}: No such file or directory` }];
        } else if (typeof node === 'object') {
          responseLines = [{ type: 'text', color: 'red', text: `cat: ${args[0]}: Is a directory` }];
        } else {
          responseLines = (node || '(empty file)').split('\n').map(t => ({ type: 'text', color: 'white', text: t }));
        }
        break;
      }
      case 'echo': {
        responseLines = [{ type: 'text', color: 'white', text: args.join(' ') }];
        break;
      }
      case 'tree': {
        const targetArg = args.find(a => !a.startsWith('-'));
        const targetPath = targetArg ? resolvePath(targetArg, currentCwd) : currentCwd;
        const node = getNode(targetPath);
        if (!node || typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `tree: ${targetArg || '.'}: No such file or directory` }];
          break;
        }
        const treeLines = buildTree(node);
        responseLines = [{ type: 'tree', lines: treeLines }];
        break;
      }
      case 'clear': {
        setOutput([]);
        return;
      }
      case 'help': {
        responseLines = [
          { type: 'text', color: 'green',  text: 'Available commands:' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'white',  text: '  cd <dir>  — change directory' },
          { type: 'text', color: 'white',  text: '  cd ..     — go up one level' },
          { type: 'text', color: 'white',  text: '  cd ~      — go to home directory' },
          { type: 'text', color: 'white',  text: '  cd /      — go to filesystem root' },
          { type: 'text', color: 'white',  text: '  cd -      — go to previous directory' },
          { type: 'text', color: 'white',  text: '  pwd       — print working directory' },
          { type: 'text', color: 'white',  text: '  ls        — list contents  (-a hidden, -l long)' },
          { type: 'text', color: 'white',  text: '  tree      — display directory tree' },
          { type: 'text', color: 'white',  text: '  whoami    — print username' },
          { type: 'text', color: 'white',  text: '  cat       — read a file' },
          { type: 'text', color: 'white',  text: '  echo      — print text' },
          { type: 'text', color: 'white',  text: '  clear     — clear the screen' },
          { type: 'text', color: 'white',  text: '  help      — this message' },
        ];
        break;
      }
      default: {
        responseLines = [{ type: 'text', color: 'red', text: `bash: ${cmd}: command not found` }];
      }
    }

    addLines([promptLine, ...responseLines, { type: 'text', color: 'dim', text: '' }]);

    /* check current objective */
    setObjIdx(prevIdx => {
      if (levelDone) return prevIdx;
      const obj = OBJECTIVES[prevIdx];
      if (!obj) return prevIdx;
      if (obj.validate(newCwd, newAllHistory)) {
        // objective complete!
        const nextIdx = prevIdx + 1;
        setTimeout(() => {
          addLines([
            {
              type:  'obj-complete',
              label: `✓ Objective ${prevIdx + 1}/${OBJECTIVES.length}: ${obj.label}`,
              msg:   obj.successMsg,
            },
            { type: 'text', color: 'dim', text: '' },
          ]);
          setCompleted(prev => [...prev, obj.id]);
          if (nextIdx >= OBJECTIVES.length) {
            setLevelDone(true);
            setTimeout(() => {
              addLines([
                { type: 'text', color: 'green', text: '✓ All objectives complete! Level 02 passed.' },
              ]);
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const val = inputVal;
      setInputVal('');
      runCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistIdx(prev => {
        const next = Math.min(prev + 1, cmdHistory.length - 1);
        setInputVal(cmdHistory[next] || '');
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistIdx(prev => {
        const next = Math.max(prev - 1, -1);
        setInputVal(next === -1 ? '' : cmdHistory[next] || '');
        return next;
      });
    }
  };

  return (
    <div
      className="h-screen flex flex-col bg-[#080c08] text-[#e0e0e0] overflow-hidden font-mono"
      onClick={() => inputRef.current?.focus()}
    >
      {/* ── TOP BAR ── */}
      <header className="h-11 flex-shrink-0 bg-[#0d120d] border-b border-[#1a2e1a] flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden text-[#444] hover:text-[#3ddc84] transition-colors mr-1"
            onClick={(e) => { e.stopPropagation(); setSidebarOpen(o => !o); }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect y="2" width="16" height="1.5" rx="1"/>
              <rect y="7" width="16" height="1.5" rx="1"/>
              <rect y="12" width="16" height="1.5" rx="1"/>
            </svg>
          </button>
          <div className="w-6 h-6 rounded border border-[#3ddc84]/40 flex items-center justify-center">
            <span className="text-[#3ddc84] text-xs font-bold">$_</span>
          </div>
          <span className="text-white text-xs font-bold tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            LinuxMastery
          </span>
        </div>

        <div className="flex items-center gap-2">
          {LESSONS_NAV.map((l) => (
            <a
              key={l.level}
              href={l.href}
              title={`Level ${l.level}: ${l.title}`}
              className={`w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
                l.status === 'done'
                  ? 'bg-[#3ddc84] border-[#3ddc84]'
                  : l.status === 'active'
                  ? 'bg-[#f59e0b] border-[#f59e0b] shadow-[0_0_6px_#f59e0b88]'
                  : 'bg-[#1a2e1a] border-[#2a4a2a]'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#3ddc84] border border-[#3ddc84]/20 bg-[#3ddc84]/5 px-2 py-0.5 rounded font-mono">
            +{LESSON.xp} XP
          </span>
          <a href="/" className="text-xs text-[#444] hover:text-[#3ddc84] transition-colors">exit</a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <aside
          className={`
            w-72 flex-shrink-0 bg-[#0d120d] border-r border-[#1a2e1a] flex flex-col overflow-hidden
            md:relative md:translate-x-0
            absolute inset-y-0 left-0 z-30 transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          onClick={e => e.stopPropagation()}
        >
          {/* Lesson header */}
          <div className="bg-[#0a1a0a] border-b border-[#1a2e1a] px-5 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#3ddc84] font-bold tracking-[0.15em] uppercase">
                Level {LESSON.level}
              </span>
              <span className="text-[10px] text-[#444] font-mono">{LESSON.track}</span>
            </div>
            <h1 className="text-white font-bold text-base leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              {LESSON.title}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">

            {/* Description */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">Description</div>
              <p className="text-[12px] text-[#888] leading-[1.8]">
                {LESSON.description.map((seg, i) => {
                  if (seg.code) return <code key={i} className="text-[#3ddc84] bg-[#0a1a0a] px-1 rounded text-[11px]">{seg.text}</code>;
                  if (seg.highlight) return <span key={i} className="text-[#3ddc84]">{seg.text}</span>;
                  return <span key={i}>{seg.text}</span>;
                })}
              </p>
            </div>

            {/* Objectives tracker */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">
                Objectives
                <span className="ml-2 text-[#444] normal-case tracking-normal">
                  {completed.length}/{OBJECTIVES.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {OBJECTIVES.map((obj, i) => {
                  const done    = completed.includes(obj.id);
                  const active  = i === objIdx && !levelDone;
                  return (
                    <div
                      key={obj.id}
                      className={`flex items-start gap-2.5 px-2.5 py-2 rounded text-[11px] transition-colors ${
                        done   ? 'bg-[#0a1a0a] border border-[#1a3a1a]' :
                        active ? 'bg-[#3ddc84]/5 border border-[#3ddc84]/20' :
                                 'border border-transparent'
                      }`}
                    >
                      <span className={`mt-[2px] flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold ${
                        done   ? 'border-[#3ddc84] bg-[#3ddc84] text-black' :
                        active ? 'border-[#f59e0b] text-[#f59e0b]' :
                                 'border-[#2a2a2a] text-[#333]'
                      }`}>
                        {done ? '✓' : i + 1}
                      </span>
                      <div>
                        <div className={done ? 'text-[#444] line-through' : active ? 'text-[#e0e0e0]' : 'text-[#333]'}>
                          {obj.label}
                        </div>
                        {active && (
                          <div className="text-[#555] mt-0.5 leading-relaxed">{obj.desc}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hint for current objective */}
            {!levelDone && currentObj && (
              <div>
                <button
                  className={`w-full text-left border rounded px-3 py-2 text-[11px] transition-all duration-200 ${
                    hintOpen
                      ? 'border-[#3a2800] text-[#ffa000] bg-[#1a1200]'
                      : 'border-[#2a2a2a] text-[#555] hover:border-[#ffa000] hover:text-[#ffa000]'
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

            {/* Command reference */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">Commands</div>
              <div className="space-y-1.5">
                {LESSON.commands.map((c) => (
                  <div key={c.name} className="flex gap-3 items-baseline">
                    <code className="text-[11px] text-[#3ddc84] font-bold min-w-[72px]">{c.name}</code>
                    <span className="text-[11px] text-[#444]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Path cheatsheet */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">Path Syntax</div>
              <div className="bg-[#0a1a0a] border border-[#1a2e1a] rounded p-3 space-y-2 text-[11px]">
                <div className="flex gap-2">
                  <code className="text-[#3ddc84] min-w-[28px]">/</code>
                  <span className="text-[#555]">filesystem root</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-[#3ddc84] min-w-[28px]">~</code>
                  <span className="text-[#555]">your home dir</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-[#3ddc84] min-w-[28px]">.</code>
                  <span className="text-[#555]">current directory</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-[#3ddc84] min-w-[28px]">..</code>
                  <span className="text-[#555]">parent directory</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-[#3ddc84] min-w-[28px]">-</code>
                  <span className="text-[#555]">previous directory</span>
                </div>
              </div>
            </div>

            {/* Level nav */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">Module</div>
              <div className="space-y-0.5">
                {LESSONS_NAV.map((l) => (
                  <a
                    key={l.level}
                    href={l.status === 'locked' ? undefined : l.href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-[11px] transition-colors duration-150 ${
                      l.status === 'active'
                        ? 'bg-[#3ddc84]/8 text-white'
                        : l.status === 'done'
                        ? 'text-[#555] hover:text-[#888]'
                        : 'text-[#333] cursor-default'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      l.status === 'done'   ? 'bg-[#3ddc84]' :
                      l.status === 'active' ? 'bg-[#f59e0b]' :
                      'bg-[#2a2a2a]'
                    }`} />
                    <span>{l.level}</span>
                    <span className="text-[#333] mx-0.5">—</span>
                    <span className="truncate">{l.title}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-[3px] bg-[#111] border-t border-[#1a2e1a] flex-shrink-0">
            <div
              className="h-full bg-[#3ddc84] transition-all duration-500"
              style={{ width: `${progress}%`, boxShadow: '0 0 8px #3ddc8460' }}
            />
          </div>
        </aside>

        {/* ── TERMINAL ── */}
        <div className="flex-1 bg-[#000] flex flex-col overflow-hidden relative">

          {/* Terminal title bar */}
          <div className="h-[34px] bg-[#0d0d0d] border-b border-[#1a1a1a] flex-shrink-0 flex items-center justify-between px-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[11px] text-[#333] tracking-[0.05em]">bash — user@linux</span>
            <div className="flex items-center gap-2">
              {levelDone ? (
                <span className="text-[10px] text-[#3ddc84] border border-[#3ddc84]/30 px-2 py-0.5 rounded-full">
                  ✓ complete
                </span>
              ) : (
                <span className="text-[10px] text-[#444] font-mono">
                  {completed.length}/{OBJECTIVES.length} done
                </span>
              )}
            </div>
          </div>

          {/* Output */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-[2px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a #000' }}
          >
            {output.map((line) => (
              <OutputLine key={line.id} line={line} />
            ))}
          </div>

          {/* Success toast */}
          {showToast && (
            <div className="absolute bottom-[72px] right-5 bg-[#0a1a0a] border border-[#3ddc84] rounded-lg px-5 py-4 w-72 shadow-[0_0_24px_#3ddc8418] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#3ddc84] font-bold mb-1.5">✓ Level 02 complete!</div>
              <div className="text-[11px] text-[#666] leading-relaxed mb-1">
                You can now navigate any Linux filesystem — relative paths, absolute paths, and handy shortcuts like <code className="text-[#3ddc84]">~</code> and <code className="text-[#3ddc84]">-</code>.
              </div>
              <div className="text-[11px] text-[#3ddc84]/60 mb-3">+{LESSON.xp} XP earned</div>
              <div className="flex gap-2">
                <a
                  href={LESSON.nextLevel}
                  className="flex-1 bg-[#3ddc84] text-black text-[12px] font-bold py-1.5 rounded text-center hover:bg-[#3ddc84]/90 transition-opacity"
                >
                  Next Level →
                </a>
                <button
                  onClick={() => setShowToast(false)}
                  className="text-[11px] text-[#444] hover:text-[#666] px-2"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Input row */}
          <div className="flex-shrink-0 border-t border-[#111] px-5 py-3 flex items-center gap-2">
            <div className="flex items-center gap-1 flex-shrink-0 text-[13px]">
              <span className="text-[#3ddc84] font-bold">user</span>
              <span className="text-[#444]">@</span>
              <span className="text-[#3ddc84] font-bold">linux</span>
              <span className="text-[#444]">:</span>
              <span className="text-[#64b5f6]">{cwdDisplay(cwd)}</span>
              <span className="text-[#666]">$</span>
            </div>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#e0e0e0] caret-[#3ddc84] font-mono"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 3px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #1a2e1a; border-radius: 2px; }
      `}</style>
    </div>
  );
}