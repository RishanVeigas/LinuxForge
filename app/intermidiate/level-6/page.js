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
      projects: {
        webapp: {
          'index.html': '<!DOCTYPE html>\n<html>\n<head><title>App</title></head>\n<body><h1>Hello World</h1></body>\n</html>',
          'app.js': 'const express = require("express");\nconst app = express();\napp.listen(3000);',
          'package.json': '{\n  "name": "webapp",\n  "version": "1.0.0",\n  "dependencies": {\n    "express": "^4.18.0"\n  }\n}',
          src: {
            'main.js': 'import App from "./App.js";\nApp.init();',
            'utils.js': 'export const formatDate = (d) => d.toISOString().split("T")[0];',
            'config.js': 'export default { port: 3000, debug: false };',
          },
          tests: {
            'app.test.js': 'describe("App", () => { it("starts", () => expect(true).toBe(true)); });',
          },
        },
        scripts: {
          'backup.sh': '#!/bin/bash\ntar -czf backup_$(date +%Y%m%d).tar.gz ~/documents\necho "Backup complete"',
          'deploy.sh': '#!/bin/bash\necho "Deploying..."\ngit pull origin main\nnpm install',
          'cleanup.sh': '#!/bin/bash\nfind /tmp -name "*.tmp" -mtime +7 -delete\necho "Cleaned old temp files"',
        },
      },
      videos: {
        'demo.mp4': 'binary video data — 48230192 bytes',
        'tutorial.mp4': 'binary video data — 102400512 bytes',
      },
      images: {
        'avatar.png': 'binary PNG image data — 84320 bytes',
        'banner.jpg': 'binary JPEG image data — 204800 bytes',
        'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle r="12"/></svg>',
      },
      '.bashrc': '# ~/.bashrc\nexport PATH=$PATH:/usr/local/bin\nexport EDITOR=nano\nalias ll="ls -la"',
    },
  },
  etc: {
    hosts: '127.0.0.1   localhost\n::1         localhost\n10.0.0.1    gateway',
    'os-release': 'NAME="Ubuntu"\nVERSION="22.04.3 LTS"\nID=ubuntu',
    passwd: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000::/home/user:/bin/bash',
    fstab: '/dev/sda1  /          ext4  defaults        0 1\n/dev/sda2  /home      ext4  defaults        0 2\n/dev/sdb1  /mnt/data  ext4  defaults        0 2\ntmpfs      /tmp       tmpfs nodev,nosuid    0 0',
  },
  tmp: {
    'session.tmp': 'SESSION_TOKEN=abc123\nEXPIRES=2024-09-16',
    'cache.tmp': 'cached data...',
    old_backup: { 'data.bak': 'old backup data from 2024-08-01' },
  },
  mnt: {
    data: {
      archives: {
        'q1_2024.tar.gz': 'binary archive — 10485760 bytes',
        'q2_2024.tar.gz': 'binary archive — 12582912 bytes',
      },
      'README.txt': 'External data drive — mounted at /mnt/data\nDo not remove while in use.',
    },
    usb: {},
  },
  var: {
    log: {
      syslog: 'Sep 15 09:00:01 linux systemd[1]: Started Daily apt upgrade.\nSep 15 09:01:33 linux kernel: eth0: renamed from veth1a2b3c',
      'auth.log': 'Sep 15 10:22:31 linux sshd[1234]: Accepted publickey for user\nSep 15 10:45:00 linux sudo[5678]: user : COMMAND=/usr/bin/apt',
    },
  },
};

/* ── Simulated disk/mount metadata ── */
const DISK_META = {
  '/': {
    device: '/dev/sda1', fstype: 'ext4',
    size: 50 * 1024 * 1024, used: 18 * 1024 * 1024, avail: 32 * 1024 * 1024,
    mountOpts: 'rw,relatime,errors=remount-ro',
  },
  '/home': {
    device: '/dev/sda2', fstype: 'ext4',
    size: 100 * 1024 * 1024, used: 14 * 1024 * 1024, avail: 86 * 1024 * 1024,
    mountOpts: 'rw,relatime',
  },
  '/mnt/data': {
    device: '/dev/sdb1', fstype: 'ext4',
    size: 500 * 1024 * 1024, used: 23 * 1024 * 1024, avail: 477 * 1024 * 1024,
    mountOpts: 'rw,relatime',
  },
  '/tmp': {
    device: 'tmpfs', fstype: 'tmpfs',
    size: 4 * 1024 * 1024, used: 1 * 1024 * 1024, avail: 3 * 1024 * 1024,
    mountOpts: 'rw,nosuid,nodev',
  },
};

/* ── File type detection ── */
function detectFileType(name, content) {
  const ext = name.split('.').pop().toLowerCase();
  if (['sh', 'bash'].includes(ext)) return { mime: 'application/x-shellscript', desc: 'Bourne-Again shell script, ASCII text executable' };
  if (['js', 'mjs'].includes(ext))  return { mime: 'application/javascript',    desc: 'JavaScript source, ASCII text' };
  if (ext === 'json')               return { mime: 'application/json',           desc: 'JSON data, ASCII text' };
  if (ext === 'html')               return { mime: 'text/html',                  desc: 'HTML document, ASCII text' };
  if (ext === 'md')                 return { mime: 'text/markdown',              desc: 'Markdown document, UTF-8 Unicode text' };
  if (['txt', 'log', 'bak'].includes(ext)) return { mime: 'text/plain',          desc: 'ASCII text' };
  if (ext === 'png')                return { mime: 'image/png',                  desc: 'PNG image data, 512 x 512, 8-bit/color RGBA' };
  if (ext === 'jpg' || ext === 'jpeg') return { mime: 'image/jpeg',             desc: 'JPEG image data, JFIF standard 1.01' };
  if (ext === 'svg')                return { mime: 'image/svg+xml',             desc: 'SVG Scalable Vector Graphics image, ASCII text' };
  if (ext === 'mp4')                return { mime: 'video/mp4',                 desc: 'ISO Media, MPEG v4 system, version 2' };
  if (['tar', 'gz', 'tgz'].includes(ext) || name.endsWith('.tar.gz'))
                                    return { mime: 'application/gzip',           desc: 'gzip compressed data' };
  if (content && content.startsWith('#!/')) return { mime: 'text/x-shellscript', desc: 'POSIX shell script, ASCII text executable' };
  return { mime: 'application/octet-stream', desc: 'data' };
}

/* ── Simulated file sizes (KB) ── */
function estimateSize(name, content) {
  if (!content) return 0;
  if (content.includes('binary video data')) {
    const m = content.match(/(\d+) bytes/);
    return m ? parseInt(m[1]) : 4096;
  }
  if (content.includes('binary')) {
    const m = content.match(/(\d+) bytes/);
    return m ? parseInt(m[1]) : 1024;
  }
  if (content.includes('binary archive')) {
    const m = content.match(/(\d+) bytes/);
    return m ? parseInt(m[1]) : 10240;
  }
  return new TextEncoder().encode(content).length;
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
function formatBytes(b, human = false) {
  if (!human) return String(Math.ceil(b / 1024)); // KB blocks
  if (b >= 1024 * 1024 * 1024) return (b / (1024 * 1024 * 1024)).toFixed(1) + 'G';
  if (b >= 1024 * 1024)        return (b / (1024 * 1024)).toFixed(1) + 'M';
  if (b >= 1024)               return (b / 1024).toFixed(1) + 'K';
  return b + 'B';
}

/* ── Recursive du helper ── */
function duCalc(node, path) {
  if (typeof node === 'string') return estimateSize(path.split('/').pop(), node);
  let total = 4096; // dir overhead
  for (const [k, v] of Object.entries(node)) {
    total += duCalc(v, path + '/' + k);
  }
  return total;
}

/* ── walkFS ── */
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

/* ── Pipe executor ── */
// Executes a simple 2-stage pipe: cmd1 | cmd2
// Returns { lines } where lines is the final output lines array
function executePipe(left, right, cwd) {
  // left produces text output, right filters/transforms it
  const leftOutput = runSingleCommand(left.trim(), cwd);
  const textLines  = leftOutput.map(l => {
    if (l.type === 'text' || l.type === 'white') return l.text || '';
    if (l.type === 'history-line') return l.cmd || '';
    if (l.type === 'find-result')  return (l.dir || '') + (l.base || '');
    if (l.type === 'du-line')      return `${l.size}\t${l.path}`;
    if (l.type === 'stat-line')    return l.text || '';
    return '';
  }).filter(l => l !== undefined);

  const rParts = right.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const rCmd   = rParts[0];
  const rRawArgs = rParts.slice(1).map(a => a.replace(/^["']|["']$/g, ''));
  const rFlags   = rRawArgs.filter(a => a.startsWith('-'));
  const rArgs    = rRawArgs.filter(a => !a.startsWith('-'));

  switch (rCmd) {
    case 'grep': {
      if (!rArgs[0]) return [{ type: 'text', color: 'red', text: 'grep: missing pattern' }];
      const pattern = rArgs[0];
      const caseFlag = rFlags.some(f => f.includes('i'));
      const numFlag  = rFlags.some(f => f.includes('n'));
      const invertFlag = rFlags.some(f => f.includes('v'));
      let re;
      try { re = new RegExp(pattern, caseFlag ? 'i' : ''); } catch { return [{ type: 'text', color: 'red', text: `grep: invalid pattern` }]; }
      const matches = textLines
        .map((line, idx) => ({ line, idx: idx + 1 }))
        .filter(({ line }) => invertFlag ? !re.test(line) : re.test(line));
      if (!matches.length) return [{ type: 'text', color: 'dim', text: '(no matches)' }];
      return matches.map(({ line, idx }) => ({
        type: 'grep-pipe',
        text: line,
        pattern,
        lineNum: idx,
        showNum: numFlag,
        re,
      }));
    }
    case 'wc': {
      const lFlag = rFlags.some(f => f.includes('l'));
      const wFlag = rFlags.some(f => f.includes('w'));
      const joined = textLines.join('\n');
      const lc = textLines.length;
      const wc = joined.trim().split(/\s+/).filter(Boolean).length;
      const bc = new TextEncoder().encode(joined).length;
      if (lFlag) return [{ type: 'text', color: 'cyan', text: String(lc).padStart(7) }];
      if (wFlag) return [{ type: 'text', color: 'cyan', text: String(wc).padStart(7) }];
      return [{ type: 'wc-pipe', lines: lc, words: wc, bytes: bc }];
    }
    case 'sort': {
      const rFlag = rFlags.some(f => f.includes('r'));
      const uFlag = rFlags.some(f => f.includes('u'));
      let sorted = [...textLines].sort();
      if (rFlag) sorted.reverse();
      if (uFlag) sorted = [...new Set(sorted)];
      return sorted.map(t => ({ type: 'text', color: 'white', text: t }));
    }
    case 'uniq': {
      const result = [];
      textLines.forEach((l, i) => { if (i === 0 || l !== textLines[i - 1]) result.push(l); });
      return result.map(t => ({ type: 'text', color: 'white', text: t }));
    }
    case 'head': {
      const nFlag = rFlags.find(f => f.startsWith('-n'));
      let n = 10;
      if (nFlag) {
        const nv = nFlag.slice(2);
        if (nv) n = parseInt(nv, 10);
        else { const nx = rRawArgs[rRawArgs.indexOf(nFlag) + 1]; if (nx && !isNaN(parseInt(nx))) n = parseInt(nx, 10); }
      }
      return textLines.slice(0, n).map(t => ({ type: 'text', color: 'white', text: t }));
    }
    case 'tail': {
      const nFlag = rFlags.find(f => f.startsWith('-n'));
      let n = 10;
      if (nFlag) {
        const nv = nFlag.slice(2);
        if (nv) n = parseInt(nv, 10);
        else { const nx = rRawArgs[rRawArgs.indexOf(nFlag) + 1]; if (nx && !isNaN(parseInt(nx))) n = parseInt(nx, 10); }
      }
      return textLines.slice(-n).map(t => ({ type: 'text', color: 'white', text: t }));
    }
    default:
      return [{ type: 'text', color: 'red', text: `bash: ${rCmd}: not supported as pipe destination in this sim` }];
  }
}

/* ── Single command executor (returns output lines, no side-effects) ── */
function runSingleCommand(trimmed, cwd) {
  const parts   = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const cmd     = parts[0];
  const rawArgs = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ''));
  const flags   = rawArgs.filter(a => a.startsWith('-'));
  const args    = rawArgs.filter(a => !a.startsWith('-'));

  const resolveFile = (argPath) => {
    const resolved = resolvePath(argPath, cwd);
    const node = getNode(resolved);
    if (node === null)            return { err: `${argPath}: No such file or directory` };
    if (typeof node === 'object') return { err: `${argPath}: Is a directory` };
    return { content: node, resolved };
  };

  switch (cmd) {
    case 'cat': {
      if (!args[0]) return [{ type: 'text', color: 'red', text: 'cat: missing file operand' }];
      const { err, content } = resolveFile(args[0]);
      if (err) return [{ type: 'text', color: 'red', text: `cat: ${err}` }];
      return content.split('\n').map(t => ({ type: 'text', color: 'white', text: t }));
    }
    case 'ls': {
      const showHidden = flags.some(f => f.includes('a'));
      const targetPath = args[0] ? resolvePath(args[0], cwd) : cwd;
      const node = getNode(targetPath);
      if (!node || typeof node === 'string') return [{ type: 'text', color: 'red', text: `ls: no such directory` }];
      const entries = Object.keys(node).filter(k => showHidden || !k.startsWith('.'));
      return entries.map(e => ({ type: 'text', color: typeof node[e] === 'object' ? 'blue' : 'white', text: e }));
    }
    case 'find': {
      if (!args[0]) return [];
      const searchPath = resolvePath(args[0], cwd);
      const rootNode = getNode(searchPath);
      if (!rootNode) return [];
      const nameFlag = (() => { const idx = rawArgs.findIndex(a => a === '-name'); return idx !== -1 ? rawArgs[idx + 1] : null; })();
      const typeFlag = (() => { const idx = rawArgs.findIndex(a => a === '-type'); return idx !== -1 ? rawArgs[idx + 1] : null; })();
      const globToRe = (pattern) => {
        if (!pattern) return null;
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp('^' + escaped + '$', 'i');
      };
      const nameRe = nameFlag ? globToRe(nameFlag) : null;
      const allEntries = typeof rootNode === 'object'
        ? [{ path: searchPath, isDir: true }, ...walkFS(rootNode, searchPath)]
        : [{ path: searchPath, isDir: false }];
      return allEntries
        .filter(e => {
          if (typeFlag === 'd' && !e.isDir) return false;
          if (typeFlag === 'f' && e.isDir)  return false;
          if (nameRe && !nameRe.test(e.path.split('/').pop())) return false;
          return true;
        })
        .map(e => {
          const dp = e.path.startsWith('/home/user') ? e.path.replace('/home/user', '~') : e.path;
          const di = dp.slice(0, dp.lastIndexOf('/') + 1);
          const ba = dp.slice(dp.lastIndexOf('/') + 1);
          return { type: 'find-result', dir: di, base: ba, isDir: e.isDir };
        });
    }
    case 'du': {
      if (!args[0]) return [];
      const targetPath = resolvePath(args[0], cwd);
      const node = getNode(targetPath);
      if (!node) return [];
      const human = flags.some(f => f.includes('h'));
      const bytes = duCalc(node, targetPath);
      const dp = targetPath.startsWith('/home/user') ? targetPath.replace('/home/user', '~') : targetPath;
      return [{ type: 'du-line', size: human ? formatBytes(bytes, true) : String(Math.ceil(bytes / 1024)), path: dp }];
    }
    case 'df': {
      const human = flags.some(f => f.includes('h'));
      return Object.entries(DISK_META).map(([mp, d]) => ({
        type: 'df-line',
        filesystem: d.device,
        size:  human ? formatBytes(d.size, true)  : String(Math.ceil(d.size / 1024)),
        used:  human ? formatBytes(d.used, true)  : String(Math.ceil(d.used / 1024)),
        avail: human ? formatBytes(d.avail, true) : String(Math.ceil(d.avail / 1024)),
        pct:   Math.round((d.used / d.size) * 100) + '%',
        mount: mp,
      }));
    }
    case 'history': {
      return [];
    }
    default:
      return [{ type: 'text', color: 'dim', text: '' }];
  }
}

/* ── Objectives ── */
const OBJECTIVES = [
  {
    id:    'df_h',
    label: 'Check disk space with df -h',
    desc:  'Use df -h to see all mounted filesystems with human-readable sizes.',
    hint:  'df -h',
    validate: (_cwd, hist) => hist.some(h => /^df\s+-[a-z]*h[a-z]*/.test(h.trim()) || /^df\s+--human/.test(h.trim())),
    successMsg: 'df shows filesystem usage. -h makes sizes readable. Run it whenever a disk-full error appears.',
  },
  {
    id:    'du_h',
    label: 'Check size of ~/videos with du -sh',
    desc:  'Use du -sh to get a single human-readable summary of a directory\'s total size.',
    hint:  'du -sh ~/videos',
    validate: (_cwd, hist) =>
      hist.some(h => /^du\s+.*-[a-z]*s[a-z]*h[a-z]*\s+.*videos/.test(h.trim()) ||
                     /^du\s+.*-[a-z]*h[a-z]*s[a-z]*\s+.*videos/.test(h.trim()) ||
                     /^du\s+.*videos.*-[a-z]*sh/.test(h.trim())),
    successMsg: 'du -sh is the go-to for "how big is this folder?" -s summarises (no subdirs), -h makes it readable.',
  },
  {
    id:    'stat_file',
    label: 'Inspect metadata of documents/report.txt with stat',
    desc:  'Use stat to display a file\'s inode, permissions, size, and timestamps.',
    hint:  'stat documents/report.txt',
    validate: (_cwd, hist) =>
      hist.some(h => /^stat\s+.*report\.txt/.test(h.trim())),
    successMsg: 'stat reveals everything the filesystem knows about a file: inode, blocks, atime, mtime, ctime, and permissions in octal.',
  },
  {
    id:    'file_cmd',
    label: 'Detect the type of ~/projects/scripts/backup.sh with file',
    desc:  'Use file to identify what a file really is, regardless of its extension.',
    hint:  'file ~/projects/scripts/backup.sh',
    validate: (_cwd, hist) =>
      hist.some(h => /^file\s+.*backup\.sh/.test(h.trim())),
    successMsg: 'file reads magic bytes/content instead of trusting extensions. Use it when you get a file without an extension.',
  },
  {
    id:    'mount_cmd',
    label: 'List all mounted filesystems with mount',
    desc:  'Run mount with no arguments to see every filesystem currently mounted.',
    hint:  'mount',
    validate: (_cwd, hist) => hist.some(h => /^mount$/.test(h.trim())),
    successMsg: 'mount with no arguments lists everything. You can see the device, mount point, type, and options for each filesystem.',
  },
  {
    id:    'pipe_grep',
    label: 'Pipe df -h into grep to find the root filesystem',
    desc:  'Use the | operator to send df -h output into grep and filter for the root mount.',
    hint:  'df -h | grep "/$"',
    validate: (_cwd, hist) =>
      hist.some(h => /^df\s+.*\|\s*grep/.test(h.trim())),
    successMsg: 'Pipes are the backbone of the Unix philosophy. The output of the left command becomes the input of the right.',
  },
  {
    id:    'pipe_wc',
    label: 'Count files in ~/projects using find piped to wc -l',
    desc:  'Combine find and wc -l to count how many files are in a directory tree.',
    hint:  'find ~/projects -type f | wc -l',
    validate: (_cwd, hist) =>
      hist.some(h => /^find\s+.*projects.*\|\s*wc\s+-l/.test(h.trim())),
    successMsg: 'find ... | wc -l is the classic "how many files" query. Combine with -name to count specific file types.',
  },
  {
    id:    'pipe_sort',
    label: 'List ~/logs files and sort them with ls piped to sort -r',
    desc:  'Pipe ls output into sort -r to reverse-sort the filenames.',
    hint:  'ls ~/logs | sort -r',
    validate: (_cwd, hist) =>
      hist.some(h => /^ls\s+.*logs\s*\|\s*sort\s+-r/.test(h.trim()) ||
                     /^ls\s+.*\|\s*sort\s+-r/.test(h.trim())),
    successMsg: 'sort -r reverses alphabetical order. Add -n for numeric sort, -k2 to sort by the second column.',
  },
];

const LESSONS_NAV = [
  { level: '01', title: 'Where Am I?',           status: 'done',   href: '/learn/beginner/level-1' },
  { level: '02', title: 'Moving Around',          status: 'done',   href: '/learn/beginner/level-2' },
  { level: '03', title: 'File & Dir Management', status: 'done',   href: '/learn/beginner/level-3' },
  { level: '04', title: 'Viewing File Contents', status: 'done',   href: '/learn/beginner/level-4' },
  { level: '05', title: 'System Info & Find',    status: 'done',   href: '/learn/intermediate/level-5' },
  { level: '06', title: 'Disk & Pipelines',      status: 'active', href: '/learn/intermediate/level-6' },
  { level: '07', title: 'Permissions',           status: 'locked', href: '#' },
];

const LESSON = {
  level:   '06',
  track:   'intermediate',
  title:   'Disk & Pipelines',
  module:  'module_02 — intermediate',
  description: [
    { text: 'Two power-ups this level. First: disk awareness — ' },
    { text: 'df', code: true }, { text: ' shows filesystem usage, ' },
    { text: 'du', code: true }, { text: ' measures directory size, ' },
    { text: 'stat', code: true }, { text: ' exposes file metadata, ' },
    { text: 'file', code: true }, { text: ' identifies file types, and ' },
    { text: 'mount', code: true },
    { text: ' lists mounted volumes. Second: the Unix pipe ' },
    { text: '|', code: true },
    { text: ' — chain commands so one\'s output feeds the next\'s input.' },
  ],
  commands: [
    { name: 'df',           desc: 'disk usage of all filesystems' },
    { name: 'df -h',        desc: 'human-readable sizes' },
    { name: 'du <path>',    desc: 'disk usage of a path' },
    { name: 'du -sh <path>',desc: 'summary, human-readable' },
    { name: 'du -h <path>', desc: 'human sizes, per subdir' },
    { name: 'stat <file>',  desc: 'file metadata & timestamps' },
    { name: 'file <path>',  desc: 'identify file type' },
    { name: 'mount',        desc: 'list mounted filesystems' },
    { name: 'cmd1 | cmd2',  desc: 'pipe: output of cmd1 → input of cmd2' },
  ],
  xp: 200,
  nextLevel: '/learn/intermediate/level-7',
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

/* ── Grep highlight ── */
function GrepHighlight({ text, re }) {
  try {
    const parts = text.split(re);
    const flags = re.flags;
    const reG   = new RegExp(re.source, flags.includes('g') ? flags : flags + 'g');
    const matches = [...text.matchAll(reG)].map(m => m[0]);
    let mi = 0;
    return (
      <span>
        {parts.map((part, i) => (
          <span key={i}>
            <span className="text-[#d4d4d4]">{part}</span>
            {i < parts.length - 1 && <span className="bg-[#fbbf24]/30 text-[#fbbf24] font-bold">{matches[mi++]}</span>}
          </span>
        ))}
      </span>
    );
  } catch {
    return <span className="text-[#d4d4d4]">{text}</span>;
  }
}

/* ── Output renderer ── */
function OutputLine({ line }) {
  const colorMap = {
    green: 'text-[#4ade80]', cyan:   'text-[#22d3ee]', yellow: 'text-[#fbbf24]',
    red:   'text-[#f87171]', dim:    'text-[#3a3a3a]',  white:  'text-[#d4d4d4]',
    blue:  'text-[#60a5fa]', purple: 'text-[#a78bfa]',  orange: 'text-[#fb923c]',
  };
  const cls = colorMap[line.color] || 'text-[#aaa]';

  if (line.type === 'prompt') {
    return (
      <div className="flex items-center gap-1 font-mono text-[13px] leading-relaxed flex-wrap">
        <span className="text-[#4ade80] font-bold">user</span>
        <span className="text-[#2a2a2a]">@</span>
        <span className="text-[#4ade80] font-bold">linux</span>
        <span className="text-[#2a2a2a]">:</span>
        <span className="text-[#60a5fa]">{line.path}</span>
        <span className="text-[#444]">$</span>
        <span className="text-[#d4d4d4] ml-1">{line.cmd}</span>
        {line.pipe && <><span className="text-[#fbbf24] mx-1">|</span><span className="text-[#d4d4d4]">{line.pipe}</span></>}
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
        <span className="text-[#3a3a3a]">{line.perm}</span>
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
  if (line.type === 'df-header') {
    return (
      <div className="font-mono text-[12px] flex gap-0 text-[#3a3a3a] select-none">
        <span className="w-[140px]">Filesystem</span>
        <span className="w-[64px] text-right">Size</span>
        <span className="w-[64px] text-right">Used</span>
        <span className="w-[64px] text-right">Avail</span>
        <span className="w-[52px] text-right">Use%</span>
        <span className="ml-3">Mounted on</span>
      </div>
    );
  }
  if (line.type === 'df-line') {
    const pct = parseInt(line.pct, 10);
    const barColor = pct > 85 ? '#f87171' : pct > 65 ? '#fbbf24' : '#4ade80';
    const barW     = Math.round(pct / 5); // max 20 chars
    return (
      <div className="font-mono text-[12px] flex gap-0 items-center">
        <span className="w-[140px] text-[#60a5fa] truncate">{line.filesystem}</span>
        <span className="w-[64px] text-right text-[#d4d4d4]">{line.size}</span>
        <span className="w-[64px] text-right text-[#fbbf24]">{line.used}</span>
        <span className="w-[64px] text-right text-[#4ade80]">{line.avail}</span>
        <span className="w-[52px] text-right" style={{ color: barColor }}>{line.pct}</span>
        <span className="ml-3 text-[#888]">{line.mount}</span>
      </div>
    );
  }
  if (line.type === 'du-line') {
    return (
      <div className="font-mono text-[13px] flex gap-4">
        <span className="text-[#fbbf24] min-w-[56px] text-right">{line.size}</span>
        <span className="text-[#888]">{line.path}</span>
      </div>
    );
  }
  if (line.type === 'stat-block') {
    return (
      <div className="font-mono text-[12px] space-y-[1px]">
        <div><span className="text-[#3a3a3a]">  File: </span><span className="text-[#60a5fa]">{line.file}</span></div>
        <div><span className="text-[#3a3a3a]">  Size: </span><span className="text-[#fbbf24]">{line.size}</span><span className="text-[#3a3a3a]">   Blocks: </span><span className="text-[#d4d4d4]">{line.blocks}</span><span className="text-[#3a3a3a]">   IO Block: 4096   </span><span className="text-[#4ade80]">regular file</span></div>
        <div><span className="text-[#3a3a3a]">Device: </span><span className="text-[#d4d4d4]">sda1</span><span className="text-[#3a3a3a]">   Inode: </span><span className="text-[#d4d4d4]">{line.inode}</span><span className="text-[#3a3a3a]">   Links: </span><span className="text-[#d4d4d4]">1</span></div>
        <div><span className="text-[#3a3a3a]">Access: </span><span className="text-[#a78bfa]">{line.perms}</span><span className="text-[#3a3a3a]">   Uid: (1000/user)   Gid: (1000/user)</span></div>
        <div><span className="text-[#3a3a3a]">Access: </span><span className="text-[#d4d4d4]">2024-09-15 10:12:44</span></div>
        <div><span className="text-[#3a3a3a]">Modify: </span><span className="text-[#d4d4d4]">2024-09-14 18:33:01</span></div>
        <div><span className="text-[#3a3a3a]">Change: </span><span className="text-[#d4d4d4]">2024-09-14 18:33:01</span></div>
        <div><span className="text-[#3a3a3a]"> Birth: </span><span className="text-[#d4d4d4]">2024-09-10 09:00:00</span></div>
      </div>
    );
  }
  if (line.type === 'file-result') {
    return (
      <div className="font-mono text-[13px]">
        <span className="text-[#60a5fa]">{line.path}</span>
        <span className="text-[#3a3a3a]">: </span>
        <span className="text-[#4ade80]">{line.desc}</span>
      </div>
    );
  }
  if (line.type === 'mount-line') {
    return (
      <div className="font-mono text-[12px]">
        <span className="text-[#60a5fa]">{line.device}</span>
        <span className="text-[#3a3a3a]"> on </span>
        <span className="text-[#fbbf24]">{line.mountpoint}</span>
        <span className="text-[#3a3a3a]"> type </span>
        <span className="text-[#4ade80]">{line.fstype}</span>
        <span className="text-[#3a3a3a]"> ({line.opts})</span>
      </div>
    );
  }
  if (line.type === 'find-result') {
    return (
      <div className="font-mono text-[13px] leading-relaxed">
        <span className="text-[#3a3a3a]">{line.dir}</span>
        <span style={{ color: line.isDir ? '#60a5fa' : '#a78bfa' }}>{line.base}{line.isDir ? '/' : ''}</span>
      </div>
    );
  }
  if (line.type === 'grep-pipe') {
    return (
      <div className="font-mono text-[13px] leading-relaxed flex gap-2">
        {line.showNum && <span className="text-[#3a3a3a] select-none min-w-[28px] text-right">{line.lineNum}</span>}
        <GrepHighlight text={line.text} re={line.re} />
      </div>
    );
  }
  if (line.type === 'wc-pipe') {
    return (
      <div className="font-mono text-[13px] flex gap-4">
        <span className="text-[#22d3ee]">{String(line.lines).padStart(6)}</span>
        <span className="text-[#4ade80]">{String(line.words).padStart(6)}</span>
        <span className="text-[#60a5fa]">{String(line.bytes).padStart(6)}</span>
      </div>
    );
  }
  if (line.type === 'pipe-sep') {
    return (
      <div className="flex items-center gap-2 my-1">
        <div className="h-px flex-1 bg-[#fbbf24]/15" />
        <span className="text-[10px] text-[#fbbf24]/50 font-mono tracking-widest">PIPE</span>
        <div className="h-px flex-1 bg-[#fbbf24]/15" />
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
export default function Level6Page() {
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

  const inputRef    = useRef(null);
  const outputRef   = useRef(null);
  const cwdRef      = useRef(cwd);
  cwdRef.current    = cwd;
  const allHistRef  = useRef(allHistory);
  allHistRef.current = allHistory;
  const cmdHistRef  = useRef(cmdHistory);
  cmdHistRef.current = cmdHistory;

  const progress   = levelDone ? 100 : Math.round((completed.length / OBJECTIVES.length) * 90);
  const currentObj = OBJECTIVES[objIdx];

  useEffect(() => {
    setOutput([
      { id: 0, type: 'text', color: 'dim',    text: 'Linux Learning Platform  —  bash 5.2.21' },
      { id: 1, type: 'text', color: 'dim',    text: "Type 'help' to see commands. Try piping with |" },
      { id: 2, type: 'text', color: 'dim',    text: '' },
      { id: 3, type: 'text', color: 'green',  text: 'Welcome to Level 06 — Disk & Pipelines' },
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
              addLines([{ type: 'text', color: 'green', text: '✓ All objectives complete! Level 06 passed.' }]);
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
    setCmdHistory(prev => { const u = [trimmed, ...prev]; cmdHistRef.current = u; return u; });
    setHistIdx(-1);
    const newAllHistory = [trimmed, ...allHistRef.current];
    setAllHistory(newAllHistory);

    /* ── Pipe detection ── */
    const pipeIdx = (() => {
      // find | not inside quotes
      let inQ = false; let qc = '';
      for (let i = 0; i < trimmed.length; i++) {
        const c = trimmed[i];
        if (!inQ && (c === '"' || c === "'")) { inQ = true; qc = c; }
        else if (inQ && c === qc) inQ = false;
        else if (!inQ && c === '|') return i;
      }
      return -1;
    })();

    if (pipeIdx !== -1) {
      const left  = trimmed.slice(0, pipeIdx).trim();
      const right = trimmed.slice(pipeIdx + 1).trim();
      const lCmd  = left.split(/\s+/)[0];
      const rCmd  = right.split(/\s+/)[0];
      const promptLine = { type: 'prompt', path: cwdDisplay(currentCwd), cmd: left, pipe: right };
      const pipeOut = executePipe(left, right, currentCwd);
      addLines([promptLine, { type: 'pipe-sep' }, ...pipeOut, { type: 'text', color: 'dim', text: '' }]);
      checkObjective(newAllHistory);
      return;
    }

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

      /* ── navigation (carried over) ── */
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
        const targetPath = args[0] ? resolvePath(args[0], currentCwd) : currentCwd;
        const node = getNode(targetPath);
        if (!node || typeof node === 'string') {
          responseLines = [{ type: 'text', color: 'red', text: `ls: cannot access '${args[0] || '.'}': No such file or directory` }]; break;
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
        const targetPath = args[0] ? resolvePath(args[0], currentCwd) : currentCwd;
        const node = getNode(targetPath);
        if (!node || typeof node === 'string') { responseLines = [{ type: 'text', color: 'red', text: `tree: No such directory` }]; break; }
        responseLines = [{ type: 'tree', lines: buildTree(node) }];
        break;
      }

      /* ── NEW: disk commands ── */

      case 'df': {
        const human = flags.some(f => f.includes('h'));
        responseLines = [
          { type: 'df-header' },
          ...Object.entries(DISK_META).map(([mp, d]) => ({
            type: 'df-line',
            filesystem: d.device,
            size:  human ? formatBytes(d.size, true)  : String(Math.ceil(d.size / 1024)),
            used:  human ? formatBytes(d.used, true)  : String(Math.ceil(d.used / 1024)),
            avail: human ? formatBytes(d.avail, true) : String(Math.ceil(d.avail / 1024)),
            pct:   Math.round((d.used / d.size) * 100) + '%',
            mount: mp,
          })),
        ];
        break;
      }

      case 'du': {
        if (!args[0] && !flags.length) {
          // du with no args = current dir
          const node = getNode(currentCwd);
          const bytes = node ? duCalc(node, currentCwd) : 0;
          const dp = cwdDisplay(currentCwd);
          responseLines = [{ type: 'du-line', size: String(Math.ceil(bytes / 1024)), path: dp }];
          break;
        }
        const human   = flags.some(f => f.includes('h'));
        const summary = flags.some(f => f.includes('s'));
        const targetArg = args[0] || '.';
        const targetPath = resolvePath(targetArg, currentCwd);
        const node = getNode(targetPath);
        if (!node) { responseLines = [{ type: 'text', color: 'red', text: `du: cannot access '${targetArg}': No such file or directory` }]; break; }

        if (typeof node === 'string') {
          const bytes = estimateSize(targetPath.split('/').pop(), node);
          const dp = targetPath.startsWith('/home/user') ? targetPath.replace('/home/user', '~') : targetPath;
          responseLines = [{ type: 'du-line', size: human ? formatBytes(bytes, true) : String(Math.ceil(bytes / 1024)), path: dp }];
          break;
        }

        if (summary) {
          const bytes = duCalc(node, targetPath);
          const dp = targetPath.startsWith('/home/user') ? targetPath.replace('/home/user', '~') : targetPath;
          responseLines = [{ type: 'du-line', size: human ? formatBytes(bytes, true) : String(Math.ceil(bytes / 1024)), path: dp }];
        } else {
          // show each subdirectory
          const allLines = [];
          for (const [k, v] of Object.entries(node)) {
            if (typeof v === 'object') {
              const b = duCalc(v, targetPath + '/' + k);
              const dp = (targetPath + '/' + k).startsWith('/home/user')
                ? (targetPath + '/' + k).replace('/home/user', '~')
                : targetPath + '/' + k;
              allLines.push({ type: 'du-line', size: human ? formatBytes(b, true) : String(Math.ceil(b / 1024)), path: dp });
            }
          }
          const totalBytes = duCalc(node, targetPath);
          const dp = targetPath.startsWith('/home/user') ? targetPath.replace('/home/user', '~') : targetPath;
          allLines.push({ type: 'du-line', size: human ? formatBytes(totalBytes, true) : String(Math.ceil(totalBytes / 1024)), path: dp });
          responseLines = allLines;
        }
        break;
      }

      case 'stat': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'stat: missing file operand' }]; break; }
        const targetPath = resolvePath(args[0], currentCwd);
        const node = getNode(targetPath);
        if (node === null) { responseLines = [{ type: 'text', color: 'red', text: `stat: cannot stat '${args[0]}': No such file or directory` }]; break; }
        const isDir = typeof node === 'object';
        const content = isDir ? null : node;
        const bytes = isDir ? 4096 : estimateSize(targetPath.split('/').pop(), content);
        const blocks = Math.ceil(bytes / 512);
        const inode = 131000 + Math.abs(targetPath.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 9000;
        const dp = targetPath.startsWith('/home/user') ? targetPath.replace('/home/user', '~') : targetPath;
        responseLines = [{
          type: 'stat-block',
          file:  dp,
          size:  String(bytes),
          blocks: String(blocks),
          inode: String(inode),
          perms: isDir ? '(0755/drwxr-xr-x)' : '(0644/-rw-r--r--)',
        }];
        break;
      }

      case 'file': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'file: missing operand' }]; break; }
        const targetPath = resolvePath(args[0], currentCwd);
        const node = getNode(targetPath);
        if (node === null) { responseLines = [{ type: 'text', color: 'red', text: `file: ${args[0]}: No such file or directory` }]; break; }
        const name = targetPath.split('/').pop();
        const dp = targetPath.startsWith('/home/user') ? targetPath.replace('/home/user', '~') : targetPath;
        if (typeof node === 'object') {
          responseLines = [{ type: 'file-result', path: dp, desc: 'directory' }];
        } else {
          const { desc } = detectFileType(name, node);
          responseLines = [{ type: 'file-result', path: dp, desc }];
        }
        break;
      }

      case 'mount': {
        if (args.length > 0) {
          responseLines = [{ type: 'text', color: 'yellow', text: '(mounting/unmounting is simulated — listing current mounts instead)' }];
        }
        responseLines = [
          ...responseLines,
          ...Object.entries(DISK_META).map(([mp, d]) => ({
            type: 'mount-line', device: d.device, mountpoint: mp, fstype: d.fstype, opts: d.mountOpts,
          })),
          { type: 'mount-line', device: 'sysfs',  mountpoint: '/sys',  fstype: 'sysfs',   opts: 'rw,nosuid,nodev,noexec' },
          { type: 'mount-line', device: 'proc',   mountpoint: '/proc', fstype: 'proc',    opts: 'rw,nosuid,nodev,noexec' },
          { type: 'mount-line', device: 'devpts', mountpoint: '/dev/pts', fstype: 'devpts', opts: 'rw,nosuid,noexec' },
        ];
        break;
      }

      case 'find': {
        if (!args[0]) { responseLines = [{ type: 'text', color: 'red', text: 'find: missing path argument' }]; break; }
        const searchPath = resolvePath(args[0], currentCwd);
        const rootNode   = getNode(searchPath);
        if (!rootNode) { responseLines = [{ type: 'text', color: 'red', text: `find: '${args[0]}': No such file or directory` }]; break; }

        const nameFlag = (() => { const idx = rawArgs.findIndex(a => a === '-name'); return idx !== -1 ? rawArgs[idx + 1] : null; })();
        const typeFlag = (() => { const idx = rawArgs.findIndex(a => a === '-type'); return idx !== -1 ? rawArgs[idx + 1] : null; })();
        const maxDepthFlag = (() => { const idx = rawArgs.findIndex(a => a === '-maxdepth'); return idx !== -1 ? parseInt(rawArgs[idx + 1], 10) : null; })();
        const globToRe = (p) => { if (!p) return null; const e = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'); return new RegExp('^' + e + '$', 'i'); };
        const nameRe = nameFlag ? globToRe(nameFlag) : null;

        const allEntries = typeof rootNode === 'object'
          ? [{ path: searchPath, isDir: true, content: null }, ...walkFS(rootNode, searchPath)]
          : [{ path: searchPath, isDir: false, content: rootNode }];

        const results = allEntries.filter(entry => {
          if (maxDepthFlag !== null) {
            const rd = entry.path.slice(searchPath.length).split('/').filter(Boolean).length;
            if (rd > maxDepthFlag) return false;
          }
          if (typeFlag === 'd' && !entry.isDir) return false;
          if (typeFlag === 'f' && entry.isDir)  return false;
          if (nameRe && !nameRe.test(entry.path.split('/').pop())) return false;
          return true;
        });

        if (!results.length) { responseLines = [{ type: 'text', color: 'dim', text: '(no results)' }]; break; }
        responseLines = results.map(entry => {
          const dp = entry.path.startsWith('/home/user') ? entry.path.replace('/home/user', '~') : entry.path;
          const di = dp.slice(0, dp.lastIndexOf('/') + 1);
          const ba = dp.slice(dp.lastIndexOf('/') + 1);
          return { type: 'find-result', dir: di, base: ba || '.', isDir: entry.isDir };
        });
        break;
      }

      case 'clear': { setOutput([]); return; }

      case 'help': {
        responseLines = [
          { type: 'text', color: 'green',  text: 'Level 06 commands:' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Disk & Filesystem —' },
          { type: 'text', color: 'white',  text: '  df [-h]             filesystem disk usage' },
          { type: 'text', color: 'white',  text: '  du [-h] [-s] <path> directory disk usage' },
          { type: 'text', color: 'white',  text: '  stat <file>         file metadata & timestamps' },
          { type: 'text', color: 'white',  text: '  file <path>         identify file type' },
          { type: 'text', color: 'white',  text: '  mount               list mounted filesystems' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Pipes —' },
          { type: 'text', color: 'white',  text: '  cmd1 | grep PAT     filter output by pattern' },
          { type: 'text', color: 'white',  text: '  cmd1 | wc -l        count lines of output' },
          { type: 'text', color: 'white',  text: '  cmd1 | sort [-r]    sort output lines' },
          { type: 'text', color: 'white',  text: '  cmd1 | head/tail    trim output' },
          { type: 'text', color: 'dim',    text: '' },
          { type: 'text', color: 'cyan',   text: '  — Navigation (prev levels) —' },
          { type: 'text', color: 'white',  text: '  cd / ls / pwd / tree / find / clear' },
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
      setHistIdx(prev => { const n = Math.min(prev + 1, cmdHistory.length - 1); setInputVal(cmdHistory[n] || ''); return n; });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistIdx(prev => { const n = Math.max(prev - 1, -1); setInputVal(n === -1 ? '' : cmdHistory[n] || ''); return n; });
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

            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Description</div>
              <p className="text-[12px] text-[#555] leading-[1.8]">
                {LESSON.description.map((seg, i) => {
                  if (seg.code) return <code key={i} className="text-[#4ade80] bg-[#0a0f0a] px-1 rounded text-[11px]">{seg.text}</code>;
                  return <span key={i}>{seg.text}</span>;
                })}
              </p>
            </div>

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

            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Commands</div>
              <div className="space-y-1.5">
                {LESSON.commands.map((c) => (
                  <div key={c.name} className="flex gap-3 items-baseline">
                    <code className="text-[11px] text-[#4ade80] font-bold min-w-[108px] flex-shrink-0">{c.name}</code>
                    <span className="text-[11px] text-[#333]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipe cheat-sheet */}
            <div className="bg-[#0a0f0a] border border-[#1c1c1c] rounded p-3">
              <div className="text-[10px] text-[#fbbf24] font-bold tracking-[0.12em] uppercase mb-2">Pipe — supported right-hand cmds</div>
              <div className="space-y-1">
                {[
                  ['grep PAT',    'filter matching lines'],
                  ['grep -i PAT', 'case-insensitive filter'],
                  ['grep -n PAT', 'show line numbers'],
                  ['grep -v PAT', 'exclude matching lines'],
                  ['wc -l',       'count lines'],
                  ['wc -w',       'count words'],
                  ['sort',        'sort lines alphabetically'],
                  ['sort -r',     'reverse sort'],
                  ['sort -u',     'sort + deduplicate'],
                  ['head [-n N]', 'first N lines'],
                  ['tail [-n N]', 'last N lines'],
                  ['uniq',        'remove adjacent duplicates'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex gap-3">
                    <code className="text-[11px] text-[#fbbf24] min-w-[80px]">{cmd}</code>
                    <span className="text-[11px] text-[#333]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

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

          <div className="h-[3px] bg-[#111] border-t border-[#1c1c1c] flex-shrink-0">
            <div className="h-full bg-[#4ade80] transition-all duration-500"
              style={{ width: `${progress}%`, boxShadow: '0 0 8px #4ade8060' }} />
          </div>
        </aside>

        {/* ── TERMINAL ── */}
        <div className="flex-1 bg-[#000] flex flex-col overflow-hidden relative">

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

          <div ref={outputRef}
            className="flex-1 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-[2px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a1a #000' }}>
            {output.map((line) => <OutputLine key={line.id} line={line} />)}
          </div>

          {showToast && (
            <div className="absolute bottom-[72px] right-5 bg-[#0a0f0a] border border-[#4ade80] rounded-lg px-5 py-4 w-72 shadow-[0_0_24px_#4ade8018] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#4ade80] font-bold mb-1.5">✓ Level 06 complete!</div>
              <div className="text-[11px] text-[#444] leading-relaxed mb-1">
                You can now read disk usage with <code className="text-[#4ade80]">df</code> and <code className="text-[#4ade80]">du</code>,
                inspect files with <code className="text-[#4ade80]">stat</code> and <code className="text-[#4ade80]">file</code>,
                and chain any commands together with <code className="text-[#fbbf24]">|</code>.
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