'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Virtual Filesystem (mutable) ── */
function makeFS() {
  return {
    home: {
      user: {
        documents: {
          'report.txt': 'Q3 Financial Report\nRevenue: $1.2M\nExpenses: $0.8M',
          'notes.md':   '# Meeting Notes\n- Follow up with team\n- Review Q3 numbers',
        },
        downloads: {
          'setup.sh':   '#!/bin/bash\necho "installing..."',
        },
        '.bashrc':  '# bash config\nexport PATH=$PATH:/usr/local/bin',
      },
    },
    etc: {
      hosts:  '127.0.0.1 localhost\n::1 localhost',
    },
    tmp: {},
  };
}

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

function getNode(fs, path) {
  if (path === '/') return fs;
  const parts = path.split('/').filter(Boolean);
  let node = fs;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return null;
  }
  return node;
}

function getParentAndKey(path) {
  const parts = path.split('/').filter(Boolean);
  const key   = parts[parts.length - 1];
  const parentPath = '/' + parts.slice(0, -1).join('/');
  return { parentPath, key };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ── Objectives ── */
const OBJECTIVES = [
  {
    id:   'mkdir_workspace',
    label: 'Create a directory called workspace',
    desc:  'Use mkdir to create a new directory named workspace in your home folder.',
    hint:  'Make sure you\'re in ~ first, then: mkdir workspace',
    validate: (fs, _cwd, hist) =>
      hist.some(h => /^mkdir\s+(~\/workspace|workspace|\/home\/user\/workspace)$/.test(h.trim())) &&
      typeof getNode(fs, '/home/user/workspace') === 'object',
    successMsg: 'mkdir creates directories instantly. No confirmation needed — just run it.',
  },
  {
    id:   'touch_file',
    label: 'Create an empty file: workspace/readme.txt',
    desc:  'Use touch to create an empty file inside your new workspace directory.',
    hint:  'cd workspace first, then: touch readme.txt  — or use the path directly: touch workspace/readme.txt',
    validate: (fs, _cwd, _hist) =>
      getNode(fs, '/home/user/workspace/readme.txt') === '',
    successMsg: 'touch creates empty files. It also updates timestamps on existing ones.',
  },
  {
    id:   'copy_file',
    label: 'Copy documents/notes.md into workspace/',
    desc:  'Use cp to duplicate a file from one location to another.',
    hint:  'From ~: cp documents/notes.md workspace/notes.md',
    validate: (fs, _cwd, _hist) =>
      typeof getNode(fs, '/home/user/workspace/notes.md') === 'string',
    successMsg: 'cp duplicates files. The original stays; a new copy is created at the destination.',
  },
  {
    id:   'move_file',
    label: 'Rename workspace/readme.txt to workspace/index.txt',
    desc:  'Use mv to rename a file (mv is both move and rename).',
    hint:  'mv workspace/readme.txt workspace/index.txt',
    validate: (fs, _cwd, _hist) =>
      getNode(fs, '/home/user/workspace/readme.txt') === null &&
      typeof getNode(fs, '/home/user/workspace/index.txt') === 'string',
    successMsg: 'mv renames when source and destination are in the same directory. It also moves between directories.',
  },
  {
    id:   'remove_file',
    label: 'Delete workspace/index.txt with rm',
    desc:  'Use rm to permanently remove a file. There is no trash — it\'s gone.',
    hint:  'rm workspace/index.txt  — WARNING: rm is permanent, no undo!',
    validate: (fs, _cwd, _hist) =>
      getNode(fs, '/home/user/workspace/index.txt') === null,
    successMsg: 'rm is permanent. Always double-check before running it. Use rm -i for confirmation prompts.',
  },
  {
    id:   'mkdir_nested',
    label: 'Create nested dirs: workspace/src/components',
    desc:  'Use mkdir -p to create a whole directory path in one command.',
    hint:  'mkdir -p workspace/src/components  — the -p flag creates all missing parent dirs.',
    validate: (fs, _cwd, _hist) =>
      typeof getNode(fs, '/home/user/workspace/src/components') === 'object',
    successMsg: 'mkdir -p is a lifesaver. It creates the full path without errors if parents already exist.',
  },
];

const LESSONS_NAV = [
  { level: '01', title: 'Where Am I?',             status: 'done',   href: '/learn/beginner/level-1' },
  { level: '02', title: 'Moving Around',           status: 'done',   href: '/learn/beginner/level-2' },
  { level: '03', title: 'File & Dir Management',   status: 'active', href: '/learn/beginner/level-3' },
  { level: '04', title: 'Reading & Writing Files', status: 'locked', href: '#' },
  { level: '05', title: 'Permissions',             status: 'locked', href: '#' },
];

const LESSON = {
  level:   '03',
  track:   'beginner',
  title:   'File & Dir Management',
  module:  'module_01 — foundations',
  description: [
    { text: 'Linux gives you five essential tools for managing files: ' },
    { text: 'mkdir', code: true },
    { text: ' creates directories, ' },
    { text: 'touch', code: true },
    { text: ' creates empty files, ' },
    { text: 'cp', code: true },
    { text: ' copies, ' },
    { text: 'mv', code: true },
    { text: ' moves or renames, and ' },
    { text: 'rm', code: true },
    { text: ' deletes. Master these and you can manage any filesystem.' },
  ],
  commands: [
    { name: 'mkdir <dir>',        desc: 'create a directory' },
    { name: 'mkdir -p <path>',    desc: 'create nested dirs' },
    { name: 'touch <file>',       desc: 'create empty file' },
    { name: 'cp <src> <dst>',     desc: 'copy a file' },
    { name: 'cp -r <src> <dst>',  desc: 'copy directory recursively' },
    { name: 'mv <src> <dst>',     desc: 'move or rename' },
    { name: 'rm <file>',          desc: 'delete a file' },
    { name: 'rm -r <dir>',        desc: 'delete directory recursively' },
    { name: 'rm -i <file>',       desc: 'confirm before deleting' },
    { name: 'ls / pwd / cd',      desc: 'navigate as usual' },
    { name: 'tree',               desc: 'visualize directory tree' },
    { name: 'clear / help',       desc: 'utility commands' },
  ],
  xp:        100,
  nextLevel: '/learn/beginner/level-4',
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
    if (isDir && depth < 2) {
      lines.push(...buildTree(node[key], prefix + (isLast ? '    ' : '│   '), depth + 1));
    }
  });
  return lines;
}

/* ── Output renderer ── */
function OutputLine({ line }) {
  const colorMap = {
    green:  'text-[#3ddc84]',
    cyan:   'text-[#22d3ee]',
    yellow: 'text-[#f59e0b]',
    red:    'text-[#ff5252]',
    dim:    'text-[#444]',
    white:  'text-[#e0e0e0]',
    orange: 'text-[#fb923c]',
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
          <div className="text-[11px] text-[#555] mt-0.5 leading-relaxed">{line.msg}</div>
        </div>
      </div>
    );
  }

  if (line.type === 'warning') {
    return (
      <div className="flex items-start gap-2 bg-[#1a0e00] border border-[#f59e0b]/30 rounded px-3 py-2 my-0.5">
        <span className="text-[#f59e0b] text-[12px]">⚠</span>
        <div className="text-[12px] text-[#f59e0b] leading-relaxed">{line.text}</div>
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
export default function Level3Page() {
  const [fs, setFs]               = useState(() => makeFS());
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

  const inputRef   = useRef(null);
  const outputRef  = useRef(null);
  const cwdRef     = useRef(cwd);
  cwdRef.current   = cwd;
  const fsRef      = useRef(fs);
  fsRef.current    = fs;
  const allHistRef = useRef(allHistory);
  allHistRef.current = allHistory;

  const progress = levelDone ? 100 : Math.round((completed.length / OBJECTIVES.length) * 90);
  const currentObj = OBJECTIVES[objIdx];

  useEffect(() => {
    setOutput([
      { id: 0, type: 'text', color: 'dim',    text: 'Linux Learning Platform  —  bash 5.2.21' },
      { id: 1, type: 'text', color: 'dim',    text: "Type 'help' to see all commands. Use 'tree' to inspect the filesystem." },
      { id: 2, type: 'text', color: 'dim',    text: '' },
      { id: 3, type: 'text', color: 'green',  text: 'Welcome to Level 03 — File & Directory Management' },
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

  const runCommand = useCallback((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const currentCwd = cwdRef.current;
    const currentFs  = fsRef.current;

    setCmdHistory(prev => [trimmed, ...prev]);
    setHistIdx(-1);

    const newAllHistory = [trimmed, ...allHistRef.current];
    setAllHistory(newAllHistory);

    const promptLine = { type: 'prompt', path: cwdDisplay(currentCwd), cmd: trimmed };
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd   = parts[0];
    const rawArgs = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

    // separate flags from paths
    const flags = rawArgs.filter(a => a.startsWith('-'));
    const args  = rawArgs.filter(a => !a.startsWith('-'));

    let responseLines = [];
    let newFs = null; // if set, will update FS state

    switch (cmd) {

      /* ── Navigation ── */
      case 'pwd': {
        responseLines = [{ type: 'text', color: 'cyan', text: currentCwd }];
        break;
      }
      case 'whoami': {
        responseLines = [{ type: 'text', color: 'white', text: 'user' }];
        break;
      }
      case 'cd': {
        const target = rawArgs[0];
        if (target === '-') {
          const prev = prevCwd;
          setPrevCwd(currentCwd);
          setCwd(prev);
          cwdRef.current = prev;
          responseLines = [{ type: 'text', color: 'cyan', text: prev }];
          break;
        }
        const resolved = resolvePath(target, currentCwd);
        const node = getNode(currentFs, resolved);
        if (node === null) {
          responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: No such file or directory` }];
        } else if (typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: Not a directory` }];
        } else {
          setPrevCwd(currentCwd);
          setCwd(resolved);
          cwdRef.current = resolved;
          responseLines = [];
        }
        break;
      }
      case 'ls': {
        const showHidden = flags.some(f => f.includes('a'));
        const longFmt    = flags.some(f => f.includes('l'));
        const targetArg  = args[0];
        const targetPath = targetArg ? resolvePath(targetArg, currentCwd) : currentCwd;
        const node = getNode(currentFs, targetPath);
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
              return { type: 'ls-long', perm: isDir ? 'drwxr-xr-x' : '-rw-r--r--', size: isDir ? '4096' : String((node[e] || '').length), date: `Apr 20 10:${min}`, name: e, isDir };
            }),
          ];
        } else {
          responseLines = [{ type: 'ls-grid', entries: entries.map(e => ({ name: e, isDir: typeof node[e] === 'object' })) }];
        }
        break;
      }
      case 'cat': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'cat: missing operand' }]; break; }
        const filePath = resolvePath(args[0], currentCwd);
        const node = getNode(currentFs, filePath);
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
        const targetArg  = args[0];
        const targetPath = targetArg ? resolvePath(targetArg, currentCwd) : currentCwd;
        const node = getNode(currentFs, targetPath);
        if (!node || typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `tree: ${targetArg || '.'}: No such file or directory` }];
          break;
        }
        responseLines = [{ type: 'tree', lines: buildTree(node) }];
        break;
      }

      /* ── File/Dir management ── */
      case 'mkdir': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'mkdir: missing operand' }]; break; }
        const recursive = flags.some(f => f.includes('p'));
        const target    = resolvePath(args[0], currentCwd);
        const { parentPath, key } = getParentAndKey(target);

        if (recursive) {
          // create all intermediate directories
          const pathParts = target.split('/').filter(Boolean);
          const cloned = deepClone(currentFs);
          let cursor = cloned;
          let ok = true;
          for (const part of pathParts) {
            if (!(part in cursor)) cursor[part] = {};
            else if (typeof cursor[part] === 'string') {
              responseLines = [{ type: 'text', color: 'red', text: `mkdir: cannot create directory '${args[0]}': File exists` }];
              ok = false; break;
            }
            cursor = cursor[part];
          }
          if (ok) { newFs = cloned; responseLines = []; }
        } else {
          const parentNode = getNode(currentFs, parentPath);
          if (!parentNode || typeof parentNode === 'string') {
            responseLines = [{ type: 'text', color: 'red', text: `mkdir: cannot create directory '${args[0]}': No such file or directory` }];
          } else if (key in parentNode) {
            responseLines = [{ type: 'text', color: 'red', text: `mkdir: cannot create directory '${args[0]}': File exists` }];
          } else {
            const cloned = deepClone(currentFs);
            getNode(cloned, parentPath)[key] = {};
            newFs = cloned;
            responseLines = [];
          }
        }
        break;
      }

      case 'touch': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'touch: missing file operand' }]; break; }
        const target = resolvePath(args[0], currentCwd);
        const { parentPath, key } = getParentAndKey(target);
        const parentNode = getNode(currentFs, parentPath);
        if (!parentNode || typeof parentNode === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `touch: cannot touch '${args[0]}': No such file or directory` }];
        } else {
          const cloned = deepClone(currentFs);
          const p = getNode(cloned, parentPath);
          if (typeof p[key] !== 'string') p[key] = '';
          // if file exists, just update (no output)
          newFs = cloned;
          responseLines = [];
        }
        break;
      }

      case 'cp': {
        if (args.length < 2) { responseLines = [{ type: 'text', color: 'red', text: 'cp: missing destination file operand' }]; break; }
        const recursive = flags.some(f => f.includes('r') || f.includes('R'));
        const srcPath   = resolvePath(args[0], currentCwd);
        let   dstPath   = resolvePath(args[1], currentCwd);
        const srcNode   = getNode(currentFs, srcPath);

        if (srcNode === null) {
          responseLines = [{ type: 'text', color: 'red', text: `cp: '${args[0]}': No such file or directory` }];
          break;
        }
        if (typeof srcNode === 'object' && !recursive) {
          responseLines = [{ type: 'text', color: 'red', text: `cp: -r not specified; omitting directory '${args[0]}'` }];
          break;
        }

        // if dst is an existing directory, copy into it
        const dstNode = getNode(currentFs, dstPath);
        if (typeof dstNode === 'object') {
          const srcName = srcPath.split('/').pop();
          dstPath = dstPath + '/' + srcName;
        }

        const { parentPath: dstParent, key: dstKey } = getParentAndKey(dstPath);
        const dstParentNode = getNode(currentFs, dstParent);
        if (!dstParentNode || typeof dstParentNode === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `cp: '${args[1]}': No such file or directory` }];
          break;
        }

        const cloned = deepClone(currentFs);
        getNode(cloned, dstParent)[dstKey] = deepClone(srcNode);
        newFs = cloned;
        responseLines = [];
        break;
      }

      case 'mv': {
        if (args.length < 2) { responseLines = [{ type: 'text', color: 'red', text: 'mv: missing destination file operand' }]; break; }
        const srcPath = resolvePath(args[0], currentCwd);
        let   dstPath = resolvePath(args[1], currentCwd);
        const srcNode = getNode(currentFs, srcPath);

        if (srcNode === null) {
          responseLines = [{ type: 'text', color: 'red', text: `mv: '${args[0]}': No such file or directory` }];
          break;
        }

        const dstNode = getNode(currentFs, dstPath);
        if (typeof dstNode === 'object') {
          dstPath = dstPath + '/' + srcPath.split('/').pop();
        }

        const { parentPath: srcParent, key: srcKey } = getParentAndKey(srcPath);
        const { parentPath: dstParent, key: dstKey } = getParentAndKey(dstPath);
        const dstParentNode = getNode(currentFs, dstParent);
        if (!dstParentNode || typeof dstParentNode === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `mv: '${args[1]}': No such file or directory` }];
          break;
        }

        const cloned = deepClone(currentFs);
        getNode(cloned, dstParent)[dstKey] = deepClone(srcNode);
        delete getNode(cloned, srcParent)[srcKey];
        newFs = cloned;
        responseLines = [];
        break;
      }

      case 'rm': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'rm: missing operand' }]; break; }
        const recursive  = flags.some(f => f.includes('r') || f.includes('R'));
        const interactive = flags.some(f => f.includes('i'));
        const target     = resolvePath(args[0], currentCwd);
        const node       = getNode(currentFs, target);

        if (node === null) {
          responseLines = [{ type: 'text', color: 'red', text: `rm: cannot remove '${args[0]}': No such file or directory` }];
          break;
        }
        if (typeof node === 'object' && !recursive) {
          responseLines = [{ type: 'text', color: 'red', text: `rm: cannot remove '${args[0]}': Is a directory (use -r)` }];
          break;
        }

        // guard: prevent removing critical paths
        if (target === '/' || target === '/home' || target === '/home/user') {
          responseLines = [{ type: 'text', color: 'red', text: `rm: refusing to remove '${args[0]}': protected path` }];
          break;
        }

        const { parentPath, key } = getParentAndKey(target);
        const cloned = deepClone(currentFs);
        delete getNode(cloned, parentPath)[key];
        newFs = cloned;

        if (interactive) {
          responseLines = [{ type: 'text', color: 'yellow', text: `removed '${args[0]}'` }];
        } else {
          responseLines = [];
        }
        break;
      }

      case 'rmdir': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'rmdir: missing operand' }]; break; }
        const target = resolvePath(args[0], currentCwd);
        const node   = getNode(currentFs, target);
        if (node === null) {
          responseLines = [{ type: 'text', color: 'red', text: `rmdir: failed to remove '${args[0]}': No such file or directory` }];
        } else if (typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `rmdir: failed to remove '${args[0]}': Not a directory` }];
        } else if (Object.keys(node).length > 0) {
          responseLines = [{ type: 'text', color: 'red', text: `rmdir: failed to remove '${args[0]}': Directory not empty` }];
        } else {
          const { parentPath, key } = getParentAndKey(target);
          const cloned = deepClone(currentFs);
          delete getNode(cloned, parentPath)[key];
          newFs = cloned;
          responseLines = [];
        }
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
          { type: 'text', color: 'cyan',  text: '  — File & Directory Management —' },
          { type: 'text', color: 'white', text: '  mkdir <dir>       create directory' },
          { type: 'text', color: 'white', text: '  mkdir -p <path>   create nested directories' },
          { type: 'text', color: 'white', text: '  touch <file>      create empty file' },
          { type: 'text', color: 'white', text: '  cp <src> <dst>    copy file' },
          { type: 'text', color: 'white', text: '  cp -r <src> <dst> copy directory' },
          { type: 'text', color: 'white', text: '  mv <src> <dst>    move / rename' },
          { type: 'text', color: 'white', text: '  rm <file>         delete file' },
          { type: 'text', color: 'white', text: '  rm -r <dir>       delete directory' },
          { type: 'text', color: 'white', text: '  rmdir <dir>       remove empty directory' },
          { type: 'text', color: 'dim',   text: '' },
          { type: 'text', color: 'cyan',  text: '  — Navigation —' },
          { type: 'text', color: 'white', text: '  cd / ls / pwd / tree / cat / echo / clear' },
        ];
        break;
      }

      default: {
        responseLines = [{ type: 'text', color: 'red', text: `bash: ${cmd}: command not found` }];
      }
    }

    // apply filesystem mutation
    let updatedFs = currentFs;
    if (newFs) {
      updatedFs = newFs;
      setFs(newFs);
      fsRef.current = newFs;
    }

    addLines([promptLine, ...responseLines, { type: 'text', color: 'dim', text: '' }]);

    /* check current objective */
    setObjIdx(prevIdx => {
      if (levelDone) return prevIdx;
      const obj = OBJECTIVES[prevIdx];
      if (!obj) return prevIdx;
      if (obj.validate(updatedFs, cwdRef.current, newAllHistory)) {
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
              addLines([{ type: 'text', color: 'green', text: '✓ All objectives complete! Level 03 passed.' }]);
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
            <a key={l.level} href={l.href} title={`Level ${l.level}: ${l.title}`}
              className={`w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
                l.status === 'done'   ? 'bg-[#3ddc84] border-[#3ddc84]' :
                l.status === 'active' ? 'bg-[#f59e0b] border-[#f59e0b] shadow-[0_0_6px_#f59e0b88]' :
                'bg-[#1a2e1a] border-[#2a4a2a]'
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
          <div className="bg-[#0a1a0a] border-b border-[#1a2e1a] px-5 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#3ddc84] font-bold tracking-[0.15em] uppercase">Level {LESSON.level}</span>
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

            {/* Objectives */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">
                Objectives
                <span className="ml-2 text-[#444] normal-case tracking-normal">{completed.length}/{OBJECTIVES.length}</span>
              </div>
              <div className="space-y-1.5">
                {OBJECTIVES.map((obj, i) => {
                  const done   = completed.includes(obj.id);
                  const active = i === objIdx && !levelDone;
                  return (
                    <div key={obj.id} className={`flex items-start gap-2.5 px-2.5 py-2 rounded text-[11px] transition-colors ${
                      done   ? 'bg-[#0a1a0a] border border-[#1a3a1a]' :
                      active ? 'bg-[#3ddc84]/5 border border-[#3ddc84]/20' :
                               'border border-transparent'
                    }`}>
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
                        {active && <div className="text-[#555] mt-0.5 leading-relaxed">{obj.desc}</div>}
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
                    <code className="text-[11px] text-[#3ddc84] font-bold min-w-[80px] flex-shrink-0">{c.name}</code>
                    <span className="text-[11px] text-[#444]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* rm warning */}
            <div className="bg-[#1a0e00] border border-[#f59e0b]/20 rounded p-3">
              <div className="text-[10px] text-[#f59e0b] font-bold tracking-[0.12em] uppercase mb-1.5">⚠ Warning</div>
              <p className="text-[11px] text-[#664400] leading-[1.7]">
                <code className="text-[#f59e0b]">rm</code> is permanent. There is no trash or undo. Always double-check your path before running it. Use <code className="text-[#f59e0b]">rm -i</code> to confirm each deletion.
              </p>
            </div>

            {/* Level nav */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">Module</div>
              <div className="space-y-0.5">
                {LESSONS_NAV.map((l) => (
                  <a key={l.level} href={l.status === 'locked' ? undefined : l.href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-[11px] transition-colors duration-150 ${
                      l.status === 'active' ? 'bg-[#3ddc84]/8 text-white' :
                      l.status === 'done'   ? 'text-[#555] hover:text-[#888]' :
                      'text-[#333] cursor-default'
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
          <div className="h-[34px] bg-[#0d0d0d] border-b border-[#1a1a1a] flex-shrink-0 flex items-center justify-between px-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[11px] text-[#333] tracking-[0.05em]">bash — user@linux</span>
            <div>
              {levelDone ? (
                <span className="text-[10px] text-[#3ddc84] border border-[#3ddc84]/30 px-2 py-0.5 rounded-full">✓ complete</span>
              ) : (
                <span className="text-[10px] text-[#444] font-mono">{completed.length}/{OBJECTIVES.length} done</span>
              )}
            </div>
          </div>

          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-[2px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a #000' }}
          >
            {output.map((line) => <OutputLine key={line.id} line={line} />)}
          </div>

          {/* Success toast */}
          {showToast && (
            <div className="absolute bottom-[72px] right-5 bg-[#0a1a0a] border border-[#3ddc84] rounded-lg px-5 py-4 w-72 shadow-[0_0_24px_#3ddc8418] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#3ddc84] font-bold mb-1.5">✓ Level 03 complete!</div>
              <div className="text-[11px] text-[#666] leading-relaxed mb-1">
                You can now create, copy, move, rename, and delete files and directories.
                These five commands handle 90% of filesystem work.
              </div>
              <div className="text-[11px] text-[#3ddc84]/60 mb-3">+{LESSON.xp} XP earned</div>
              <div className="flex gap-2">
                <a
                  href={LESSON.nextLevel}
                  className="flex-1 bg-[#3ddc84] text-black text-[12px] font-bold py-1.5 rounded text-center hover:bg-[#3ddc84]/90 transition-opacity"
                >
                  Next Level →
                </a>
                <button onClick={() => setShowToast(false)} className="text-[11px] text-[#444] hover:text-[#666] px-2">✕</button>
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
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #1a2e1a; border-radius: 2px; }
      `}</style>
    </div>
  );
}