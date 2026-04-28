'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Virtual Filesystem ── */
const FS = {
  home: {
    user: {
      documents: {
        'report.txt':  'Q3 Financial Report\nRevenue: $1.2M\nExpenses: $0.8M',
        'notes.md':    '# Meeting Notes\n- Follow up with team\n- Review Q3 numbers',
      },
      downloads: {
        'setup.sh':    '#!/bin/bash\necho "installing..."',
        'archive.tar': '[binary data]',
      },
      '.bashrc':   '# bash config\nexport PATH=$PATH:/usr/local/bin',
      '.profile':  '# profile loaded on login',
    },
  },
  etc: {
    hosts:  '127.0.0.1 localhost\n::1 localhost',
    passwd: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000::/home/user:/bin/bash',
  },
  var:  { log: { syslog: '[system log entries...]' } },
  tmp:  {},
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

/* ── Lesson definition ── */
const LESSON = {
  level:       '01',
  track:       'beginner',
  title:       'Where Am I?',
  module:      'module_01 — foundations',
  description: [
    { text: 'When you open a terminal, you land somewhere in the ' },
    { text: 'filesystem', highlight: true },
    { text: '. That place is called your ' },
    { text: 'working directory', highlight: true },
    { text: '. Three commands help you get your bearings: ' },
    { text: 'pwd', code: true },
    { text: ', ' },
    { text: 'ls', code: true },
    { text: ', and ' },
    { text: 'whoami', code: true },
    { text: '.' },
  ],
  objective:   'Run pwd to print your current directory path.',
  hint:        'Just type pwd and press Enter. You should see /home/user printed back.',
  commands: [
    { name: 'pwd',    desc: 'print working directory' },
    { name: 'ls',     desc: 'list directory contents' },
    { name: 'whoami', desc: 'print current username' },
    { name: 'ls -a',  desc: 'show hidden files too' },
    { name: 'ls -l',  desc: 'long listing with details' },
    { name: 'clear',  desc: 'clear the terminal screen' },
    { name: 'help',   desc: 'list all commands' },
  ],
  validate: (cwd, history) => history.some(h => h.trim() === 'pwd'),
  successMsg: 'You ran pwd and found your location. That\'s the first skill every Linux user needs.',
  nextLevel: '/learn/beginner/level-2',
  xp: 50,
};

const LESSONS_NAV = [
  { level: '01', title: 'Where Am I?',              status: 'active',  href: '/learn/beginner/level-1' },
  { level: '02', title: 'Moving Around',            status: 'locked',  href: '/learn/beginner/level-2' },
  { level: '03', title: 'Creating Things',          status: 'locked',  href: '#' },
  { level: '04', title: 'Reading & Writing Files',  status: 'locked',  href: '#' },
  { level: '05', title: 'Permissions',              status: 'locked',  href: '#' },
];

/* ── Output line type ── */
function OutputLine({ line }) {
  const colorMap = {
    green:  'text-[#3ddc84]',
    cyan:   'text-[#22d3ee]',
    yellow: 'text-[#f59e0b]',
    red:    'text-[#ff5252]',
    dim:    'text-[#444]',
    white:  'text-[#e0e0e0]',
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

  return (
    <div className={`font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all ${cls}`}>
      {line.text}
    </div>
  );
}

/* ── Main component ── */
export default function Level1Page() {
  const [cwd, setCwd]               = useState('/home/user');
  const [output, setOutput]         = useState([]);
  const [inputVal, setInputVal]     = useState('');
  const [history, setHistory]       = useState([]);
  const [histIdx, setHistIdx]       = useState(-1);
  const [hintOpen, setHintOpen]     = useState(false);
  const [levelDone, setLevelDone]   = useState(false);
  const [attempts, setAttempts]     = useState(0);
  const [progress, setProgress]     = useState(0);
  const [showToast, setShowToast]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const inputRef  = useRef(null);
  const outputRef = useRef(null);
  const cwdRef    = useRef(cwd);
  cwdRef.current  = cwd;

  /* boot messages */
  useEffect(() => {
    setOutput([
      { id: 0, type: 'text', color: 'dim',    text: 'Linux Learning Platform  —  bash 5.2.21' },
      { id: 1, type: 'text', color: 'dim',    text: "Type 'help' to see available commands." },
      { id: 2, type: 'text', color: 'dim',    text: '' },
      { id: 3, type: 'text', color: 'green',  text: 'Welcome to Level 01 — Where Am I?' },
      { id: 4, type: 'text', color: 'yellow', text: 'Objective: run pwd to print your working directory.' },
      { id: 5, type: 'text', color: 'dim',    text: '' },
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
    setHistory(prev => [trimmed, ...prev]);
    setHistIdx(-1);

    /* echo the prompt line */
    const promptLine = { type: 'prompt', path: cwdDisplay(currentCwd), cmd: trimmed };

    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd   = parts[0];
    const args  = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    let responseLines = [];

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
        const node = getNode(currentCwd);
        if (!node || typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: 'ls: cannot access directory' }];
          break;
        }
        const entries = Object.keys(node).filter(k => showHidden || !k.startsWith('.'));
        if (entries.length === 0) { responseLines = [{ type: 'text', color: 'dim', text: '' }]; break; }

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
        const target   = args[0] || '~';
        const resolved = resolvePath(target, currentCwd);
        const node     = getNode(resolved);
        if (node === null) {
          responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: No such file or directory` }];
        } else if (typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: Not a directory` }];
        } else {
          setCwd(resolved);
          cwdRef.current = resolved;
          responseLines = [];
        }
        break;
      }
      case 'cat': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'cat: missing operand' }]; break; }
        const node = getNode(currentCwd);
        if (!node || !(args[0] in node)) {
          responseLines = [{ type: 'text', color: 'red', text: `cat: ${args[0]}: No such file or directory` }];
        } else if (typeof node[args[0]] === 'object') {
          responseLines = [{ type: 'text', color: 'red', text: `cat: ${args[0]}: Is a directory` }];
        } else {
          responseLines = (node[args[0]] || '(empty file)').split('\n').map(t => ({ type: 'text', color: 'white', text: t }));
        }
        break;
      }
      case 'echo': {
        responseLines = [{ type: 'text', color: 'white', text: args.join(' ').replace(/^"|"$/g, '') }];
        break;
      }
      case 'clear': {
        setOutput([]);
        return;
      }
      case 'help': {
        responseLines = [
          { type: 'text', color: 'green', text: 'Available commands:' },
          { type: 'text', color: 'dim',   text: '' },
          { type: 'text', color: 'white', text: '  pwd     — print working directory' },
          { type: 'text', color: 'white', text: '  ls      — list contents  (-a hidden, -l long)' },
          { type: 'text', color: 'white', text: '  whoami  — print current username' },
          { type: 'text', color: 'white', text: '  cd      — change directory' },
          { type: 'text', color: 'white', text: '  cat     — read file contents' },
          { type: 'text', color: 'white', text: '  echo    — print text' },
          { type: 'text', color: 'white', text: '  clear   — clear the screen' },
          { type: 'text', color: 'white', text: '  help    — show this message' },
        ];
        break;
      }
      default: {
        responseLines = [{ type: 'text', color: 'red', text: `bash: ${cmd}: command not found` }];
      }
    }

    addLines([promptLine, ...responseLines, { type: 'text', color: 'dim', text: '' }]);

    /* progress bar */
    const pct = Math.min((newAttempts / 5) * 80, 80);
    setProgress(levelDone ? 100 : pct);

    /* auto-hint after 4 attempts */
    if (newAttempts >= 4 && !hintOpen && !levelDone) {
      setHintOpen(true);
      addLines([{ type: 'text', color: 'yellow', text: '💡 Hint revealed after 4 attempts.' }]);
    }

    /* validate */
    const allHistory = [trimmed, ...history];
    if (!levelDone && LESSON.validate(cwdRef.current, allHistory)) {
      setLevelDone(true);
      setProgress(100);
      setTimeout(() => {
        addLines([
          { type: 'text', color: 'dim',   text: '' },
          { type: 'text', color: 'green', text: '✓ Objective complete! Level passed.' },
        ]);
        setShowToast(true);
      }, 300);
    }
  }, [attempts, history, hintOpen, levelDone, addLines]);

  /* input keydown */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const val = inputVal;
      setInputVal('');
      runCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistIdx(prev => {
        const next = Math.min(prev + 1, history.length - 1);
        setInputVal(history[next] || '');
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistIdx(prev => {
        const next = Math.max(prev - 1, -1);
        setInputVal(next === -1 ? '' : history[next] || '');
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
          {/* mobile sidebar toggle */}
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

        {/* Level dots */}
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
        <aside className={`
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

            {/* Objective */}
            <div className="bg-[#0a1a0a] border border-[#1a2e1a] border-l-[3px] border-l-[#3ddc84] rounded p-3">
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-1.5">Objective</div>
              <p className="text-[12px] text-[#ccc] leading-[1.65]">{LESSON.objective}</p>
            </div>

            {/* Hint */}
            <div>
              <button
                className={`w-full text-left border rounded px-3 py-2 text-[11px] transition-all duration-200 ${
                  hintOpen
                    ? 'border-[#3a2800] text-[#ffa000] bg-[#1a1200]'
                    : 'border-[#2a2a2a] text-[#555] hover:border-[#ffa000] hover:text-[#ffa000]'
                }`}
                onClick={() => setHintOpen(o => !o)}
              >
                {hintOpen ? '[ hide hint ]' : '[ show hint ]'}
              </button>
              {hintOpen && (
                <div className="mt-2 bg-[#1a1200] border border-[#3a2800] rounded px-3 py-2.5 text-[11px] text-[#ffa000] leading-[1.7]">
                  {LESSON.hint}
                </div>
              )}
            </div>

            {/* Command reference */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">Commands</div>
              <div className="space-y-1.5">
                {LESSON.commands.map((c) => (
                  <div key={c.name} className="flex gap-3 items-baseline">
                    <code className="text-[11px] text-[#3ddc84] font-bold min-w-[64px]">{c.name}</code>
                    <span className="text-[11px] text-[#444]">{c.desc}</span>
                  </div>
                ))}
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
              {levelDone && (
                <span className="text-[10px] text-[#3ddc84] border border-[#3ddc84]/30 px-2 py-0.5 rounded-full">
                  ✓ complete
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
            <div className="absolute bottom-[72px] right-5 bg-[#0a1a0a] border border-[#3ddc84] rounded-lg px-5 py-4 w-64 shadow-[0_0_24px_#3ddc8418] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#3ddc84] font-bold mb-1.5">✓ Level complete!</div>
              <div className="text-[11px] text-[#666] leading-relaxed mb-3">{LESSON.successMsg}</div>
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
