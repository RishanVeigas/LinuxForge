'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Virtual Process Table ── */
const INITIAL_PROCESSES = [
  { pid: 1,    ppid: 0,    user: 'root',  stat: 'Ss', cpu: 0.0,  mem: 0.1, vsz: 168936,  rss: 11296,  start: '09:00', time: '0:01', cmd: '/sbin/init' },
  { pid: 312,  ppid: 1,    user: 'root',  stat: 'Ss', cpu: 0.0,  mem: 0.3, vsz: 30144,   rss: 9872,   start: '09:00', time: '0:00', cmd: '/lib/systemd/systemd-journald' },
  { pid: 488,  ppid: 1,    user: 'root',  stat: 'Ss', cpu: 0.1,  mem: 0.2, vsz: 28992,   rss: 7040,   start: '09:00', time: '0:00', cmd: '/usr/sbin/sshd -D' },
  { pid: 712,  ppid: 1,    user: 'root',  stat: 'Ss', cpu: 0.0,  mem: 0.1, vsz: 14256,   rss: 3552,   start: '09:01', time: '0:00', cmd: '/usr/sbin/cron -f' },
  { pid: 891,  ppid: 1,    user: 'root',  stat: 'Ss', cpu: 0.0,  mem: 0.2, vsz: 223296,  rss: 6144,   start: '09:01', time: '0:00', cmd: '/usr/bin/python3 /usr/bin/networkd-dispatcher' },
  { pid: 1001, ppid: 488,  user: 'user',  stat: 'Ss', cpu: 0.0,  mem: 0.1, vsz: 15248,   rss: 4192,   start: '09:05', time: '0:00', cmd: 'sshd: user@pts/0' },
  { pid: 1002, ppid: 1001, user: 'user',  stat: 'Ss', cpu: 0.1,  mem: 0.2, vsz: 9744,    rss: 5568,   start: '09:05', time: '0:00', cmd: '-bash' },
  { pid: 1100, ppid: 1,    user: 'www-data', stat: 'Sl', cpu: 0.8, mem: 1.4, vsz: 891204, rss: 46080, start: '09:02', time: '0:12', cmd: 'node /var/www/app/server.js' },
  { pid: 1101, ppid: 1100, user: 'www-data', stat: 'Sl', cpu: 0.4, mem: 0.9, vsz: 712480, rss: 29696, start: '09:02', time: '0:06', cmd: 'node /var/www/app/worker.js' },
  { pid: 1200, ppid: 1,    user: 'mysql', stat: 'Sl', cpu: 1.2,  mem: 3.2, vsz: 1805424, rss: 104960, start: '09:02', time: '0:21', cmd: '/usr/sbin/mysqld' },
  { pid: 1301, ppid: 1,    user: 'redis', stat: 'Ssl',cpu: 0.2,  mem: 0.8, vsz: 60932,   rss: 26368,  start: '09:02', time: '0:03', cmd: '/usr/bin/redis-server 127.0.0.1:6379' },
  { pid: 1450, ppid: 1,    user: 'user',  stat: 'S',  cpu: 0.0,  mem: 0.1, vsz: 8192,    rss: 1024,   start: '09:10', time: '0:00', cmd: 'python3 monitor.py' },
  { pid: 1500, ppid: 1002, user: 'user',  stat: 'R+', cpu: 0.3,  mem: 0.1, vsz: 8856,    rss: 3840,   start: '09:15', time: '0:00', cmd: 'ps aux' },
];

/* ── Jobs table ── */
const INITIAL_JOBS = [];

/* ── Objectives ── */
const OBJECTIVES = [
  {
    id: 'ps_aux',
    label: 'List all running processes with ps aux',
    desc: 'Use ps aux to display every process on the system with user, PID, CPU%, MEM% and command.',
    hint: 'ps aux',
    validate: (_cwd, hist) => hist.some(h => /^ps\s+aux/.test(h.trim())),
    successMsg: 'ps aux is the go-to snapshot of every running process. BSD-style flags (no dash) show user, PID, CPU, MEM and full command.',
  },
  {
    id: 'ps_grep',
    label: 'Find a specific process with ps aux | grep',
    desc: 'Combine ps with grep to filter processes. Try finding "node" or "mysql".',
    hint: 'ps aux | grep node',
    validate: (_cwd, hist) => hist.some(h => /^ps\s+aux\s*\|\s*grep\s+\S+/.test(h.trim())),
    successMsg: 'ps aux | grep <name> is how you locate a specific process and grab its PID for further action.',
  },
  {
    id: 'uptime_cmd',
    label: 'Check system uptime and load average with uptime',
    desc: 'Use uptime to see how long the system has been running and its 1/5/15 minute load averages.',
    hint: 'uptime',
    validate: (_cwd, hist) => hist.some(h => /^uptime$/.test(h.trim())),
    successMsg: 'uptime shows load averages over 1, 5, and 15 minutes. A load average equal to your CPU count means full utilisation.',
  },
  {
    id: 'sleep_bg',
    label: 'Run a background job with sleep 60 &',
    desc: 'Append & to a command to run it in the background. Try: sleep 60 &',
    hint: 'sleep 60 &',
    validate: (_cwd, hist) => hist.some(h => /^sleep\s+\d+\s*&$/.test(h.trim())),
    successMsg: '& detaches the process to the background and prints its job number and PID. The shell stays free for more commands.',
  },
  {
    id: 'jobs_cmd',
    label: 'List background jobs with jobs',
    desc: 'Use jobs to view all background and stopped jobs in the current shell session.',
    hint: 'jobs',
    validate: (_cwd, hist) => hist.some(h => /^jobs$/.test(h.trim())),
    successMsg: 'jobs lists [job_number] status and command. + marks the current job, - the previous one.',
  },
  {
    id: 'kill_cmd',
    label: 'Terminate a process with kill',
    desc: 'Use kill <PID> to send SIGTERM (15) to a process. Try killing PID 1450 (python3 monitor.py).',
    hint: 'kill 1450',
    validate: (_cwd, hist) => hist.some(h => /^kill\s+(-\d+\s+)?\d+/.test(h.trim())),
    successMsg: 'kill sends SIGTERM by default — a polite request to terminate. Use kill -9 <PID> for SIGKILL when a process ignores SIGTERM.',
  },
  {
    id: 'fg_cmd',
    label: 'Bring a background job to the foreground with fg',
    desc: 'Use fg or fg %1 to bring the most recent background job to the foreground.',
    hint: 'fg %1',
    validate: (_cwd, hist) => hist.some(h => /^fg(\s+%?\d+)?$/.test(h.trim())),
    successMsg: 'fg %N brings job N to the foreground. Without an argument it resumes the current job (marked +).',
  },
  {
    id: 'watch_cmd',
    label: 'Repeatedly run a command with watch',
    desc: 'Use watch to execute a command every 2 seconds. Try: watch uptime',
    hint: 'watch uptime',
    validate: (_cwd, hist) => hist.some(h => /^watch(\s+-n\s*\d+)?\s+\S+/.test(h.trim())),
    successMsg: 'watch -n N runs a command every N seconds (default 2). Perfect for monitoring logs, load, or process lists in real time.',
  },
];

const LESSONS_NAV = [
  { level: '05', title: 'System Info & Find',      status: 'done',   href: '/learn/intermediate/level-5' },
  { level: '06', title: 'Pipes & Redirection',     status: 'done',   href: '/learn/intermediate/level-6' },
  { level: '07', title: 'Process Management',      status: 'active', href: '/learn/intermediate/level-7' },
  { level: '08', title: 'Permissions & Users',     status: 'locked', href: '#' },
  { level: '09', title: 'Networking Basics',       status: 'locked', href: '#' },
  { level: '10', title: 'Shell Scripting I',       status: 'locked', href: '#' },
];

const LESSON = {
  level:   '07',
  track:   'intermediate',
  title:   'Process Management',
  module:  'module_03 — intermediate',
  description: [
    { text: 'Every running program is a process. Knowing how to inspect, control, and signal processes is essential for any sysadmin or developer. ' },
    { text: 'ps', code: true }, { text: ' snapshots the process table, ' },
    { text: 'top', code: true }, { text: ' watches it live. ' },
    { text: 'kill', code: true }, { text: ' sends signals, while ' },
    { text: 'jobs', code: true }, { text: ', ' },
    { text: 'fg', code: true }, { text: ', and ' },
    { text: 'bg', code: true }, { text: ' manage your shell\'s own job list. ' },
    { text: 'watch', code: true }, { text: ' turns any command into a live monitor.' },
  ],
  commands: [
    { name: 'ps aux',            desc: 'snapshot all processes' },
    { name: 'ps -ef',            desc: 'full-format process list' },
    { name: 'ps aux | grep X',   desc: 'filter processes by name' },
    { name: 'top',               desc: 'live process monitor (q to quit)' },
    { name: 'uptime',            desc: 'uptime + load averages' },
    { name: 'sleep N &',         desc: 'run command in background' },
    { name: 'jobs',              desc: 'list background/stopped jobs' },
    { name: 'fg [%N]',           desc: 'bring job to foreground' },
    { name: 'bg [%N]',           desc: 'resume stopped job in background' },
    { name: 'kill <PID>',        desc: 'send SIGTERM to process' },
    { name: 'kill -9 <PID>',     desc: 'send SIGKILL (force)' },
    { name: 'kill -l',           desc: 'list all signal names' },
    { name: 'nohup cmd &',       desc: 'run immune to hangup' },
    { name: 'watch [-n N] cmd',  desc: 'repeat cmd every N seconds' },
  ],
  xp: 200,
  nextLevel: '/intermediate/level-8',
};

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
        <span className="text-[#60a5fa]">~</span>
        <span className="text-[#444]">$</span>
        <span className="text-[#d4d4d4] ml-1">{line.cmd}</span>
      </div>
    );
  }

  if (line.type === 'ps-header') {
    return (
      <div className="font-mono text-[12px] leading-[1.6] flex gap-2">
        <span className="text-[#fbbf24] min-w-[56px]">USER</span>
        <span className="text-[#fbbf24] min-w-[36px] text-right">PID</span>
        <span className="text-[#fbbf24] min-w-[36px] text-right">%CPU</span>
        <span className="text-[#fbbf24] min-w-[36px] text-right">%MEM</span>
        <span className="text-[#fbbf24] min-w-[44px] text-right">STAT</span>
        <span className="text-[#fbbf24] min-w-[40px] text-right">START</span>
        <span className="text-[#fbbf24] ml-2">COMMAND</span>
      </div>
    );
  }

  if (line.type === 'ps-row') {
    const p = line.proc;
    const userColor = p.user === 'root' ? '#f87171' : p.user === 'user' ? '#4ade80' : '#60a5fa';
    const cpuColor  = p.cpu > 1 ? '#fbbf24' : '#666';
    const memColor  = p.mem > 2 ? '#fb923c' : '#666';
    return (
      <div className="font-mono text-[12px] leading-[1.6] flex gap-2">
        <span className="min-w-[56px] truncate" style={{ color: userColor }}>{p.user}</span>
        <span className="min-w-[36px] text-right text-[#a78bfa]">{p.pid}</span>
        <span className="min-w-[36px] text-right" style={{ color: cpuColor }}>{p.cpu.toFixed(1)}</span>
        <span className="min-w-[36px] text-right" style={{ color: memColor }}>{p.mem.toFixed(1)}</span>
        <span className="min-w-[44px] text-right text-[#22d3ee]">{p.stat}</span>
        <span className="min-w-[40px] text-right text-[#444]">{p.start}</span>
        <span className="text-[#888] ml-2 truncate">{p.cmd}</span>
      </div>
    );
  }

  if (line.type === 'top-display') {
    return (
      <div className="font-mono text-[12px] border border-[#1c1c1c] rounded bg-[#050505] p-2 my-1">
        <div className="text-[#4ade80] mb-1 text-[11px]">top — {line.time}  up {line.uptime},  1 user,  load average: {line.load}</div>
        <div className="text-[#555] text-[11px] mb-1">Tasks: {line.total} total, {line.running} running, {line.sleeping} sleeping, 0 stopped</div>
        <div className="text-[#555] text-[11px] mb-2">%Cpu(s):  {line.cpuUser} us,  {line.cpuSys} sy,  0.0 ni, {line.cpuIdle} id</div>
        <div className="flex gap-2 text-[11px] text-[#fbbf24] mb-1">
          <span className="min-w-[36px] text-right">PID</span>
          <span className="min-w-[56px]">USER</span>
          <span className="min-w-[36px] text-right">%CPU</span>
          <span className="min-w-[36px] text-right">%MEM</span>
          <span>COMMAND</span>
        </div>
        {line.procs.map((p, i) => (
          <div key={i} className="flex gap-2 text-[11px] leading-[1.5]">
            <span className="min-w-[36px] text-right text-[#a78bfa]">{p.pid}</span>
            <span className="min-w-[56px] text-[#4ade80] truncate">{p.user}</span>
            <span className={`min-w-[36px] text-right ${p.cpu > 1 ? 'text-[#fbbf24]' : 'text-[#555]'}`}>{p.cpu.toFixed(1)}</span>
            <span className={`min-w-[36px] text-right ${p.mem > 2 ? 'text-[#fb923c]' : 'text-[#555]'}`}>{p.mem.toFixed(1)}</span>
            <span className="text-[#666] truncate">{p.cmd.split('/').pop().slice(0, 28)}</span>
          </div>
        ))}
        <div className="text-[#2a2a2a] text-[10px] mt-1">(press q to quit in a real terminal)</div>
      </div>
    );
  }

  if (line.type === 'uptime-line') {
    return (
      <div className="font-mono text-[13px] leading-relaxed">
        <span className="text-[#555]"> {line.time}  up </span>
        <span className="text-[#22d3ee]">{line.uptime}</span>
        <span className="text-[#555]">,  1 user,  load average: </span>
        <span className="text-[#4ade80]">{line.load1}</span>
        <span className="text-[#555]">, </span>
        <span className="text-[#fbbf24]">{line.load5}</span>
        <span className="text-[#555]">, </span>
        <span className="text-[#f87171]">{line.load15}</span>
      </div>
    );
  }

  if (line.type === 'job-line') {
    return (
      <div className="font-mono text-[13px] leading-relaxed flex gap-2">
        <span className="text-[#fbbf24]">[{line.num}]{line.current ? '+' : '-'}</span>
        <span className={line.status === 'Running' ? 'text-[#4ade80]' : line.status === 'Stopped' ? 'text-[#f87171]' : 'text-[#aaa]'}>{line.status}</span>
        <span className="text-[#666]">{line.cmd}</span>
      </div>
    );
  }

  if (line.type === 'kill-signal') {
    return (
      <div className="font-mono text-[12px] leading-[1.7]">
        {line.signals.map((s, i) => (
          <span key={i} className="mr-4">
            <span className="text-[#555]">{String(i + 1).padStart(2)}) </span>
            <span className="text-[#22d3ee]">{s}</span>
          </span>
        ))}
      </div>
    );
  }

  if (line.type === 'nohup-out') {
    return (
      <div className="font-mono text-[13px] leading-relaxed">
        <span className="text-[#fbbf24]">nohup: </span>
        <span className="text-[#555]">ignoring input and appending output to </span>
        <span className="text-[#4ade80]">'nohup.out'</span>
      </div>
    );
  }

  if (line.type === 'watch-display') {
    return (
      <div className="font-mono text-[12px] border border-[#1c1c1c] rounded bg-[#050505] p-2 my-1">
        <div className="text-[#555] text-[11px] mb-2">Every 2.0s: {line.watchCmd}    linux: {line.time}</div>
        {line.output.map((l, i) => (
          <div key={i} className={`text-[12px] leading-[1.6] ${l.color ? `text-[${l.color}]` : 'text-[#666]'}`}>{l.text}</div>
        ))}
        <div className="text-[#2a2a2a] text-[10px] mt-1">(press Ctrl+C to stop in a real terminal)</div>
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
export default function Level7Page() {
  const [output, setOutput]           = useState([]);
  const [inputVal, setInputVal]       = useState('');
  const [cmdHistory, setCmdHistory]   = useState([]);
  const [histIdx, setHistIdx]         = useState(-1);
  const [hintOpen, setHintOpen]       = useState(false);
  const [objIdx, setObjIdx]           = useState(0);
  const [completed, setCompleted]     = useState([]);
  const [levelDone, setLevelDone]     = useState(false);
  const [showToast, setShowToast]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allHistory, setAllHistory]   = useState([]);
  const [processes, setProcesses]     = useState(INITIAL_PROCESSES);
  const [jobs, setJobs]               = useState(INITIAL_JOBS);
  const [nextPid, setNextPid]         = useState(1600);
  const [nextJob, setNextJob]         = useState(1);

  const inputRef   = useRef(null);
  const outputRef  = useRef(null);
  const allHistRef = useRef(allHistory);
  const procsRef   = useRef(processes);
  const jobsRef    = useRef(jobs);
  const nextPidRef = useRef(nextPid);
  const nextJobRef = useRef(nextJob);

  allHistRef.current  = allHistory;
  procsRef.current    = processes;
  jobsRef.current     = jobs;
  nextPidRef.current  = nextPid;
  nextJobRef.current  = nextJob;

  const progress   = levelDone ? 100 : Math.round((completed.length / OBJECTIVES.length) * 90);
  const currentObj = OBJECTIVES[objIdx];

  useEffect(() => {
    setOutput([
      { id: 0, type: 'text', color: 'dim',    text: 'Linux Learning Platform  —  bash 5.2.21' },
      { id: 1, type: 'text', color: 'dim',    text: "Type 'help' to see commands." },
      { id: 2, type: 'text', color: 'dim',    text: '' },
      { id: 3, type: 'text', color: 'green',  text: 'Welcome to Level 07 — Process Management' },
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
      if (obj.validate(null, newAllHistory)) {
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
              addLines([{ type: 'text', color: 'green', text: '✓ All objectives complete! Level 07 passed.' }]);
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

  /* ── fake time ── */
  const fakeTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  };

  const runCommand = useCallback((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setCmdHistory(prev => [trimmed, ...prev]);
    setHistIdx(-1);
    const newAllHistory = [trimmed, ...allHistRef.current];
    setAllHistory(newAllHistory);
    allHistRef.current = newAllHistory;

    const promptLine = { type: 'prompt', cmd: trimmed };

    /* ── parse ── */
    /* handle pipe: ps aux | grep X */
    const pipeMatch = trimmed.match(/^(ps\s+aux)\s*\|\s*grep\s+(.+)$/);

    const parts   = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd     = parts[0];
    const rawArgs = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ''));
    const flags   = rawArgs.filter(a => a.startsWith('-'));
    const args    = rawArgs.filter(a => !a.startsWith('-'));
    const isBg    = trimmed.endsWith('&');

    let responseLines = [];
    const procs = procsRef.current;
    const jbs   = jobsRef.current;

    switch (cmd) {

      /* ─── ps ─── */
      case 'ps': {
        if (pipeMatch) {
          /* handled below in the pipe block */
          break;
        }
        const isAux = rawArgs.includes('aux') || rawArgs.includes('aux');
        const isEf  = flags.some(f => f.includes('e') || f.includes('f'));
        const showAll = isAux || isEf || !rawArgs.length;
        const filtered = showAll ? procs : procs.filter(p => p.user === 'user');
        responseLines = [
          { type: 'ps-header' },
          ...filtered.map(p => ({ type: 'ps-row', proc: p })),
        ];
        break;
      }

      /* ─── top ─── */
      case 'top': {
        const sorted = [...procs].sort((a, b) => b.cpu - a.cpu).slice(0, 10);
        const totalCpu = procs.reduce((s, p) => s + p.cpu, 0);
        responseLines = [{
          type: 'top-display',
          time: fakeTime(),
          uptime: '3:14',
          load: '0.42, 0.38, 0.29',
          total: procs.length,
          running: 2,
          sleeping: procs.length - 2,
          cpuUser: totalCpu.toFixed(1),
          cpuSys: '1.2',
          cpuIdle: (100 - totalCpu - 1.2).toFixed(1),
          procs: sorted,
        }];
        break;
      }

      /* ─── uptime ─── */
      case 'uptime': {
        responseLines = [{
          type: 'uptime-line',
          time: fakeTime(),
          uptime: '3 hours, 14 min',
          load1: '0.42',
          load5: '0.38',
          load15: '0.29',
        }];
        break;
      }

      /* ─── sleep ─── */
      case 'sleep': {
        const secs = args[0] ? parseInt(args[0], 10) : 1;
        if (isBg) {
          const pid = nextPidRef.current;
          const jn  = nextJobRef.current;
          setNextPid(p => p + 1);
          setNextJob(j => j + 1);
          const newJob = { num: jn, pid, cmd: `sleep ${secs}`, status: 'Running', current: true };
          setJobs(prev => prev.map(j => ({ ...j, current: false })).concat(newJob));
          setProcesses(prev => [...prev, {
            pid, ppid: 1002, user: 'user', stat: 'S', cpu: 0.0, mem: 0.0,
            vsz: 7168, rss: 784, start: fakeTime().slice(0,5), time: '0:00', cmd: `sleep ${secs}`,
          }]);
          responseLines = [
            { type: 'text', color: 'dim', text: `[${jn}] ${pid}` },
          ];
        } else {
          responseLines = [{ type: 'text', color: 'dim', text: `(sleeping ${secs}s — in a real terminal this would block)` }];
        }
        break;
      }

      /* ─── jobs ─── */
      case 'jobs': {
        const currentJobs = jobsRef.current;
        if (!currentJobs.length) {
          responseLines = [{ type: 'text', color: 'dim', text: '(no background jobs)' }];
        } else {
          responseLines = currentJobs.map(j => ({ type: 'job-line', ...j }));
        }
        break;
      }

      /* ─── fg ─── */
      case 'fg': {
        const currentJobs = jobsRef.current;
        if (!currentJobs.length) {
          responseLines = [{ type: 'text', color: 'red', text: 'bash: fg: current: no such job' }];
          break;
        }
        const jNum = args[0] ? parseInt(args[0].replace('%', ''), 10) : null;
        const job = jNum
          ? currentJobs.find(j => j.num === jNum)
          : currentJobs.find(j => j.current) || currentJobs[currentJobs.length - 1];
        if (!job) {
          responseLines = [{ type: 'text', color: 'red', text: `bash: fg: %${jNum}: no such job` }];
          break;
        }
        setJobs(prev => prev.filter(j => j.num !== job.num));
        setProcesses(prev => prev.filter(p => p.pid !== job.pid));
        responseLines = [
          { type: 'text', color: 'cyan', text: job.cmd },
          { type: 'text', color: 'dim',  text: `(job [${job.num}] brought to foreground, finished)` },
        ];
        break;
      }

      /* ─── bg ─── */
      case 'bg': {
        const currentJobs = jobsRef.current;
        const stopped = currentJobs.find(j => j.status === 'Stopped');
        if (!stopped) {
          responseLines = [{ type: 'text', color: 'red', text: 'bash: bg: no stopped jobs' }];
          break;
        }
        setJobs(prev => prev.map(j => j.num === stopped.num ? { ...j, status: 'Running' } : j));
        responseLines = [
          { type: 'text', color: 'dim', text: `[${stopped.num}]+ ${stopped.cmd} &` },
        ];
        break;
      }

      /* ─── kill ─── */
      case 'kill': {
        if (flags.includes('-l') || flags.includes('-L')) {
          const sigs = ['SIGHUP','SIGINT','SIGQUIT','SIGILL','SIGTRAP','SIGABRT','SIGBUS','SIGFPE',
                        'SIGKILL','SIGUSR1','SIGSEGV','SIGUSR2','SIGPIPE','SIGALRM','SIGTERM',
                        'SIGSTKFLT','SIGCHLD','SIGCONT','SIGSTOP','SIGTSTP'];
          responseLines = [{ type: 'kill-signal', signals: sigs }];
          break;
        }
        const pidArg = args[0] ? parseInt(args[0], 10) : null;
        if (!pidArg) {
          responseLines = [{ type: 'text', color: 'red', text: 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...' }];
          break;
        }
        const sigNum = flags[0] ? parseInt(flags[0].replace('-', ''), 10) : 15;
        const target = procs.find(p => p.pid === pidArg);
        if (!target) {
          responseLines = [{ type: 'text', color: 'red', text: `bash: kill: (${pidArg}) - No such process` }];
          break;
        }
        if (pidArg === 1 || target.user === 'root') {
          responseLines = [{ type: 'text', color: 'red', text: `bash: kill: (${pidArg}) - Operation not permitted` }];
          break;
        }
        setProcesses(prev => prev.filter(p => p.pid !== pidArg));
        setJobs(prev => prev.filter(j => j.pid !== pidArg));
        const sigName = sigNum === 9 ? 'SIGKILL' : 'SIGTERM';
        responseLines = [
          { type: 'text', color: 'yellow', text: `Sent ${sigName} to PID ${pidArg} (${target.cmd.split(' ')[0].split('/').pop()})` },
        ];
        break;
      }

      /* ─── nohup ─── */
      case 'nohup': {
        if (!args[0]) {
          responseLines = [{ type: 'text', color: 'red', text: 'nohup: missing operand' }]; break;
        }
        const bgCmd = rawArgs.filter(a => a !== '&').join(' ');
        const pid   = nextPidRef.current;
        const jn    = nextJobRef.current;
        setNextPid(p => p + 1);
        setNextJob(j => j + 1);
        setProcesses(prev => [...prev, {
          pid, ppid: 1002, user: 'user', stat: 'S', cpu: 0.0, mem: 0.0,
          vsz: 8192, rss: 1024, start: fakeTime().slice(0,5), time: '0:00', cmd: bgCmd,
        }]);
        setJobs(prev => prev.map(j => ({ ...j, current: false })).concat({
          num: jn, pid, cmd: `nohup ${bgCmd}`, status: 'Running', current: true,
        }));
        responseLines = [
          { type: 'nohup-out' },
          { type: 'text', color: 'dim', text: `[${jn}] ${pid}` },
        ];
        break;
      }

      /* ─── watch ─── */
      case 'watch': {
        const nIdx = rawArgs.findIndex(a => a === '-n');
        const interval = nIdx !== -1 ? rawArgs[nIdx + 1] : '2';
        const watchTarget = rawArgs.filter((a, i) => a !== '-n' && i !== nIdx + 1).join(' ');
        let watchOutput = [];
        if (!watchTarget) {
          responseLines = [{ type: 'text', color: 'red', text: 'watch: no command specified' }]; break;
        }
        if (watchTarget.includes('uptime')) {
          watchOutput = [
            { text: ` ${fakeTime()}  up 3 hours, 14 min,  1 user,  load average: 0.42, 0.38, 0.29`, color: '#22d3ee' },
          ];
        } else if (watchTarget.includes('ps')) {
          watchOutput = [
            { text: 'USER        PID %CPU %MEM COMMAND', color: '#fbbf24' },
            ...procsRef.current.slice(0, 6).map(p => ({
              text: `${p.user.padEnd(8)} ${String(p.pid).padStart(5)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${p.cmd.slice(0,30)}`,
            })),
          ];
        } else {
          watchOutput = [{ text: `(output of: ${watchTarget})`, color: '#555' }];
        }
        responseLines = [{
          type: 'watch-display',
          watchCmd: watchTarget,
          time: fakeTime(),
          output: watchOutput,
        }];
        break;
      }

      /* ─── clear ─── */
      case 'clear': { setOutput([]); return; }

      /* ─── help ─── */
      case 'help': {
        responseLines = [
          { type: 'text', color: 'green',  text: 'Level 07 commands:' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Snapshots —' },
          { type: 'text', color: 'white',  text: '  ps aux              all processes (snapshot)' },
          { type: 'text', color: 'white',  text: '  ps aux | grep X     filter by name' },
          { type: 'text', color: 'white',  text: '  top                 live process monitor' },
          { type: 'text', color: 'white',  text: '  uptime              uptime + load averages' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Job Control —' },
          { type: 'text', color: 'white',  text: '  sleep N &           run in background' },
          { type: 'text', color: 'white',  text: '  jobs                list background jobs' },
          { type: 'text', color: 'white',  text: '  fg [%N]             bring job to foreground' },
          { type: 'text', color: 'white',  text: '  bg [%N]             resume stopped job in bg' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Signals —' },
          { type: 'text', color: 'white',  text: '  kill <PID>          send SIGTERM' },
          { type: 'text', color: 'white',  text: '  kill -9 <PID>       send SIGKILL (force)' },
          { type: 'text', color: 'white',  text: '  kill -l             list signals' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Persistence & Monitoring —' },
          { type: 'text', color: 'white',  text: '  nohup cmd &         run immune to hangup' },
          { type: 'text', color: 'white',  text: '  watch [cmd]         repeat cmd every 2s' },
        ];
        break;
      }

      default: {
        /* ─── pipe: ps aux | grep ─── */
        if (pipeMatch) {
          const pattern = pipeMatch[2].trim();
          const matched = procs.filter(p =>
            p.cmd.toLowerCase().includes(pattern.toLowerCase()) ||
            p.user.toLowerCase().includes(pattern.toLowerCase())
          );
          if (!matched.length) {
            responseLines = [{ type: 'text', color: 'dim', text: '(no matching processes)' }];
          } else {
            responseLines = [
              { type: 'ps-header' },
              ...matched.map(p => ({ type: 'ps-row', proc: p })),
            ];
          }
        } else {
          responseLines = [{ type: 'text', color: 'red', text: `bash: ${cmd}: command not found` }];
        }
      }
    }

    addLines([promptLine, ...responseLines, { type: 'text', color: 'dim', text: '' }]);
    checkObjective(newAllHistory);
  }, [levelDone, addLines, checkObjective]);

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

            {/* Signals quick reference */}
            <div className="bg-[#0a0f0a] border border-[#1c1c1c] rounded p-3">
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Common Signals</div>
              <div className="space-y-1">
                {[
                  ['SIGTERM (15)', 'polite termination (default)'],
                  ['SIGKILL (9)',  'force kill, cannot be caught'],
                  ['SIGHUP (1)',   'hangup / reload config'],
                  ['SIGINT (2)',   'interrupt (Ctrl+C)'],
                  ['SIGSTOP (19)', 'pause process (Ctrl+Z)'],
                  ['SIGCONT (18)', 'resume stopped process'],
                ].map(([sig, desc]) => (
                  <div key={sig} className="flex gap-3">
                    <code className="text-[11px] text-[#60a5fa] min-w-[92px]">{sig}</code>
                    <span className="text-[11px] text-[#333]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Process table hint */}
            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Processes to explore</div>
              <div className="space-y-1">
                {[
                  ['PID 1200', 'mysqld (high mem)'],
                  ['PID 1100', 'node server.js'],
                  ['PID 1450', 'python3 monitor.py'],
                  ['PID 1301', 'redis-server'],
                  ['PID 488',  'sshd (root — protected)'],
                ].map(([pid, desc]) => (
                  <div key={pid} className="flex gap-2 items-baseline">
                    <code className="text-[11px] text-[#444]">{pid}</code>
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
              <div className="text-[13px] text-[#4ade80] font-bold mb-1.5">✓ Level 07 complete!</div>
              <div className="text-[11px] text-[#444] leading-relaxed mb-1">
                You can now inspect processes with <code className="text-[#4ade80]">ps</code> & <code className="text-[#4ade80]">top</code>, control jobs with <code className="text-[#4ade80]">fg</code>/<code className="text-[#4ade80]">bg</code>, signal them with <code className="text-[#4ade80]">kill</code>, and monitor live with <code className="text-[#4ade80]">watch</code>.
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
              <span className="text-[#60a5fa]">~</span>
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