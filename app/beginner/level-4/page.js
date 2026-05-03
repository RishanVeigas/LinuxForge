'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Virtual Filesystem ── */
const FS = {
  home: {
    user: {
      documents: {
        'report.txt': [
          'Q3 Financial Report',
          '====================',
          'Company: Acme Corp',
          'Period: July - September 2024',
          '',
          'REVENUE SUMMARY',
          '---------------',
          'Product Sales:    $842,000',
          'Service Revenue:  $358,000',
          'Total Revenue:    $1,200,000',
          '',
          'EXPENSE SUMMARY',
          '---------------',
          'Payroll:          $480,000',
          'Infrastructure:   $120,000',
          'Marketing:        $110,000',
          'Misc:             $90,000',
          'Total Expenses:   $800,000',
          '',
          'NET PROFIT:       $400,000',
          '',
          'NOTES',
          '-----',
          'Strong performance in Q3.',
          'Product line exceeded targets by 12%.',
          'Infrastructure costs rising — review in Q4.',
          'Team headcount stable at 24.',
        ].join('\n'),

        'notes.md': [
          '# Meeting Notes — Sprint Review',
          '',
          'Date: 2024-09-15',
          'Attendees: Alice, Bob, Carol, Dave',
          '',
          '## Agenda',
          '',
          '1. Review completed tickets',
          '2. Demo new dashboard feature',
          '3. Retrospective',
          '4. Planning next sprint',
          '',
          '## Action Items',
          '',
          '- [ ] Alice: Follow up with design team',
          '- [ ] Bob: Fix login redirect bug (#342)',
          '- [ ] Carol: Review Q3 numbers',
          '- [x] Dave: Deploy hotfix to staging',
          '',
          '## Notes',
          '',
          'Dashboard demo went well. Stakeholders approved.',
          'Login bug is critical — prioritise for next sprint.',
          'Retrospective: communication needs improvement.',
          'Velocity was 34 points, target was 30. Good sprint.',
        ].join('\n'),

        'todo.txt': [
          'PERSONAL TODO LIST',
          '==================',
          '',
          '[x] Set up dev environment',
          '[x] Learn basic navigation',
          '[x] Understand file management',
          '[ ] Master file viewing commands',
          '[ ] Learn text editing with vim/nano',
          '[ ] Understand file permissions',
          '[ ] Write first shell script',
          '',
          'WORK TODO',
          '---------',
          '[ ] Code review for PR #88',
          '[ ] Update API docs',
          '[ ] Schedule 1:1 with manager',
          '[ ] Finish onboarding guide',
        ].join('\n'),
      },

      logs: {
        'server.log': Array.from({ length: 40 }, (_, i) => {
          const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'INFO', 'DEBUG'];
          const lvl = levels[i % levels.length];
          const msgs = [
            'Server started on port 3000',
            'GET /api/users 200 14ms',
            'GET /api/posts 200 22ms',
            'POST /api/login 200 88ms',
            'Database connection pool: 8/20',
            'Cache hit ratio: 94%',
            'GET /api/unknown 404 3ms',
            'Slow query detected: 1240ms',
            'Memory usage: 412MB / 2048MB',
            'Worker thread recycled',
          ];
          const h = String(9 + Math.floor(i / 4)).padStart(2, '0');
          const m = String((i * 7) % 60).padStart(2, '0');
          return `2024-09-15 ${h}:${m}:00 [${lvl}]  ${msgs[i % msgs.length]}`;
        }).join('\n'),

        'access.log': Array.from({ length: 20 }, (_, i) => {
          const methods = ['GET', 'POST', 'GET', 'GET', 'PUT'];
          const paths   = ['/api/users', '/api/login', '/api/posts', '/static/app.js', '/api/config'];
          const codes   = [200, 200, 200, 404, 201, 500];
          const ips     = ['192.168.1.10', '10.0.0.5', '172.16.0.3'];
          const h = String(9 + Math.floor(i / 3)).padStart(2, '0');
          const m = String((i * 13) % 60).padStart(2, '0');
          return `${ips[i % ips.length]} - - [15/Sep/2024:${h}:${m}:00] "${methods[i % methods.length]} ${paths[i % paths.length]} HTTP/1.1" ${codes[i % codes.length]} ${1000 + i * 37}`;
        }).join('\n'),
      },

      '.bashrc': [
        '# ~/.bashrc — executed for interactive non-login shells',
        '',
        'export PATH=$PATH:/usr/local/bin',
        'export EDITOR=nano',
        'export PAGER=less',
        '',
        '# Aliases',
        'alias ll="ls -la"',
        'alias la="ls -A"',
        'alias l="ls -CF"',
        'alias grep="grep --color=auto"',
        '',
        '# Custom prompt',
        'PS1="\\u@\\h:\\w\\$ "',
      ].join('\n'),

      'poem.txt': [
        'The Terminal',
        '============',
        '',
        'A cursor blinks in the dark,',
        'patient as the tide.',
        'No icons, no windows —',
        'just the text, and you.',
        '',
        'Every command a small act',
        'of knowing exactly what you want.',
        'The shell does not guess.',
        'It does not apologise.',
        '',
        'Learn its language',
        'and the machine opens like a book.',
        '',
        '— anon',
      ].join('\n'),
    },
  },
  etc: {
    hosts: '127.0.0.1   localhost\n::1         localhost\n10.0.0.1    gateway',
    passwd: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000::/home/user:/bin/bash\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin',
  },
  tmp: {},
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

/* ── Pager state (for `less`) ── */
// We implement a simple inline pager overlay

/* ── Objectives ── */
const OBJECTIVES = [
  {
    id:    'cat_todo',
    label: 'Read todo.txt with cat',
    desc:  'Use cat to print the full contents of documents/todo.txt.',
    hint:  'cat documents/todo.txt',
    validate: (_cwd, hist) =>
      hist.some(h => /^cat\s+(~\/documents\/todo\.txt|documents\/todo\.txt|\/home\/user\/documents\/todo\.txt)$/.test(h.trim())),
    successMsg: 'cat prints the whole file at once. Great for short files.',
  },
  {
    id:    'cat_n_report',
    label: 'View report.txt with line numbers',
    desc:  'Use cat -n to display a file with numbered lines.',
    hint:  'cat -n documents/report.txt',
    validate: (_cwd, hist) =>
      hist.some(h => /^cat\s+-n\s+.+report\.txt/.test(h.trim()) || /^cat\s+.+report\.txt\s+-n/.test(h.trim())),
    successMsg: 'cat -n adds line numbers — handy for referencing specific lines in a file.',
  },
  {
    id:    'head_log',
    label: 'Preview the first 5 lines of logs/server.log',
    desc:  'Use head -n 5 to see only the first 5 lines of a file.',
    hint:  'head -n 5 logs/server.log',
    validate: (_cwd, hist) =>
      hist.some(h => /^head\s+-n\s+5\s+.+server\.log/.test(h.trim())),
    successMsg: 'head shows the top of a file — perfect for checking log headers or file format.',
  },
  {
    id:    'tail_log',
    label: 'See the last 10 lines of logs/server.log',
    desc:  'Use tail to view the end of a file — where the newest log entries live.',
    hint:  'tail logs/server.log  (default is 10 lines)',
    validate: (_cwd, hist) =>
      hist.some(h => /^tail(\s+-n\s+\d+)?\s+.+server\.log/.test(h.trim())),
    successMsg: 'tail is essential for live debugging. tail -f follows a file as it grows.',
  },
  {
    id:    'less_notes',
    label: 'Open notes.md in the less pager',
    desc:  'Use less to scroll through a long file interactively. Press q to quit.',
    hint:  'less documents/notes.md — then press q to exit the pager.',
    validate: (_cwd, hist) =>
      hist.some(h => /^less\s+.+notes\.md/.test(h.trim())),
    successMsg: 'less is the standard pager. It lets you scroll up/down without flooding the terminal.',
  },
  {
    id:    'grep_error',
    label: 'Search for "ERROR" in logs/server.log using grep',
    desc:  'Use grep to filter lines matching a pattern.',
    hint:  'grep ERROR logs/server.log',
    validate: (_cwd, hist) =>
      hist.some(h => /^grep\s+(-i\s+)?["']?ERROR["']?\s+.+server\.log/.test(h.trim()) ||
                     /^grep\s+.+server\.log\s+["']?ERROR["']?/.test(h.trim())),
    successMsg: 'grep filters lines by pattern. Combine with tail: tail -f log | grep ERROR for live monitoring.',
  },
  {
    id:    'wc_report',
    label: 'Count lines in documents/report.txt with wc -l',
    desc:  'Use wc -l to count how many lines are in a file.',
    hint:  'wc -l documents/report.txt',
    validate: (_cwd, hist) =>
      hist.some(h => /^wc\s+-l\s+.+report\.txt/.test(h.trim())),
    successMsg: 'wc counts words, lines, and bytes. wc -l is the quick way to know how big a file is.',
  },
];

const LESSONS_NAV = [
  { level: '01', title: 'Where Am I?',            status: 'done',   href: '/learn/beginner/level-1' },
  { level: '02', title: 'Moving Around',           status: 'done',   href: '/learn/beginner/level-2' },
  { level: '03', title: 'File & Dir Management',  status: 'done',   href: '/learn/beginner/level-3' },
  { level: '04', title: 'Viewing File Contents',  status: 'active', href: '/learn/beginner/level-4' },
  { level: '05', title: 'Permissions',            status: 'locked', href: '#' },
];

const LESSON = {
  level:   '04',
  track:   'beginner',
  title:   'Viewing File Contents',
  module:  'module_01 — foundations',
  description: [
    { text: 'Reading files is one of the most frequent things you\'ll do on Linux. ' },
    { text: 'cat', code: true },
    { text: ' dumps whole files, ' },
    { text: 'head', code: true },
    { text: ' and ' },
    { text: 'tail', code: true },
    { text: ' show the edges, ' },
    { text: 'less', code: true },
    { text: ' lets you scroll interactively, ' },
    { text: 'grep', code: true },
    { text: ' filters by pattern, and ' },
    { text: 'wc', code: true },
    { text: ' counts. Together they cover everything.' },
  ],
  commands: [
    { name: 'cat <file>',         desc: 'print entire file' },
    { name: 'cat -n <file>',      desc: 'print with line numbers' },
    { name: 'cat -A <file>',      desc: 'show special chars (tabs, EOL)' },
    { name: 'head <file>',        desc: 'first 10 lines' },
    { name: 'head -n N <file>',   desc: 'first N lines' },
    { name: 'tail <file>',        desc: 'last 10 lines' },
    { name: 'tail -n N <file>',   desc: 'last N lines' },
    { name: 'tail -f <file>',     desc: 'follow live updates' },
    { name: 'less <file>',        desc: 'scrollable pager (q to quit)' },
    { name: 'grep PAT <file>',    desc: 'filter lines matching pattern' },
    { name: 'grep -i PAT <file>', desc: 'case-insensitive search' },
    { name: 'grep -n PAT <file>', desc: 'show line numbers in results' },
    { name: 'wc <file>',          desc: 'count lines, words, bytes' },
    { name: 'wc -l <file>',       desc: 'count lines only' },
  ],
  xp: 125,
  nextLevel: '/beginner/level-5',
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

/* ── grep highlighter ── */
function GrepLine({ text, pattern, showLineNum, lineNum }) {
  if (!pattern) return <div className="font-mono text-[13px] text-[#ccc] leading-relaxed whitespace-pre-wrap">{text}</div>;
  try {
    const re    = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(re);
    return (
      <div className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
        {showLineNum && <span className="text-[#555] mr-3 select-none">{String(lineNum).padStart(3)}</span>}
        {parts.map((part, i) =>
          re.test(part)
            ? <span key={i} className="bg-[#f59e0b]/30 text-[#f59e0b] font-bold">{part}</span>
            : <span key={i} className="text-[#ccc]">{part}</span>
        )}
      </div>
    );
  } catch {
    return <div className="font-mono text-[13px] text-[#ccc]">{text}</div>;
  }
}

/* ── Less pager overlay ── */
function LessPager({ filename, content, onClose }) {
  const lines    = content.split('\n');
  const total    = lines.length;
  const pageSize = 18;
  const [offset, setOffset] = useState(0);
  const ref = useRef(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const handleKey = (e) => {
    if (e.key === 'q' || e.key === 'Q')                               { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown' || e.key === 'j' || e.key === ' ') { e.preventDefault(); setOffset(o => Math.min(o + 1, Math.max(0, total - pageSize))); }
    else if (e.key === 'ArrowUp'   || e.key === 'k')                  { e.preventDefault(); setOffset(o => Math.max(o - 1, 0)); }
    else if (e.key === 'f' || e.key === 'PageDown')                   { e.preventDefault(); setOffset(o => Math.min(o + pageSize, Math.max(0, total - pageSize))); }
    else if (e.key === 'b' || e.key === 'PageUp')                     { e.preventDefault(); setOffset(o => Math.max(o - pageSize, 0)); }
    else if (e.key === 'g' || e.key === 'Home')                       { e.preventDefault(); setOffset(0); }
    else if (e.key === 'G' || e.key === 'End')                        { e.preventDefault(); setOffset(Math.max(0, total - pageSize)); }
  };

  const visible    = lines.slice(offset, offset + pageSize);
  const pct        = total <= pageSize ? 100 : Math.round(((offset + pageSize) / total) * 100);
  const atEnd      = offset + pageSize >= total;

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKey}
      className="absolute inset-0 bg-[#000] z-20 flex flex-col outline-none"
      style={{ fontFamily: 'monospace' }}
    >
      {/* pager title bar */}
      <div className="h-[34px] bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center justify-between px-4 flex-shrink-0">
        <span className="text-[11px] text-[#3ddc84]">less</span>
        <span className="text-[11px] text-[#555]">{filename}</span>
        <span className="text-[11px] text-[#444]">line {offset + 1}–{Math.min(offset + pageSize, total)} / {total}</span>
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden px-5 pt-3 pb-0">
        {visible.map((line, i) => (
          <div key={i} className="font-mono text-[13px] text-[#ccc] leading-[1.55] whitespace-pre-wrap">
            <span className="text-[#333] mr-3 select-none text-[11px]">{String(offset + i + 1).padStart(3)}</span>
            {line || ' '}
          </div>
        ))}
      </div>

      {/* status bar */}
      <div className="h-[28px] bg-[#0d0d0d] border-t border-[#1a1a1a] flex items-center justify-between px-4 flex-shrink-0">
        <span className="text-[11px] text-[#333]">
          ↑↓ / j k — scroll  ·  space / b — page  ·  g G — start/end
        </span>
        <span className={`text-[11px] font-bold ${atEnd ? 'text-[#3ddc84]' : 'text-[#555]'}`}>
          {atEnd ? '(END)' : `${pct}%`}
        </span>
        <span className="text-[11px] text-[#f59e0b]">q — quit</span>
      </div>
    </div>
  );
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
    blue:   'text-[#64b5f6]',
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
  if (line.type === 'numbered') {
    return (
      <div className="font-mono text-[13px] leading-[1.55] flex">
        <span className="text-[#444] mr-3 select-none min-w-[32px] text-right">{line.num}</span>
        <span className="text-[#ccc] whitespace-pre-wrap">{line.text}</span>
      </div>
    );
  }
  if (line.type === 'grep-line') {
    return <GrepLine text={line.text} pattern={line.pattern} showLineNum={line.showLineNum} lineNum={line.lineNum} />;
  }
  if (line.type === 'wc-result') {
    return (
      <div className="font-mono text-[13px] flex gap-4">
        <span className="text-[#22d3ee]">{String(line.lines).padStart(6)}</span>
        <span className="text-[#3ddc84]">{String(line.words).padStart(6)}</span>
        <span className="text-[#64b5f6]">{String(line.bytes).padStart(6)}</span>
        <span className="text-[#888]">{line.filename}</span>
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
  return (
    <div className={`font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all ${cls}`}>
      {line.text}
    </div>
  );
}

/* ── Main component ── */
export default function Level4Page() {
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
  const [pager, setPager]         = useState(null); // { filename, content }

  const inputRef   = useRef(null);
  const outputRef  = useRef(null);
  const cwdRef     = useRef(cwd);
  cwdRef.current   = cwd;
  const allHistRef = useRef(allHistory);
  allHistRef.current = allHistory;

  const progress    = levelDone ? 100 : Math.round((completed.length / OBJECTIVES.length) * 90);
  const currentObj  = OBJECTIVES[objIdx];

  useEffect(() => {
    setOutput([
      { id: 0, type: 'text', color: 'dim',    text: 'Linux Learning Platform  —  bash 5.2.21' },
      { id: 1, type: 'text', color: 'dim',    text: "Type 'help' to see commands. Files are in ~/documents and ~/logs." },
      { id: 2, type: 'text', color: 'dim',    text: '' },
      { id: 3, type: 'text', color: 'green',  text: 'Welcome to Level 04 — Viewing File Contents' },
      { id: 4, type: 'text', color: 'yellow', text: `Objective 1/${OBJECTIVES.length}: ${OBJECTIVES[0].label}` },
      { id: 5, type: 'text', color: 'dim',    text: OBJECTIVES[0].desc },
      { id: 6, type: 'text', color: 'dim',    text: '' },
    ]);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outputRef.current && !pager) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output, pager]);

  // refocus input when pager closes
  useEffect(() => {
    if (!pager) setTimeout(() => inputRef.current?.focus(), 50);
  }, [pager]);

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
              addLines([{ type: 'text', color: 'green', text: '✓ All objectives complete! Level 04 passed.' }]);
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
    setCmdHistory(prev => [trimmed, ...prev]);
    setHistIdx(-1);

    const newAllHistory = [trimmed, ...allHistRef.current];
    setAllHistory(newAllHistory);

    const promptLine = { type: 'prompt', path: cwdDisplay(currentCwd), cmd: trimmed };
    const parts  = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd    = parts[0];
    const rawArgs = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ''));
    const flags  = rawArgs.filter(a => a.startsWith('-'));
    const args   = rawArgs.filter(a => !a.startsWith('-'));

    let responseLines = [];

    const resolveFile = (argPath) => {
      const resolved = resolvePath(argPath, currentCwd);
      const node = getNode(resolved);
      if (node === null)            return { err: `${argPath}: No such file or directory` };
      if (typeof node === 'object') return { err: `${argPath}: Is a directory` };
      return { content: node, resolved };
    };

    switch (cmd) {

      /* ── navigation ── */
      case 'pwd': responseLines = [{ type: 'text', color: 'cyan', text: currentCwd }]; break;
      case 'whoami': responseLines = [{ type: 'text', color: 'white', text: 'user' }]; break;

      case 'cd': {
        const target = rawArgs[0];
        if (target === '-') {
          const prev = prevCwd; setPrevCwd(currentCwd); setCwd(prev); cwdRef.current = prev;
          responseLines = [{ type: 'text', color: 'cyan', text: prev }]; break;
        }
        const resolved = resolvePath(target, currentCwd);
        const node = getNode(resolved);
        if (!node)                  responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: No such file or directory` }];
        else if (typeof node === 'string') responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: Not a directory` }];
        else { setPrevCwd(currentCwd); setCwd(resolved); cwdRef.current = resolved; responseLines = []; }
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

      /* ── file viewing ── */
      case 'cat': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'cat: missing file operand' }]; break; }
        const showNums    = flags.some(f => f.includes('n'));
        const showSpecial = flags.some(f => f.includes('A'));
        const { err, content } = resolveFile(args[0]);
        if (err) { responseLines = [{ type: 'text', color: 'red', text: `cat: ${err}` }]; break; }

        const fileLines = content.split('\n');
        if (showNums) {
          responseLines = fileLines.map((t, i) => ({ type: 'numbered', num: String(i + 1).padStart(6), text: showSpecial ? t.replace(/\t/g, '^I') + '$' : t }));
        } else if (showSpecial) {
          responseLines = fileLines.map(t => ({ type: 'text', color: 'white', text: t.replace(/\t/g, '^I') + '$' }));
        } else {
          responseLines = fileLines.map(t => ({ type: 'text', color: 'white', text: t }));
        }
        break;
      }

      case 'head': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'head: missing file operand' }]; break; }
        const nFlag = flags.find(f => f.startsWith('-n'));
        let n = 10;
        if (nFlag) {
          const nVal = nFlag.slice(2);
          if (nVal) n = parseInt(nVal, 10);
          else {
            // next arg is the number
            const numArg = rawArgs[rawArgs.indexOf(nFlag) + 1];
            if (numArg && !isNaN(parseInt(numArg))) { n = parseInt(numArg, 10); }
          }
        }
        const { err, content } = resolveFile(args[0]);
        if (err) { responseLines = [{ type: 'text', color: 'red', text: `head: ${err}` }]; break; }
        responseLines = content.split('\n').slice(0, n).map(t => ({ type: 'text', color: 'white', text: t }));
        break;
      }

      case 'tail': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'tail: missing file operand' }]; break; }
        const followFlag = flags.some(f => f.includes('f'));
        const nFlag = flags.find(f => f.startsWith('-n'));
        let n = 10;
        if (nFlag) {
          const nVal = nFlag.slice(2);
          if (nVal) n = parseInt(nVal, 10);
          else {
            const numArg = rawArgs[rawArgs.indexOf(nFlag) + 1];
            if (numArg && !isNaN(parseInt(numArg))) n = parseInt(numArg, 10);
          }
        }
        const { err, content } = resolveFile(args[0]);
        if (err) { responseLines = [{ type: 'text', color: 'red', text: `tail: ${err}` }]; break; }
        const fileLines = content.split('\n');
        responseLines = fileLines.slice(-n).map(t => ({ type: 'text', color: 'white', text: t }));
        if (followFlag) responseLines.push({ type: 'text', color: 'yellow', text: '(simulated: tail -f would watch for new entries in a real system)' });
        break;
      }

      case 'less': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'less: missing file operand' }]; break; }
        const { err, content, resolved } = resolveFile(args[0]);
        if (err) { responseLines = [{ type: 'text', color: 'red', text: `less: ${err}` }]; break; }
        const filename = resolved.split('/').pop();
        addLines([promptLine, { type: 'text', color: 'dim', text: '' }]);
        setPager({ filename, content });
        checkObjective(newAllHistory);
        return;
      }

      case 'more': {
        // alias for less in this sim
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'more: missing file operand' }]; break; }
        const { err, content, resolved } = resolveFile(args[0]);
        if (err) { responseLines = [{ type: 'text', color: 'red', text: `more: ${err}` }]; break; }
        const filename = resolved.split('/').pop();
        addLines([promptLine, { type: 'text', color: 'dim', text: '' }]);
        setPager({ filename, content });
        checkObjective(newAllHistory);
        return;
      }

      case 'grep': {
        // grep [flags] PATTERN FILE
        if (args.length < 2) { responseLines = [{ type: 'text', color: 'red', text: 'grep: usage: grep [options] PATTERN FILE' }]; break; }
        const pattern   = args[0];
        const fileArg   = args[1];
        const caseFlag  = flags.some(f => f.includes('i'));
        const numFlag   = flags.some(f => f.includes('n'));
        const invertFlag = flags.some(f => f.includes('v'));
        const countFlag = flags.some(f => f.includes('c'));

        const { err, content } = resolveFile(fileArg);
        if (err) { responseLines = [{ type: 'text', color: 'red', text: `grep: ${err}` }]; break; }

        let matchLines = [];
        try {
          const re = new RegExp(pattern, caseFlag ? 'i' : '');
          content.split('\n').forEach((line, idx) => {
            const matches = re.test(line);
            if (invertFlag ? !matches : matches) matchLines.push({ line, lineNum: idx + 1 });
          });
        } catch {
          responseLines = [{ type: 'text', color: 'red', text: `grep: invalid regex: ${pattern}` }]; break;
        }

        if (countFlag) {
          responseLines = [{ type: 'text', color: 'cyan', text: String(matchLines.length) }];
        } else if (!matchLines.length) {
          responseLines = [{ type: 'text', color: 'dim', text: '(no matches)' }];
        } else {
          responseLines = matchLines.map(({ line, lineNum }) => ({
            type: 'grep-line', text: line, pattern, showLineNum: numFlag, lineNum,
          }));
        }
        break;
      }

      case 'wc': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'wc: missing file operand' }]; break; }
        const linesOnly = flags.some(f => f.includes('l'));
        const wordsOnly = flags.some(f => f.includes('w'));
        const bytesOnly = flags.some(f => f.includes('c'));
        const { err, content } = resolveFile(args[0]);
        if (err) { responseLines = [{ type: 'text', color: 'red', text: `wc: ${err}` }]; break; }

        const lineCount = content.split('\n').length;
        const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
        const byteCount = new TextEncoder().encode(content).length;

        if (linesOnly) {
          responseLines = [{ type: 'text', color: 'cyan', text: `${String(lineCount).padStart(7)} ${args[0]}` }];
        } else if (wordsOnly) {
          responseLines = [{ type: 'text', color: 'cyan', text: `${String(wordCount).padStart(7)} ${args[0]}` }];
        } else if (bytesOnly) {
          responseLines = [{ type: 'text', color: 'cyan', text: `${String(byteCount).padStart(7)} ${args[0]}` }];
        } else {
          responseLines = [{ type: 'wc-result', lines: lineCount, words: wordCount, bytes: byteCount, filename: args[0] }];
        }
        break;
      }

      case 'clear': { setOutput([]); return; }

      case 'help': {
        responseLines = [
          { type: 'text', color: 'green', text: 'Available commands:' },
          { type: 'text', color: 'dim',   text: '' },
          { type: 'text', color: 'cyan',  text: '  — Viewing —' },
          { type: 'text', color: 'white', text: '  cat [-n] [-A] <file>     print file (opt. line nums / special chars)' },
          { type: 'text', color: 'white', text: '  head [-n N] <file>       first N lines (default 10)' },
          { type: 'text', color: 'white', text: '  tail [-n N] [-f] <file>  last N lines (default 10)' },
          { type: 'text', color: 'white', text: '  less <file>              scrollable pager (q to quit)' },
          { type: 'text', color: 'white', text: '  grep [-i] [-n] [-v] [-c] PATTERN FILE' },
          { type: 'text', color: 'white', text: '  wc [-l] [-w] [-c] <file> count lines / words / bytes' },
          { type: 'text', color: 'dim',   text: '' },
          { type: 'text', color: 'cyan',  text: '  — Navigation —' },
          { type: 'text', color: 'white', text: '  cd / ls / pwd / tree / clear' },
        ];
        break;
      }

      default: responseLines = [{ type: 'text', color: 'red', text: `bash: ${cmd}: command not found` }];
    }

    addLines([promptLine, ...responseLines, { type: 'text', color: 'dim', text: '' }]);
    checkObjective(newAllHistory);
  }, [levelDone, addLines, checkObjective, prevCwd]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const val = inputVal; setInputVal(''); runCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistIdx(prev => { const n = Math.min(prev + 1, cmdHistory.length - 1); setInputVal(cmdHistory[n] || ''); return n; });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistIdx(prev => { const n = Math.max(prev - 1, -1); setInputVal(n === -1 ? '' : cmdHistory[n] || ''); return n; });
    }
  };

  return (
    <div
      className="h-screen flex flex-col bg-[#080c08] text-[#e0e0e0] overflow-hidden font-mono"
      onClick={() => !pager && inputRef.current?.focus()}
    >
      {/* ── TOP BAR ── */}
      <header className="h-11 flex-shrink-0 bg-[#0d120d] border-b border-[#1a2e1a] flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-[#444] hover:text-[#3ddc84] transition-colors mr-1"
            onClick={(e) => { e.stopPropagation(); setSidebarOpen(o => !o); }}>
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
        <aside className={`
          w-72 flex-shrink-0 bg-[#0d120d] border-r border-[#1a2e1a] flex flex-col overflow-hidden
          md:relative md:translate-x-0 absolute inset-y-0 left-0 z-30 transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `} onClick={e => e.stopPropagation()}>

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
                Objectives <span className="ml-2 text-[#444] normal-case tracking-normal">{completed.length}/{OBJECTIVES.length}</span>
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
                        <div className={done ? 'text-[#444] line-through' : active ? 'text-[#e0e0e0]' : 'text-[#333]'}>{obj.label}</div>
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
                    hintOpen ? 'border-[#3a2800] text-[#ffa000] bg-[#1a1200]' :
                    'border-[#2a2a2a] text-[#555] hover:border-[#ffa000] hover:text-[#ffa000]'
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
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">Commands</div>
              <div className="space-y-1.5">
                {LESSON.commands.map((c) => (
                  <div key={c.name} className="flex gap-3 items-baseline">
                    <code className="text-[11px] text-[#3ddc84] font-bold min-w-[88px] flex-shrink-0">{c.name}</code>
                    <span className="text-[11px] text-[#444]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* less pager keys */}
            <div className="bg-[#0a1a0a] border border-[#1a2e1a] rounded p-3">
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">less — Keys</div>
              <div className="space-y-1">
                {[
                  ['↑ / k',      'scroll up one line'],
                  ['↓ / j',      'scroll down one line'],
                  ['space / f',  'page forward'],
                  ['b',          'page backward'],
                  ['g / G',      'go to start / end'],
                  ['q',          'quit pager'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex gap-3">
                    <code className="text-[11px] text-[#64b5f6] min-w-[64px]">{key}</code>
                    <span className="text-[11px] text-[#444]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* File list */}
            <div>
              <div className="text-[10px] text-[#3ddc84] font-bold tracking-[0.12em] uppercase mb-2">Files to explore</div>
              <div className="space-y-1">
                {[
                  ['~/documents/todo.txt',     'task list'],
                  ['~/documents/report.txt',   'Q3 financial report'],
                  ['~/documents/notes.md',     'meeting notes'],
                  ['~/documents/poem.txt',     'a poem'],
                  ['~/logs/server.log',        '40-line server log'],
                  ['~/logs/access.log',        'HTTP access log'],
                  ['~/.bashrc',                'shell config'],
                ].map(([path, desc]) => (
                  <div key={path} className="flex gap-2 items-baseline">
                    <code className="text-[11px] text-[#555] truncate">{path}</code>
                    <span className="text-[10px] text-[#333] flex-shrink-0">{desc}</span>
                  </div>
                ))}
              </div>
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
                    }`}>
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
            <div className="h-full bg-[#3ddc84] transition-all duration-500"
              style={{ width: `${progress}%`, boxShadow: '0 0 8px #3ddc8460' }} />
          </div>
        </aside>

        {/* ── TERMINAL ── */}
        <div className="flex-1 bg-[#000] flex flex-col overflow-hidden relative">

          {/* Title bar */}
          <div className="h-[34px] bg-[#0d0d0d] border-b border-[#1a1a1a] flex-shrink-0 flex items-center justify-between px-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[11px] text-[#333] tracking-[0.05em]">
              {pager ? `less — ${pager.filename}` : 'bash — user@linux'}
            </span>
            <div>
              {levelDone
                ? <span className="text-[10px] text-[#3ddc84] border border-[#3ddc84]/30 px-2 py-0.5 rounded-full">✓ complete</span>
                : <span className="text-[10px] text-[#444] font-mono">{completed.length}/{OBJECTIVES.length} done</span>
              }
            </div>
          </div>

          {/* Output */}
          <div ref={outputRef}
            className="flex-1 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-[2px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a #000' }}>
            {output.map((line) => <OutputLine key={line.id} line={line} />)}
          </div>

          {/* Less pager overlay */}
          {pager && (
            <LessPager
              filename={pager.filename}
              content={pager.content}
              onClose={() => {
                setPager(null);
                addLines([
                  { type: 'text', color: 'dim', text: `(less: exited — ${pager.filename})` },
                  { type: 'text', color: 'dim', text: '' },
                ]);
              }}
            />
          )}

          {/* Success toast */}
          {showToast && (
            <div className="absolute bottom-[72px] right-5 bg-[#0a1a0a] border border-[#3ddc84] rounded-lg px-5 py-4 w-72 shadow-[0_0_24px_#3ddc8418] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#3ddc84] font-bold mb-1.5">✓ Level 04 complete!</div>
              <div className="text-[11px] text-[#666] leading-relaxed mb-1">
                You can now read any file on a Linux system — from quick <code className="text-[#3ddc84]">cat</code> dumps
                to scrolling through logs with <code className="text-[#3ddc84]">less</code> and filtering with <code className="text-[#3ddc84]">grep</code>.
              </div>
              <div className="text-[11px] text-[#3ddc84]/60 mb-3">+{LESSON.xp} XP earned</div>
              <div className="flex gap-2">
                <a href={LESSON.nextLevel}
                  className="flex-1 bg-[#3ddc84] text-black text-[12px] font-bold py-1.5 rounded text-center hover:bg-[#3ddc84]/90 transition-opacity">
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
              disabled={!!pager}
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#e0e0e0] caret-[#3ddc84] font-mono disabled:opacity-30"
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
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #1a2e1a; border-radius: 2px; }
      `}</style>
    </div>
  );
}