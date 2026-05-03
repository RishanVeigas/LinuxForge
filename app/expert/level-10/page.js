'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Fake package database ── */
const PKG_DB = {
  installed: {
    'bash':        { version: '5.2.15-2ubuntu1', size: '1,802 kB', section: 'shells',    desc: 'GNU Bourne Again SHell', deps: ['base-files', 'libc6'] },
    'curl':        { version: '7.88.1-8ubuntu2', size: '194 kB',   section: 'web',       desc: 'command line tool for transferring data with URL syntax', deps: ['libcurl4', 'zlib1g'] },
    'git':         { version: '1:2.39.2-1ubuntu1', size: '3,024 kB', section: 'vcs',     desc: 'fast, scalable, distributed revision control system', deps: ['perl', 'liberror-perl', 'git-man'] },
    'nginx':       { version: '1.24.0-2ubuntu7', size: '536 kB',   section: 'httpd',     desc: 'small, powerful, scalable web/proxy server', deps: ['libnginx-mod-http-gzip-static', 'nginx-common'] },
    'python3':     { version: '3.11.4-1',         size: '626 kB',   section: 'python',   desc: 'interactive high-level object-oriented language (default python3 version)', deps: ['python3.11', 'libpython3-stdlib'] },
    'vim':         { version: '2:9.0.1378-2',     size: '1,600 kB', section: 'editors',  desc: 'Vi IMproved - enhanced vi editor', deps: ['vim-common', 'libacl1'] },
    'wget':        { version: '1.21.3-1ubuntu1',  size: '344 kB',   section: 'web',      desc: 'retrieves files from the web', deps: ['libc6', 'libgnutls30'] },
    'openssh-server': { version: '1:9.3p1-1ubuntu3', size: '495 kB', section: 'net',    desc: 'secure shell (SSH) server, for secure access from remote machines', deps: ['openssh-sftp-server', 'libpam-runtime'] },
    'htop':        { version: '3.2.2-1',           size: '236 kB',  section: 'utils',    desc: 'interactive processes viewer', deps: ['libc6', 'libncursesw6'] },
    'tmux':        { version: '3.3a-3ubuntu0.1',   size: '424 kB',  section: 'admin',    desc: 'terminal multiplexer', deps: ['libc6', 'libevent-2.1-7', 'libutempter0'] },
    'nodejs':      { version: '18.17.1-1nodesource1', size: '27,520 kB', section: 'javascript', desc: 'evented I/O for V8 javascript', deps: ['libc6', 'libstdc++6'] },
    'docker.io':   { version: '24.0.5-0ubuntu1',  size: '102,400 kB', section: 'admin', desc: 'Linux container runtime', deps: ['containerd', 'runc', 'iptables'] },
  },
  available: {
    'neovim':      { version: '0.9.4-3',           size: '9,010 kB', section: 'editors', desc: 'heavily refactored vim fork', deps: ['libc6', 'libluajit-5.1-2'] },
    'ripgrep':     { version: '13.0.0-4ubuntu1',   size: '1,620 kB', section: 'utils',  desc: 'recursively search directories for a regex pattern', deps: ['libc6'] },
    'jq':          { version: '1.6-2.1ubuntu3',    size: '301 kB',   section: 'utils',  desc: 'lightweight and flexible command-line JSON processor', deps: ['libc6', 'libonig5'] },
    'ffmpeg':      { version: '7:6.1.1-3ubuntu5',  size: '1,616 kB', section: 'video',  desc: 'Tools for transcoding, streaming and playing of multimedia files', deps: ['libavcodec60', 'libavformat60'] },
    'tree':        { version: '2.1.1-1',            size: '60 kB',   section: 'utils',   desc: 'displays an indented directory tree, in color', deps: ['libc6'] },
    'nmap':        { version: '7.94+git20230807', size: '4,330 kB',  section: 'net',    desc: 'The Network Mapper', deps: ['libc6', 'libpcap0.8', 'lua5.3'] },
    'postgresql':  { version: '16+257',            size: '44 kB',    section: 'database', desc: 'object-relational SQL database (supported version)', deps: ['postgresql-16'] },
    'redis':       { version: '5:7.2.3-1',         size: '53 kB',    section: 'database', desc: 'Persistent key-value database with network interface', deps: ['adduser', 'lsb-base'] },
    'zsh':         { version: '5.9-4ubuntu2',      size: '198 kB',   section: 'shells',  desc: 'shell with lots of features', deps: ['zsh-common'] },
    'fzf':         { version: '0.44.1-1',           size: '1,274 kB', section: 'utils', desc: 'general-purpose command-line fuzzy finder', deps: ['libc6'] },
    'bat':         { version: '0.24.0-1',           size: '1,524 kB', section: 'utils', desc: 'cat clone with syntax highlighting and git integration', deps: ['libc6'] },
    'httrack':     { version: '3.49.2-2.1',        size: '400 kB',   section: 'web',    desc: 'Copy websites to your computer', deps: ['libhttrack2', 'zlib1g'] },
  },
  snaps: {
    'code':        { version: '1.87.2', channel: 'stable/latest', publisher: 'vscode✓',  size: '386 MB', desc: 'Code editing. Redefined.' },
    'discord':     { version: '0.0.43', channel: 'stable/latest', publisher: 'discord✓', size: '96 MB',  desc: 'Chat for Communities and Friends' },
    'spotify':     { version: '1.2.22', channel: 'stable/latest', publisher: 'spotify✓', size: '186 MB', desc: 'Music for everyone.' },
    'kubectl':     { version: '1.29.2', channel: 'stable/latest', publisher: 'canonical✓', size: '57 MB', desc: 'Run kubectl, the Kubernetes CLI' },
  },
  availableSnaps: {
    'vlc':         { version: '3.0.21', channel: 'stable/latest', publisher: 'videolan✓', size: '256 MB', desc: 'The ultimate media player' },
    'slack':       { version: '4.36.140', channel: 'stable/latest', publisher: 'slack✓',  size: '196 MB', desc: 'Team communication and collaboration' },
    'obsidian':    { version: '1.5.12', channel: 'stable/latest', publisher: 'obsidian✓', size: '73 MB',  desc: 'A powerful knowledge base' },
    'postman':     { version: '10.22.15', channel: 'stable/latest', publisher: 'postman✓', size: '228 MB', desc: 'API platform for building and using APIs' },
  },
  rpm: {
    'bash':        { version: '5.1.8-6.el9', arch: 'x86_64', size: '8.0 M', repo: 'baseos', desc: 'The GNU Bourne Again shell' },
    'vim-enhanced':{ version: '8.2.2637-20.el9', arch: 'x86_64', size: '1.8 M', repo: 'appstream', desc: 'A version of the VIM editor which includes recent enhancements' },
    'python3':     { version: '3.11.5-1.el9_2', arch: 'x86_64', size: '32 k', repo: 'appstream', desc: 'Interpreter of the Python programming language' },
    'curl':        { version: '7.76.1-26.el9_3.2', arch: 'x86_64', size: '306 k', repo: 'baseos', desc: 'A utility for getting files from remote servers (FTP, HTTP, and others)' },
    'git':         { version: '2.43.0-1.el9', arch: 'x86_64', size: '146 k', repo: 'appstream', desc: 'Fast Version Control System' },
  },
};

/* ── Simulated dpkg status database ── */
const DPKG_STATUS = Object.entries(PKG_DB.installed).map(([name, pkg]) => ({
  name,
  status: 'install ok installed',
  ...pkg,
}));

/* ── Objectives ── */
const OBJECTIVES = [
  {
    id:    'apt_list',
    label: 'List installed packages with apt list',
    desc:  'Use apt list --installed to see all currently installed packages.',
    hint:  'apt list --installed',
    validate: (_cwd, hist) =>
      hist.some(h => /^apt\s+list/.test(h.trim())),
    successMsg: 'apt list --installed shows every package dpkg has marked as installed. Pipe to grep to filter: apt list --installed | grep python',
  },
  {
    id:    'apt_search',
    label: 'Search for packages with apt search',
    desc:  'Use apt search to find packages by keyword. Try: apt search json  or  apt search editor',
    hint:  'apt search json',
    validate: (_cwd, hist) =>
      hist.some(h => /^apt\s+search\s+\S+/.test(h.trim())),
    successMsg: 'apt search scans package names and descriptions. apt-cache search does the same thing on older systems — both query the local package index.',
  },
  {
    id:    'apt_show',
    label: 'Inspect a package with apt show',
    desc:  'Use apt show to display detailed metadata for a package. Try: apt show nginx  or  apt show git',
    hint:  'apt show nginx',
    validate: (_cwd, hist) =>
      hist.some(h => /^apt\s+show\s+\S+/.test(h.trim()) || /^apt-cache\s+show\s+\S+/.test(h.trim())),
    successMsg: 'apt show reveals version, maintainer, dependencies, size, and description. Essential before installing an unfamiliar package.',
  },
  {
    id:    'apt_install',
    label: 'Install a package with apt install',
    desc:  'Use apt install to install a new package. Try: apt install jq  or  apt install tree',
    hint:  'apt install jq',
    validate: (_cwd, hist) =>
      hist.some(h => /^(sudo\s+)?apt(-get)?\s+install\s+\S+/.test(h.trim())),
    successMsg: 'apt install resolves dependencies automatically. -y skips confirmation. --no-install-recommends keeps the install minimal.',
  },
  {
    id:    'apt_remove',
    label: 'Remove a package with apt remove',
    desc:  'Use apt remove to uninstall a package. Try: apt remove vim  (apt purge also removes config files)',
    hint:  'apt remove vim',
    validate: (_cwd, hist) =>
      hist.some(h => /^(sudo\s+)?apt(-get)?\s+(remove|purge)\s+\S+/.test(h.trim())),
    successMsg: 'apt remove uninstalls but keeps config files. apt purge removes everything including configs. apt autoremove cleans up unneeded dependencies.',
  },
  {
    id:    'dpkg_cmd',
    label: 'Query installed packages with dpkg',
    desc:  'Use dpkg -l to list all packages, or dpkg -s nginx to show the status of a specific package.',
    hint:  'dpkg -l',
    validate: (_cwd, hist) =>
      hist.some(h => /^dpkg\s+(-l|-s|-L|-S)\b/.test(h.trim())),
    successMsg: 'dpkg is the low-level tool apt builds on. dpkg -l lists all, dpkg -s shows status, dpkg -L lists files owned by a package, dpkg -S finds which package owns a file.',
  },
  {
    id:    'apt_cache',
    label: 'Use apt-cache to query the package cache',
    desc:  'Use apt-cache depends nginx to see what nginx depends on, or apt-cache policy git to see available versions.',
    hint:  'apt-cache depends nginx',
    validate: (_cwd, hist) =>
      hist.some(h => /^apt-cache\s+(depends|policy|rdepends|stats|pkgnames)\s*\S*/.test(h.trim())),
    successMsg: 'apt-cache depends shows what a package needs. apt-cache rdepends shows what packages need it. apt-cache policy shows candidate vs installed versions and repo priorities.',
  },
  {
    id:    'snap_cmd',
    label: 'Manage snaps with snap',
    desc:  'Use snap list to see installed snaps, or snap find editor to search the snap store.',
    hint:  'snap list',
    validate: (_cwd, hist) =>
      hist.some(h => /^snap\s+(list|find|info|install|remove|refresh)\b/.test(h.trim())),
    successMsg: 'Snaps are self-contained packages with automatic updates. snap list shows installed, snap find searches the store, snap info shows details, snap refresh updates all or one snap.',
  },
  {
    id:    'dnf_cmd',
    label: 'Use dnf / yum (RPM-based systems)',
    desc:  'On RHEL/Fedora/CentOS, dnf replaces yum. Try: dnf list installed  or  dnf search git  or  yum info curl',
    hint:  'dnf list installed',
    validate: (_cwd, hist) =>
      hist.some(h => /^(dnf|yum)\s+(list|search|info|install|remove|update|check-update|history|provides)\b/.test(h.trim())),
    successMsg: 'dnf (and its predecessor yum) manage RPM packages. dnf list installed, dnf search, dnf info, dnf install, dnf remove. dnf history lets you undo transactions.',
  },
  {
    id:    'rpm_cmd',
    label: 'Query RPM packages with rpm',
    desc:  'Use rpm -qa to list all installed RPM packages, rpm -qi bash to get info, or rpm -ql curl to list files.',
    hint:  'rpm -qa',
    validate: (_cwd, hist) =>
      hist.some(h => /^rpm\s+-[qilaReVU]*[qilaeVU]+/.test(h.trim())),
    successMsg: 'rpm is the low-level RPM package manager. -q query, -a all packages, -i info, -l list files, -e erase/remove, -V verify. Like dpkg but for RHEL/CentOS/Fedora.',
  },
];

const LESSONS_NAV = [
  { level: '08', title: 'Permissions & Users', status: 'done',   href: '/learn/expert/level-8' },
  { level: '09', title: 'Networking Basics',   status: 'done',   href: '/learn/expert/level-9' },
  { level: '10', title: 'Package Management',  status: 'active', href: '/learn/expert/level-10' },
  { level: '11', title: 'Advanced Text Tools', status: 'locked', href: '#' },
  { level: '12', title: 'Containers & VMs',    status: 'locked', href: '#' },
  { level: '13', title: 'Shell Scripting II',  status: 'locked', href: '#' },
];

const LESSON = {
  level:   '10',
  track:   'expert',
  title:   'Package Management',
  module:  'module_06 — expert',
  description: [
    { text: 'Every Linux distribution ships a package manager. Debian/Ubuntu use ' },
    { text: 'apt', code: true }, { text: ' and the lower-level ' },
    { text: 'dpkg', code: true }, { text: '. RHEL/Fedora/CentOS use ' },
    { text: 'dnf', code: true }, { text: ' (formerly ' },
    { text: 'yum', code: true }, { text: ') and the lower-level ' },
    { text: 'rpm', code: true }, { text: '. ' },
    { text: 'snap', code: true },
    { text: ' provides distro-agnostic containerised packages. Knowing all three ecosystems makes you effective on any server.' },
  ],
  commands: [
    { name: 'apt list --installed',   desc: 'list installed packages' },
    { name: 'apt search <term>',      desc: 'search by keyword' },
    { name: 'apt show <pkg>',         desc: 'detailed package info' },
    { name: 'apt install <pkg>',      desc: 'install a package' },
    { name: 'apt remove <pkg>',       desc: 'remove (keep configs)' },
    { name: 'apt purge <pkg>',        desc: 'remove + wipe configs' },
    { name: 'apt update',             desc: 'refresh package index' },
    { name: 'apt upgrade',            desc: 'upgrade all packages' },
    { name: 'apt autoremove',         desc: 'remove orphan deps' },
    { name: 'apt-get install <pkg>',  desc: 'apt-get (legacy apt)' },
    { name: 'apt-cache show <pkg>',   desc: 'cache metadata' },
    { name: 'apt-cache depends <pkg>',desc: 'show dependencies' },
    { name: 'apt-cache policy <pkg>', desc: 'version & priority' },
    { name: 'dpkg -l',                desc: 'list all dpkg packages' },
    { name: 'dpkg -s <pkg>',          desc: 'package status' },
    { name: 'dpkg -L <pkg>',          desc: 'files in package' },
    { name: 'dpkg -S <file>',         desc: 'which pkg owns file' },
    { name: 'snap list',              desc: 'installed snaps' },
    { name: 'snap find <term>',       desc: 'search snap store' },
    { name: 'snap install <pkg>',     desc: 'install a snap' },
    { name: 'snap refresh',           desc: 'update all snaps' },
    { name: 'dnf list installed',     desc: 'RPM installed list' },
    { name: 'dnf search <term>',      desc: 'search RPM repos' },
    { name: 'dnf install <pkg>',      desc: 'install RPM package' },
    { name: 'dnf info <pkg>',         desc: 'RPM package info' },
    { name: 'yum install <pkg>',      desc: 'legacy RPM install' },
    { name: 'rpm -qa',                desc: 'list all RPM packages' },
    { name: 'rpm -qi <pkg>',          desc: 'RPM package info' },
    { name: 'rpm -ql <pkg>',          desc: 'files in RPM package' },
    { name: 'pacman -Ss <term>',      desc: 'Arch: search packages' },
    { name: 'pacman -S <pkg>',        desc: 'Arch: install package' },
    { name: 'pacman -Q',              desc: 'Arch: list installed' },
  ],
  xp: 325,
  nextLevel: '/expert/level-11',
};

/* ── helpers ── */
function fmtPkgLine(name, pkg, installed) {
  return { name, version: pkg.version, installed };
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
    const isSudo = line.isSudo;
    return (
      <div className="flex items-center gap-1 font-mono text-[13px] leading-relaxed">
        <span className={`font-bold ${isSudo ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>{isSudo ? 'root' : 'user'}</span>
        <span className="text-[#2a2a2a]">@</span>
        <span className="text-[#4ade80] font-bold">linux</span>
        <span className="text-[#2a2a2a]">:</span>
        <span className="text-[#60a5fa]">{line.path}</span>
        <span className="text-[#444]">{isSudo ? '#' : '$'}</span>
        <span className="text-[#d4d4d4] ml-1">{line.cmd}</span>
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

  /* apt list row */
  if (line.type === 'apt-list-row') {
    return (
      <div className="font-mono text-[12px] leading-[1.65] flex gap-2">
        <span className="text-[#4ade80] min-w-[160px]">{line.name}</span>
        <span className="text-[#555]">{line.version}</span>
        {line.installed && <span className="text-[#3f3f3f] ml-1">[installed]</span>}
      </div>
    );
  }

  /* apt show / dpkg -s block */
  if (line.type === 'pkg-detail') {
    const p = line.pkg;
    return (
      <div className="font-mono text-[12px] leading-[1.8]">
        <div><span className="text-[#555]">Package: </span><span className="text-[#4ade80] font-bold">{line.name}</span></div>
        <div><span className="text-[#555]">Version: </span><span className="text-[#fbbf24]">{p.version}</span></div>
        {p.status && <div><span className="text-[#555]">Status: </span><span className="text-[#22d3ee]">{p.status}</span></div>}
        <div><span className="text-[#555]">Section: </span><span className="text-[#60a5fa]">{p.section}</span></div>
        <div><span className="text-[#555]">Installed-Size: </span><span className="text-[#aaa]">{p.size}</span></div>
        <div><span className="text-[#555]">Maintainer: </span><span className="text-[#aaa]">Ubuntu Developers &lt;ubuntu-devel-discuss@lists.ubuntu.com&gt;</span></div>
        {p.deps && <div><span className="text-[#555]">Depends: </span><span className="text-[#a78bfa]">{p.deps.join(', ')}</span></div>}
        <div><span className="text-[#555]">Description: </span><span className="text-[#d4d4d4]">{p.desc}</span></div>
        <div><span className="text-[#555]">Homepage: </span><span className="text-[#60a5fa]">https://packages.ubuntu.com/{line.name}</span></div>
      </div>
    );
  }

  /* install progress */
  if (line.type === 'apt-install') {
    const { pkgName, pkg, isNew } = line;
    if (!isNew) {
      return <div className="font-mono text-[12px] text-[#fbbf24]">{pkgName} is already the newest version ({pkg.version}).</div>;
    }
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#555]">Reading package lists... Done</div>
        <div className="text-[#555]">Building dependency tree... Done</div>
        <div className="text-[#555]">Reading state information... Done</div>
        <div><span className="text-[#d4d4d4]">The following NEW packages will be installed:</span></div>
        <div className="pl-4 text-[#4ade80]">{pkgName}</div>
        <div><span className="text-[#555]">0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.</span></div>
        <div><span className="text-[#555]">Need to get </span><span className="text-[#fbbf24]">{pkg.size}</span><span className="text-[#555]"> of archives.</span></div>
        <div className="text-[#555]">Get:1 http://archive.ubuntu.com/ubuntu jammy/universe amd64 <span className="text-[#4ade80]">{pkgName}</span> amd64 {pkg.version} [{pkg.size}]</div>
        <div className="text-[#4ade80]">Fetched {pkg.size} in 0s (local cache)</div>
        <div className="text-[#555]">Selecting previously unselected package {pkgName}.</div>
        <div className="text-[#555]">(Reading database ... 142,846 files and directories currently installed.)</div>
        <div><span className="text-[#555]">Preparing to unpack .../</span><span className="text-[#4ade80]">{pkgName}_{pkg.version}_amd64.deb</span><span className="text-[#555]"> ...</span></div>
        <div className="text-[#555]">Unpacking {pkgName} ({pkg.version}) ...</div>
        <div className="text-[#555]">Setting up {pkgName} ({pkg.version}) ...</div>
        <div className="text-[#4ade80]">✓ {pkgName} installed successfully.</div>
      </div>
    );
  }

  /* remove progress */
  if (line.type === 'apt-remove') {
    const { pkgName, purge } = line;
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#555]">Reading package lists... Done</div>
        <div className="text-[#555]">Building dependency tree... Done</div>
        <div><span className="text-[#d4d4d4]">The following packages will be {purge ? 'PURGED' : 'REMOVED'}:</span></div>
        <div className="pl-4 text-[#f87171]">{pkgName}</div>
        <div className="text-[#555]">0 upgraded, 0 newly installed, 1 to remove and 0 not upgraded.</div>
        <div className="text-[#555]">After this operation, 0 B of additional disk space will be used.</div>
        <div className="text-[#555]">(Reading database ... 142,847 files and directories currently installed.)</div>
        <div className="text-[#555]">Removing {pkgName} ...</div>
        {purge && <div className="text-[#555]">Purging configuration files for {pkgName} ...</div>}
        <div className="text-[#f87171]">✓ {pkgName} {purge ? 'purged' : 'removed'}.</div>
      </div>
    );
  }

  /* apt update */
  if (line.type === 'apt-update') {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#555]">Get:1 http://security.ubuntu.com/ubuntu jammy-security InRelease [110 kB]</div>
        <div className="text-[#555]">Get:2 http://archive.ubuntu.com/ubuntu jammy InRelease [270 kB]</div>
        <div className="text-[#555]">Get:3 http://archive.ubuntu.com/ubuntu jammy-updates InRelease [119 kB]</div>
        <div className="text-[#555]">Get:4 http://archive.ubuntu.com/ubuntu jammy-backports InRelease [109 kB]</div>
        <div className="text-[#4ade80]">Fetched 608 kB in 1s (608 kB/s)</div>
        <div className="text-[#555]">Reading package lists... Done</div>
        <div><span className="text-[#fbbf24]">Building dependency tree... Done</span></div>
        <div><span className="text-[#555]">All packages are up to date.</span></div>
      </div>
    );
  }

  /* apt upgrade */
  if (line.type === 'apt-upgrade') {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#555]">Reading package lists... Done</div>
        <div className="text-[#555]">Building dependency tree... Done</div>
        <div className="text-[#555]">Calculating upgrade... Done</div>
        <div><span className="text-[#fbbf24]">3 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.</span></div>
        <div className="text-[#555]">Need to get 1,204 kB of archives.</div>
        <div className="text-[#4ade80]">Fetched 1,204 kB in 0s</div>
        <div className="text-[#555]">Setting up curl (7.88.1-8ubuntu3) ...</div>
        <div className="text-[#555]">Setting up wget (1.21.3-1ubuntu2) ...</div>
        <div className="text-[#555]">Setting up openssh-server (1:9.3p1-1ubuntu4) ...</div>
        <div className="text-[#4ade80]">✓ System upgraded successfully.</div>
      </div>
    );
  }

  /* dpkg -l table */
  if (line.type === 'dpkg-list') {
    return (
      <div className="font-mono text-[11px] leading-[1.65]">
        <div className="text-[#3f3f3f]">Desired=Unknown/Install/Remove/Purge/Hold</div>
        <div className="text-[#3f3f3f]">| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend</div>
        <div className="text-[#3f3f3f]">|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)</div>
        <div className="text-[#3f3f3f] border-b border-[#1c1c1c] pb-1 mb-1">||/ Name           Version                Description</div>
        {line.packages.map((p) => (
          <div key={p.name} className="flex gap-2">
            <span className="text-[#4ade80] min-w-[24px]">ii</span>
            <span className="text-[#d4d4d4] min-w-[160px] truncate">{p.name}</span>
            <span className="text-[#555] min-w-[140px] truncate">{p.version}</span>
            <span className="text-[#3f3f3f] truncate">{p.desc}</span>
          </div>
        ))}
      </div>
    );
  }

  /* dpkg -L files list */
  if (line.type === 'dpkg-files') {
    return (
      <div className="font-mono text-[12px] leading-[1.65]">
        {line.files.map((f, i) => (
          <div key={i} className="text-[#a78bfa]">{f}</div>
        ))}
      </div>
    );
  }

  /* apt-cache depends */
  if (line.type === 'apt-cache-depends') {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#4ade80] font-bold">{line.name}</div>
        {line.deps.map((d, i) => (
          <div key={i} className="pl-4">
            <span className="text-[#555]">Depends: </span>
            <span className="text-[#a78bfa]">{d}</span>
          </div>
        ))}
        {line.recommends?.map((r, i) => (
          <div key={'r' + i} className="pl-4">
            <span className="text-[#3f3f3f]">Recommends: </span>
            <span className="text-[#555]">{r}</span>
          </div>
        ))}
      </div>
    );
  }

  /* apt-cache policy */
  if (line.type === 'apt-cache-policy') {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#4ade80] font-bold">{line.name}:</div>
        <div><span className="text-[#555]">  Installed: </span><span className="text-[#fbbf24]">{line.installed || '(none)'}</span></div>
        <div><span className="text-[#555]">  Candidate: </span><span className="text-[#4ade80]">{line.candidate}</span></div>
        <div className="text-[#555]">  Version table:</div>
        <div><span className="text-[#4ade80] pl-4"> *** </span><span className="text-[#d4d4d4]">{line.candidate}</span><span className="text-[#555]"> 500</span></div>
        <div className="text-[#3f3f3f] pl-12">500 http://archive.ubuntu.com/ubuntu jammy/universe amd64 Packages</div>
        {line.installed && line.installed !== line.candidate && (
          <>
            <div><span className="text-[#555] pl-8">{line.installed}</span><span className="text-[#555]"> 100</span></div>
            <div className="text-[#3f3f3f] pl-12">100 /var/lib/dpkg/status</div>
          </>
        )}
      </div>
    );
  }

  /* snap list */
  if (line.type === 'snap-list') {
    return (
      <div className="font-mono text-[12px] leading-[1.65]">
        <div className="flex gap-4 text-[#555] border-b border-[#1c1c1c] pb-0.5 mb-1">
          <span className="min-w-[120px]">Name</span>
          <span className="min-w-[80px]">Version</span>
          <span className="min-w-[80px]">Rev</span>
          <span className="min-w-[100px]">Tracking</span>
          <span>Publisher</span>
        </div>
        {line.snaps.map((s) => (
          <div key={s.name} className="flex gap-4">
            <span className="text-[#4ade80] min-w-[120px]">{s.name}</span>
            <span className="text-[#fbbf24] min-w-[80px]">{s.version}</span>
            <span className="text-[#555] min-w-[80px]">{Math.floor(Math.random() * 4000) + 1000}</span>
            <span className="text-[#60a5fa] min-w-[100px]">{s.channel}</span>
            <span className="text-[#a78bfa]">{s.publisher}</span>
          </div>
        ))}
      </div>
    );
  }

  /* snap find */
  if (line.type === 'snap-find') {
    return (
      <div className="font-mono text-[12px] leading-[1.65]">
        <div className="flex gap-4 text-[#555] border-b border-[#1c1c1c] pb-0.5 mb-1">
          <span className="min-w-[120px]">Name</span>
          <span className="min-w-[80px]">Version</span>
          <span className="min-w-[100px]">Publisher</span>
          <span>Summary</span>
        </div>
        {line.results.map((s) => (
          <div key={s.name} className="flex gap-4">
            <span className="text-[#4ade80] min-w-[120px]">{s.name}</span>
            <span className="text-[#555] min-w-[80px]">{s.version}</span>
            <span className="text-[#a78bfa] min-w-[100px]">{s.publisher}</span>
            <span className="text-[#aaa] truncate">{s.desc}</span>
          </div>
        ))}
      </div>
    );
  }

  /* snap info */
  if (line.type === 'snap-info') {
    const s = line.snap;
    return (
      <div className="font-mono text-[12px] leading-[1.8]">
        <div><span className="text-[#555]">name: </span><span className="text-[#4ade80] font-bold">{line.name}</span></div>
        <div><span className="text-[#555]">summary: </span><span className="text-[#d4d4d4]">{s.desc}</span></div>
        <div><span className="text-[#555]">publisher: </span><span className="text-[#a78bfa]">{s.publisher}</span></div>
        <div><span className="text-[#555]">store-url: </span><span className="text-[#60a5fa]">https://snapcraft.io/{line.name}</span></div>
        <div><span className="text-[#555]">license: </span><span className="text-[#aaa]">unset</span></div>
        <div><span className="text-[#555]">description: </span><span className="text-[#aaa]">{s.desc}</span></div>
        <div><span className="text-[#555]">size: </span><span className="text-[#fbbf24]">{s.size}</span></div>
        <div><span className="text-[#555]">channels:</span></div>
        <div className="pl-4"><span className="text-[#555]">latest/stable: </span><span className="text-[#4ade80]">{s.version}</span></div>
      </div>
    );
  }

  /* dnf / yum list */
  if (line.type === 'dnf-list') {
    return (
      <div className="font-mono text-[12px] leading-[1.65]">
        <div className="text-[#555] border-b border-[#1c1c1c] pb-0.5 mb-1">Installed Packages</div>
        {line.packages.map((p) => (
          <div key={p.name} className="flex gap-2">
            <span className="text-[#4ade80] min-w-[200px]">{p.name}.{p.arch}</span>
            <span className="text-[#555] min-w-[160px]">{p.version}</span>
            <span className="text-[#3f3f3f]">@{p.repo}</span>
          </div>
        ))}
      </div>
    );
  }

  /* dnf info */
  if (line.type === 'dnf-info') {
    const p = line.pkg;
    return (
      <div className="font-mono text-[12px] leading-[1.8]">
        <div className="text-[#555]">Installed Packages</div>
        <div><span className="text-[#555]">Name         : </span><span className="text-[#4ade80] font-bold">{line.name}</span></div>
        <div><span className="text-[#555]">Version      : </span><span className="text-[#fbbf24]">{p.version}</span></div>
        <div><span className="text-[#555]">Architecture : </span><span className="text-[#aaa]">{p.arch}</span></div>
        <div><span className="text-[#555]">Size         : </span><span className="text-[#aaa]">{p.size}</span></div>
        <div><span className="text-[#555]">Source       : </span><span className="text-[#aaa]">{line.name}-{p.version}.src.rpm</span></div>
        <div><span className="text-[#555]">Repository   : </span><span className="text-[#60a5fa]">{p.repo}</span></div>
        <div><span className="text-[#555]">Summary      : </span><span className="text-[#d4d4d4]">{p.desc}</span></div>
        <div><span className="text-[#555]">URL          : </span><span className="text-[#60a5fa]">https://packages.fedoraproject.org/{line.name}</span></div>
        <div><span className="text-[#555]">License      : </span><span className="text-[#aaa]">GPLv2+</span></div>
      </div>
    );
  }

  /* rpm -qa list */
  if (line.type === 'rpm-list') {
    return (
      <div className="font-mono text-[12px] leading-[1.65]">
        {line.packages.map((p) => (
          <div key={p.name} className="text-[#a78bfa]">{p.name}-{p.version}.{p.arch}</div>
        ))}
      </div>
    );
  }

  /* rpm -qi info */
  if (line.type === 'rpm-info') {
    const p = line.pkg;
    return (
      <div className="font-mono text-[12px] leading-[1.8]">
        <div><span className="text-[#555]">Name        : </span><span className="text-[#4ade80] font-bold">{line.name}</span></div>
        <div><span className="text-[#555]">Version     : </span><span className="text-[#fbbf24]">{p.version}</span></div>
        <div><span className="text-[#555]">Architecture: </span><span className="text-[#aaa]">{p.arch}</span></div>
        <div><span className="text-[#555]">Size        : </span><span className="text-[#aaa]">{p.size}</span></div>
        <div><span className="text-[#555]">Repository  : </span><span className="text-[#60a5fa]">{p.repo}</span></div>
        <div><span className="text-[#555]">Summary     : </span><span className="text-[#d4d4d4]">{p.desc}</span></div>
        <div><span className="text-[#555]">Build Date  : </span><span className="text-[#aaa]">Thu 14 Dec 2023 09:00:00 UTC</span></div>
        <div><span className="text-[#555]">Install Date: </span><span className="text-[#aaa]">Mon 15 Jan 2024 10:22:00 UTC</span></div>
        <div><span className="text-[#555]">License     : </span><span className="text-[#aaa]">GPLv2+</span></div>
      </div>
    );
  }

  /* pacman */
  if (line.type === 'pacman-out') {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        {line.lines.map((l, i) => (
          <div key={i} className={l.bold ? 'text-[#4ade80] font-bold' : 'text-[#555]'}>{l.text}</div>
        ))}
      </div>
    );
  }

  /* autoremove */
  if (line.type === 'apt-autoremove') {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#555]">Reading package lists... Done</div>
        <div className="text-[#555]">Building dependency tree... Done</div>
        <div className="text-[#4ade80]">0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.</div>
        <div className="text-[#3f3f3f]">No packages were automatically installed and are no longer required.</div>
      </div>
    );
  }

  return (
    <div className={`font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all ${cls}`}>
      {line.text}
    </div>
  );
}

/* ── tiny FS for ls/cd ── */
const MINI_FS = {
  home: { user: { documents: {}, logs: {}, projects: {} } },
  etc: { 'apt': {}, 'yum.repos.d': {} },
  var: { cache: { apt: { archives: {} } }, lib: { dpkg: { info: {} } } },
};
function getNode(path) {
  if (path === '/') return MINI_FS;
  const parts = path.split('/').filter(Boolean);
  let node = MINI_FS;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return null;
  }
  return node;
}
function resolvePath(input, cwd) {
  if (!input || input === '~') return '/home/user';
  if (input.startsWith('~/')) return normalizePath('/home/user/' + input.slice(2));
  if (input.startsWith('/')) return normalizePath(input);
  return normalizePath(cwd + '/' + input);
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
function cwdDisplay(cwd) {
  if (cwd === '/home/user') return '~';
  if (cwd.startsWith('/home/user/')) return '~/' + cwd.slice('/home/user/'.length);
  return cwd;
}

/* ── Main component ── */
export default function Level10Page() {
  const [cwd, setCwd]               = useState('/home/user');
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

  /* mutable installed/removed state */
  const installedRef = useRef(new Set(Object.keys(PKG_DB.installed)));
  const removedRef   = useRef(new Set());
  const snapInstalledRef = useRef(new Set(Object.keys(PKG_DB.snaps)));

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
      { id: 1, type: 'text', color: 'dim',    text: "Type 'help' to see commands." },
      { id: 2, type: 'text', color: 'dim',    text: '' },
      { id: 3, type: 'text', color: 'green',  text: 'Welcome to Level 10 — Package Management' },
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
              addLines([{ type: 'text', color: 'green', text: '✓ All objectives complete! Level 10 passed.' }]);
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

    const isSudo = /^sudo\s+/.test(trimmed);
    const cmdBody = isSudo ? trimmed.replace(/^sudo\s+/, '') : trimmed;

    const promptLine = { type: 'prompt', path: cwdDisplay(currentCwd), cmd: trimmed, isSudo };
    const parts   = cmdBody.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd     = parts[0];
    const rawArgs = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ''));
    const flags   = rawArgs.filter(a => a.startsWith('-'));
    const args    = rawArgs.filter(a => !a.startsWith('-'));

    let responseLines = [];

    /* ── cd (kept) ── */
    if (cmd === 'cd') {
      const target = rawArgs[0] || '~';
      const resolved = resolvePath(target, currentCwd);
      const node = getNode(resolved);
      if (!node) responseLines = [{ type: 'text', color: 'red', text: `bash: cd: ${target}: No such file or directory` }];
      else { setCwd(resolved); cwdRef.current = resolved; }
      addLines([promptLine, ...responseLines, { type: 'text', color: 'dim', text: '' }]);
      checkObjective(newAllHistory);
      return;
    }

    /* ── ls (kept) ── */
    if (cmd === 'ls') {
      const target = args[0] ? resolvePath(args[0], currentCwd) : currentCwd;
      const node = getNode(target);
      if (!node || typeof node === 'string') {
        responseLines = [{ type: 'text', color: 'red', text: `ls: cannot access '${args[0] || '.'}': No such file or directory` }];
      } else {
        const entries = Object.keys(node);
        responseLines = [{ type: 'ls-grid', entries: entries.map(e => ({ name: e, isDir: typeof node[e] === 'object' })) }];
      }
      addLines([promptLine, ...responseLines, { type: 'text', color: 'dim', text: '' }]);
      checkObjective(newAllHistory);
      return;
    }

    /* ── apt ── */
    if (cmd === 'apt' || cmd === 'apt-get') {
      const sub = args[0] || rawArgs[0];

      if (sub === 'update') {
        responseLines = [{ type: 'apt-update' }];
      }

      else if (sub === 'upgrade') {
        responseLines = [{ type: 'apt-upgrade' }];
      }

      else if (sub === 'autoremove') {
        responseLines = [{ type: 'apt-autoremove' }];
      }

      else if (sub === 'list') {
        const installedOnly = rawArgs.includes('--installed');
        const all = { ...PKG_DB.installed, ...PKG_DB.available };
        const entries = installedOnly
          ? Object.entries(PKG_DB.installed)
          : Object.entries(all);
        if (installedOnly) {
          responseLines = [
            { type: 'text', color: 'dim', text: 'Listing...' },
            ...entries.map(([name, pkg]) => ({ type: 'apt-list-row', name, version: pkg.version, installed: installedRef.current.has(name) && !removedRef.current.has(name) })),
          ];
        } else {
          responseLines = [
            { type: 'text', color: 'dim', text: 'Listing... Done' },
            ...entries.map(([name, pkg]) => ({ type: 'apt-list-row', name, version: pkg.version, installed: installedRef.current.has(name) && !removedRef.current.has(name) })),
          ];
        }
      }

      else if (sub === 'search') {
        const term = args[1] || args[0];
        if (!term || term === 'search') {
          responseLines = [{ type: 'text', color: 'red', text: 'apt search: need a search term' }];
        } else {
          const all = { ...PKG_DB.installed, ...PKG_DB.available };
          const hits = Object.entries(all).filter(([n, p]) =>
            n.includes(term.toLowerCase()) || p.desc.toLowerCase().includes(term.toLowerCase())
          );
          if (!hits.length) {
            responseLines = [{ type: 'text', color: 'dim', text: `No packages found matching '${term}'` }];
          } else {
            responseLines = [
              { type: 'text', color: 'dim', text: 'Sorting...' },
              { type: 'text', color: 'dim', text: 'Full Text Search...' },
              ...hits.map(([name, pkg]) => ({ type: 'apt-list-row', name, version: pkg.version, installed: installedRef.current.has(name) && !removedRef.current.has(name) })),
            ];
          }
        }
      }

      else if (sub === 'show') {
        const pkgName = args[1] || args[0];
        if (!pkgName || pkgName === 'show') {
          responseLines = [{ type: 'text', color: 'red', text: 'apt show: need a package name' }];
        } else {
          const all = { ...PKG_DB.installed, ...PKG_DB.available };
          const pkg = all[pkgName];
          if (!pkg) {
            responseLines = [{ type: 'text', color: 'red', text: `N: Unable to locate package ${pkgName}` }];
          } else {
            responseLines = [{ type: 'pkg-detail', name: pkgName, pkg }];
          }
        }
      }

      else if (sub === 'install') {
        const pkgName = args[1] || args[0];
        if (!pkgName || pkgName === 'install') {
          responseLines = [{ type: 'text', color: 'red', text: 'apt install: need a package name' }];
        } else {
          const all = { ...PKG_DB.installed, ...PKG_DB.available };
          const pkg = all[pkgName];
          if (!pkg) {
            responseLines = [{ type: 'text', color: 'red', text: `E: Unable to locate package ${pkgName}` }];
          } else {
            const isNew = !installedRef.current.has(pkgName) || removedRef.current.has(pkgName);
            if (isNew) { installedRef.current.add(pkgName); removedRef.current.delete(pkgName); }
            responseLines = [{ type: 'apt-install', pkgName, pkg, isNew }];
          }
        }
      }

      else if (sub === 'remove' || sub === 'purge') {
        const pkgName = args[1] || args[0];
        if (!pkgName || pkgName === sub) {
          responseLines = [{ type: 'text', color: 'red', text: `apt ${sub}: need a package name` }];
        } else {
          const all = { ...PKG_DB.installed, ...PKG_DB.available };
          if (!all[pkgName]) {
            responseLines = [{ type: 'text', color: 'red', text: `E: Unable to locate package ${pkgName}` }];
          } else if (!installedRef.current.has(pkgName) || removedRef.current.has(pkgName)) {
            responseLines = [{ type: 'text', color: 'yellow', text: `${pkgName}: Package is not installed, so not removed.` }];
          } else {
            removedRef.current.add(pkgName);
            responseLines = [{ type: 'apt-remove', pkgName, purge: sub === 'purge' }];
          }
        }
      }

      else {
        responseLines = [{ type: 'text', color: 'red', text: `${cmd}: invalid operation: ${sub || '(none)'}` }];
      }
    }

    /* ── apt-cache ── */
    else if (cmd === 'apt-cache') {
      const sub = args[0] || rawArgs[0];

      if (sub === 'show') {
        const pkgName = args[1] || args[0];
        if (!pkgName || pkgName === 'show') {
          responseLines = [{ type: 'text', color: 'red', text: 'apt-cache show: need a package name' }];
        } else {
          const all = { ...PKG_DB.installed, ...PKG_DB.available };
          const pkg = all[pkgName];
          if (!pkg) {
            responseLines = [{ type: 'text', color: 'red', text: `N: Unable to locate package ${pkgName}` }];
          } else {
            responseLines = [{ type: 'pkg-detail', name: pkgName, pkg }];
          }
        }
      }

      else if (sub === 'depends' || sub === 'rdepends') {
        const pkgName = args[1] || args[0];
        if (!pkgName || pkgName === sub) {
          responseLines = [{ type: 'text', color: 'red', text: `apt-cache ${sub}: need a package name` }];
        } else {
          const all = { ...PKG_DB.installed, ...PKG_DB.available };
          const pkg = all[pkgName];
          if (!pkg) {
            responseLines = [{ type: 'text', color: 'red', text: `N: Unable to locate package ${pkgName}` }];
          } else {
            if (sub === 'depends') {
              responseLines = [{ type: 'apt-cache-depends', name: pkgName, deps: pkg.deps || ['(no dependencies)'], recommends: ['man-db'] }];
            } else {
              const rdeps = Object.entries({ ...PKG_DB.installed, ...PKG_DB.available })
                .filter(([, p]) => p.deps?.includes(pkgName))
                .map(([n]) => n);
              responseLines = [{ type: 'apt-cache-depends', name: pkgName, deps: rdeps.length ? rdeps : ['(nothing depends on this)'] }];
            }
          }
        }
      }

      else if (sub === 'policy') {
        const pkgName = args[1] || args[0];
        if (!pkgName || pkgName === 'policy') {
          responseLines = [{ type: 'text', color: 'red', text: 'apt-cache policy: need a package name' }];
        } else {
          const all = { ...PKG_DB.installed, ...PKG_DB.available };
          const pkg = all[pkgName];
          if (!pkg) {
            responseLines = [{ type: 'text', color: 'red', text: `N: Unable to locate package ${pkgName}` }];
          } else {
            responseLines = [{
              type: 'apt-cache-policy',
              name: pkgName,
              installed: installedRef.current.has(pkgName) && !removedRef.current.has(pkgName) ? pkg.version : null,
              candidate: pkg.version,
            }];
          }
        }
      }

      else if (sub === 'stats') {
        responseLines = [
          { type: 'text', color: 'cyan',  text: 'Total package names: 86,742' },
          { type: 'text', color: 'white', text: 'Total package structures: 86,742' },
          { type: 'text', color: 'white', text: '  Normal packages: 68,103' },
          { type: 'text', color: 'white', text: '  Virtual packages: 12,482' },
          { type: 'text', color: 'white', text: '  Single virtual packages: 7,504' },
          { type: 'text', color: 'white', text: 'Total distinct versions: 91,240' },
          { type: 'text', color: 'white', text: 'Total dependencies: 512,341' },
        ];
      }

      else if (sub === 'pkgnames') {
        const prefix = args[1] || '';
        const all = { ...PKG_DB.installed, ...PKG_DB.available };
        const names = Object.keys(all).filter(n => n.startsWith(prefix));
        responseLines = names.map(n => ({ type: 'text', color: 'white', text: n }));
      }

      else if (sub === 'search') {
        const term = args[1] || args[0];
        const all = { ...PKG_DB.installed, ...PKG_DB.available };
        const hits = Object.entries(all).filter(([n, p]) => n.includes(term || '') || p.desc.toLowerCase().includes((term || '').toLowerCase()));
        responseLines = hits.map(([name, pkg]) => ({ type: 'apt-list-row', name, version: pkg.version, installed: installedRef.current.has(name) }));
      }

      else {
        responseLines = [{ type: 'text', color: 'red', text: `apt-cache: invalid operation ${sub || '(none)'}` }];
      }
    }

    /* ── dpkg ── */
    else if (cmd === 'dpkg') {
      const flag = flags[0];

      if (flag === '-l' || flag === '--list') {
        const pattern = args[0];
        const pkgs = Object.entries(PKG_DB.installed)
          .filter(([n]) => !removedRef.current.has(n))
          .filter(([n]) => !pattern || n.includes(pattern));
        responseLines = [{ type: 'dpkg-list', packages: pkgs.map(([name, pkg]) => ({ name, version: pkg.version, desc: pkg.desc })) }];
      }

      else if (flag === '-s' || flag === '--status') {
        const pkgName = args[0];
        if (!pkgName) { responseLines = [{ type: 'text', color: 'red', text: 'dpkg: -s needs a package name' }]; }
        else {
          const pkg = PKG_DB.installed[pkgName];
          if (!pkg) { responseLines = [{ type: 'text', color: 'red', text: `dpkg-query: package '${pkgName}' is not installed and no information is available` }]; }
          else {
            responseLines = [{ type: 'pkg-detail', name: pkgName, pkg: { ...pkg, status: removedRef.current.has(pkgName) ? 'deinstall ok config-files' : 'install ok installed' } }];
          }
        }
      }

      else if (flag === '-L' || flag === '--listfiles') {
        const pkgName = args[0];
        if (!pkgName) { responseLines = [{ type: 'text', color: 'red', text: 'dpkg: -L needs a package name' }]; }
        else if (!PKG_DB.installed[pkgName]) { responseLines = [{ type: 'text', color: 'red', text: `dpkg-query: package '${pkgName}' is not installed` }]; }
        else {
          const files = [
            `/usr/bin/${pkgName}`,
            `/usr/share/doc/${pkgName}/changelog.gz`,
            `/usr/share/doc/${pkgName}/copyright`,
            `/usr/share/man/man1/${pkgName}.1.gz`,
            `/etc/${pkgName}/${pkgName}.conf`,
          ];
          responseLines = [{ type: 'dpkg-files', files }];
        }
      }

      else if (flag === '-S' || flag === '--search') {
        const query = args[0];
        if (!query) { responseLines = [{ type: 'text', color: 'red', text: 'dpkg: -S needs a path pattern' }]; }
        else {
          const match = Object.keys(PKG_DB.installed).find(n => query.includes(n) || n.includes(query.split('/').pop()));
          if (match) {
            responseLines = [{ type: 'text', color: 'green', text: `${match}: ${query}` }];
          } else {
            responseLines = [{ type: 'text', color: 'red', text: `dpkg-query: no path found matching pattern ${query}` }];
          }
        }
      }

      else if (flag === '-i' || flag === '--install') {
        responseLines = [{ type: 'text', color: 'yellow', text: 'dpkg: installing from .deb file (use apt install for repositories)' }];
      }

      else if (flag === '-r' || flag === '--remove') {
        const pkgName = args[0];
        responseLines = pkgName
          ? [{ type: 'apt-remove', pkgName, purge: false }]
          : [{ type: 'text', color: 'red', text: 'dpkg: -r needs a package name' }];
      }

      else {
        responseLines = [{ type: 'text', color: 'red', text: `dpkg: error processing package (${flags.join(' ') || 'no flag given'})` }];
      }
    }

    /* ── snap ── */
    else if (cmd === 'snap' || cmd === 'snapctl') {
      const sub = args[0] || rawArgs[0];

      if (!sub || sub === 'list') {
        const snaps = Object.entries(PKG_DB.snaps)
          .filter(([n]) => snapInstalledRef.current.has(n))
          .map(([name, s]) => ({ name, ...s }));
        responseLines = [{ type: 'snap-list', snaps }];
      }

      else if (sub === 'find') {
        const term = args[1] || args[0];
        if (!term || term === 'find') {
          responseLines = [{ type: 'text', color: 'red', text: 'snap find: need a search term' }];
        } else {
          const all = { ...PKG_DB.snaps, ...PKG_DB.availableSnaps };
          const hits = Object.entries(all)
            .filter(([n, s]) => n.includes(term.toLowerCase()) || s.desc.toLowerCase().includes(term.toLowerCase()))
            .map(([name, s]) => ({ name, ...s }));
          responseLines = hits.length
            ? [{ type: 'snap-find', results: hits }]
            : [{ type: 'text', color: 'dim', text: `No snap found for '${term}'` }];
        }
      }

      else if (sub === 'info') {
        const snapName = args[1] || args[0];
        if (!snapName || snapName === 'info') {
          responseLines = [{ type: 'text', color: 'red', text: 'snap info: need a snap name' }];
        } else {
          const all = { ...PKG_DB.snaps, ...PKG_DB.availableSnaps };
          const snap = all[snapName];
          if (!snap) { responseLines = [{ type: 'text', color: 'red', text: `error: snap "${snapName}" not found` }]; }
          else { responseLines = [{ type: 'snap-info', name: snapName, snap }]; }
        }
      }

      else if (sub === 'install') {
        const snapName = args[1] || args[0];
        if (!snapName || snapName === 'install') {
          responseLines = [{ type: 'text', color: 'red', text: 'snap install: need a snap name' }];
        } else {
          const all = { ...PKG_DB.snaps, ...PKG_DB.availableSnaps };
          const snap = all[snapName];
          if (!snap) { responseLines = [{ type: 'text', color: 'red', text: `error: snap "${snapName}" not found in store` }]; }
          else {
            snapInstalledRef.current.add(snapName);
            responseLines = [
              { type: 'text', color: 'dim', text: `${snapName} ${snap.version} from ${snap.publisher} installed` },
            ];
          }
        }
      }

      else if (sub === 'remove') {
        const snapName = args[1] || args[0];
        if (!snapName || snapName === 'remove') {
          responseLines = [{ type: 'text', color: 'red', text: 'snap remove: need a snap name' }];
        } else {
          snapInstalledRef.current.delete(snapName);
          responseLines = [{ type: 'text', color: 'dim', text: `${snapName} removed` }];
        }
      }

      else if (sub === 'refresh') {
        const snapName = args[1];
        if (snapName) {
          responseLines = [{ type: 'text', color: 'green', text: `${snapName} (${PKG_DB.snaps[snapName]?.version || 'latest'}) refreshed` }];
        } else {
          responseLines = [
            { type: 'text', color: 'dim', text: 'All snaps up to date.' },
          ];
        }
      }

      else {
        responseLines = [{ type: 'text', color: 'red', text: `snap: unsupported subcommand: ${sub}` }];
      }
    }

    /* ── dnf / yum ── */
    else if (cmd === 'dnf' || cmd === 'yum') {
      const sub = args[0] || rawArgs[0];

      if (sub === 'list') {
        const pkgs = Object.entries(PKG_DB.rpm).map(([name, pkg]) => ({ name, ...pkg }));
        responseLines = [{ type: 'dnf-list', packages: pkgs }];
      }

      else if (sub === 'search') {
        const term = args[1] || args[0];
        if (!term || term === 'search') {
          responseLines = [{ type: 'text', color: 'red', text: `${cmd} search: need a search term` }];
        } else {
          const hits = Object.entries(PKG_DB.rpm)
            .filter(([n, p]) => n.includes(term) || p.desc.toLowerCase().includes(term.toLowerCase()));
          if (!hits.length) {
            /* also look in apt for cross-distro learning */
            const aptHits = Object.entries({ ...PKG_DB.installed, ...PKG_DB.available })
              .filter(([n, p]) => n.includes(term) || p.desc.toLowerCase().includes(term.toLowerCase()))
              .slice(0, 3);
            responseLines = aptHits.length
              ? [
                  { type: 'text', color: 'yellow', text: `(No exact RPM match; showing similar packages)` },
                  ...aptHits.map(([name, pkg]) => ({ type: 'apt-list-row', name, version: pkg.version, installed: false })),
                ]
              : [{ type: 'text', color: 'dim', text: `No matches found for '${term}'` }];
          } else {
            responseLines = [
              { type: 'text', color: 'dim', text: `================ Name Exactly Matched: ${term} ================` },
              ...hits.map(([name, pkg]) => ({ type: 'apt-list-row', name, version: pkg.version, installed: true })),
            ];
          }
        }
      }

      else if (sub === 'info') {
        const pkgName = args[1] || args[0];
        if (!pkgName || pkgName === 'info') {
          responseLines = [{ type: 'text', color: 'red', text: `${cmd} info: need a package name` }];
        } else {
          const pkg = PKG_DB.rpm[pkgName];
          if (!pkg) { responseLines = [{ type: 'text', color: 'red', text: `Error: No matching Packages to list` }]; }
          else { responseLines = [{ type: 'dnf-info', name: pkgName, pkg }]; }
        }
      }

      else if (sub === 'install') {
        const pkgName = args[1] || args[0];
        if (!pkgName || pkgName === 'install') {
          responseLines = [{ type: 'text', color: 'red', text: `${cmd} install: need a package name` }];
        } else {
          responseLines = [
            { type: 'text', color: 'dim',   text: `Last metadata expiration check: 0:01:24 ago.` },
            { type: 'text', color: 'white',  text: `Dependencies resolved.` },
            { type: 'text', color: 'dim',   text: `================================================================================` },
            { type: 'text', color: 'white',  text: ` Package         Arch    Version            Repository      Size` },
            { type: 'text', color: 'dim',   text: `================================================================================` },
            { type: 'text', color: 'white',  text: `Installing:` },
            { type: 'text', color: 'green',  text: ` ${pkgName.padEnd(16)}x86_64  latest             appstream       -` },
            { type: 'text', color: 'white',  text: `Transaction Summary` },
            { type: 'text', color: 'white',  text: `Install  1 Package` },
            { type: 'text', color: 'green',  text: `Complete!` },
          ];
        }
      }

      else if (sub === 'remove') {
        const pkgName = args[1] || args[0];
        responseLines = pkgName
          ? [{ type: 'apt-remove', pkgName, purge: false }]
          : [{ type: 'text', color: 'red', text: `${cmd} remove: need a package name` }];
      }

      else if (sub === 'update' || sub === 'upgrade' || sub === 'check-update') {
        responseLines = [{ type: 'text', color: 'green', text: 'Last metadata expiration check: 0:01:24 ago.\nNo upgrades available.' }];
      }

      else if (sub === 'history') {
        responseLines = [
          { type: 'text', color: 'dim',   text: 'ID     | Command line              | Date and time     | Action(s)' },
          { type: 'text', color: 'dim',   text: '-------+---------------------------+-------------------+-----------' },
          { type: 'text', color: 'white', text: '     3 | install git               | 2024-09-15 10:01  | Install' },
          { type: 'text', color: 'white', text: '     2 | install curl              | 2024-09-10 08:44  | Install' },
          { type: 'text', color: 'white', text: '     1 | update                    | 2024-09-01 12:00  | Update' },
        ];
      }

      else if (sub === 'provides') {
        const what = args[1] || args[0];
        responseLines = what
          ? [{ type: 'text', color: 'cyan', text: `bash-5.1.8-6.el9.x86_64 : The GNU Bourne Again shell\nRepo : baseos\nMatched from: File : /bin/bash` }]
          : [{ type: 'text', color: 'red',  text: `${cmd} provides: need a file or capability` }];
      }

      else {
        responseLines = [{ type: 'text', color: 'red', text: `${cmd}: unknown command: ${sub || '(none)'}` }];
      }
    }

    /* ── rpm ── */
    else if (cmd === 'rpm') {
      const flag = flags.join('');
      const pkgName = args[0];

      if (flag.includes('qa') || flag === '-qa') {
        responseLines = [{ type: 'rpm-list', packages: Object.entries(PKG_DB.rpm).map(([name, pkg]) => ({ name, ...pkg })) }];
      }

      else if (flag.includes('qi') || flag.includes('i')) {
        if (!pkgName) { responseLines = [{ type: 'text', color: 'red', text: 'rpm: need a package name' }]; }
        else {
          const pkg = PKG_DB.rpm[pkgName];
          if (!pkg) { responseLines = [{ type: 'text', color: 'red', text: `package ${pkgName} is not installed` }]; }
          else { responseLines = [{ type: 'rpm-info', name: pkgName, pkg }]; }
        }
      }

      else if (flag.includes('ql') || flag.includes('l')) {
        if (!pkgName) { responseLines = [{ type: 'text', color: 'red', text: 'rpm: need a package name' }]; }
        else {
          const pkg = PKG_DB.rpm[pkgName];
          if (!pkg) { responseLines = [{ type: 'text', color: 'red', text: `package ${pkgName} is not installed` }]; }
          else {
            responseLines = [{ type: 'dpkg-files', files: [
              `/usr/bin/${pkgName}`,
              `/usr/share/doc/${pkgName}/COPYING`,
              `/usr/share/man/man1/${pkgName}.1.gz`,
              `/etc/${pkgName}rc`,
            ]}];
          }
        }
      }

      else if (flag.includes('qf') || flag.includes('S')) {
        const query = args[0];
        responseLines = query
          ? [{ type: 'text', color: 'green', text: `bash-5.1.8-6.el9.x86_64` }]
          : [{ type: 'text', color: 'red', text: 'rpm: need a file path' }];
      }

      else if (flag.includes('e') || flag.includes('U') || flag.includes('V')) {
        responseLines = [{ type: 'text', color: 'yellow', text: `rpm ${flag}: operation simulated (sandbox)` }];
      }

      else {
        responseLines = [{ type: 'text', color: 'red', text: `rpm: bad option: ${flags.join(' ') || '(none)'}` }];
      }
    }

    /* ── pacman ── */
    else if (cmd === 'pacman') {
      const sub = rawArgs[0];
      if (sub === '-Ss' || sub === '--search') {
        const term = args[0];
        responseLines = [{ type: 'pacman-out', lines: [
          { text: `community/${term || 'package'} 1.0.0-1`, bold: true },
          { text: `    A package matching '${term || ''}'` },
          { text: `extra/${term || 'package'}-dev 1.0.0-1`, bold: true },
          { text: `    Development files for ${term || ''}` },
        ]}];
      } else if (sub === '-S' || sub === '--sync') {
        const pkgName = args[0];
        responseLines = pkgName
          ? [
              { type: 'text', color: 'dim',   text: 'resolving dependencies...' },
              { type: 'text', color: 'dim',   text: 'looking for conflicting packages...' },
              { type: 'text', color: 'green', text: `Packages (1) ${pkgName}-latest` },
              { type: 'text', color: 'green', text: `:: Proceed with installation? [Y/n] Y` },
              { type: 'text', color: 'dim',   text: `:: Installing ${pkgName}...` },
              { type: 'text', color: 'green', text: ':: Package installed successfully.' },
            ]
          : [{ type: 'text', color: 'red', text: 'pacman -S: need a package name' }];
      } else if (sub === '-Q' || sub === '--query') {
        responseLines = [{ type: 'pacman-out', lines: Object.entries(PKG_DB.installed).map(([n, p]) => ({ text: `${n} ${p.version}` })) }];
      } else if (sub === '-R' || sub === '--remove') {
        const pkgName = args[0];
        responseLines = pkgName
          ? [{ type: 'text', color: 'dim', text: `removing ${pkgName}...` }, { type: 'text', color: 'green', text: 'done.' }]
          : [{ type: 'text', color: 'red', text: 'pacman -R: need a package name' }];
      } else if (sub === '-Syu' || sub === '-Syyu') {
        responseLines = [
          { type: 'text', color: 'dim', text: ':: Synchronizing package databases...' },
          { type: 'text', color: 'dim', text: ' core downloading...' },
          { type: 'text', color: 'dim', text: ' extra downloading...' },
          { type: 'text', color: 'green', text: ' there is nothing to do' },
        ];
      } else {
        responseLines = [{ type: 'text', color: 'red', text: `pacman: invalid option '${sub || ''}'` }];
      }
    }

    /* ── pwd ── */
    else if (cmd === 'pwd') {
      responseLines = [{ type: 'text', color: 'cyan', text: currentCwd }];
    }

    /* ── clear ── */
    else if (cmd === 'clear') {
      setOutput([]);
      return;
    }

    /* ── help ── */
    else if (cmd === 'help') {
      responseLines = [
        { type: 'text', color: 'green',  text: 'Level 10 — Package Management commands:' },
        { type: 'text', color: 'dim',    text: '' },
        { type: 'text', color: 'cyan',   text: '  — APT (Debian/Ubuntu) —' },
        { type: 'text', color: 'white',  text: '  apt list --installed        list installed packages' },
        { type: 'text', color: 'white',  text: '  apt search <term>           search packages' },
        { type: 'text', color: 'white',  text: '  apt show <pkg>              package metadata' },
        { type: 'text', color: 'white',  text: '  apt install <pkg>           install package' },
        { type: 'text', color: 'white',  text: '  apt remove / purge <pkg>    remove package' },
        { type: 'text', color: 'white',  text: '  apt update / upgrade        refresh & upgrade' },
        { type: 'text', color: 'white',  text: '  apt autoremove              clean orphan deps' },
        { type: 'text', color: 'dim',    text: '' },
        { type: 'text', color: 'cyan',   text: '  — APT-CACHE —' },
        { type: 'text', color: 'white',  text: '  apt-cache show <pkg>        package details' },
        { type: 'text', color: 'white',  text: '  apt-cache depends <pkg>     dependency tree' },
        { type: 'text', color: 'white',  text: '  apt-cache policy <pkg>      version priorities' },
        { type: 'text', color: 'white',  text: '  apt-cache stats             cache statistics' },
        { type: 'text', color: 'dim',    text: '' },
        { type: 'text', color: 'cyan',   text: '  — DPKG (low-level) —' },
        { type: 'text', color: 'white',  text: '  dpkg -l [pkg]              list installed' },
        { type: 'text', color: 'white',  text: '  dpkg -s <pkg>              package status' },
        { type: 'text', color: 'white',  text: '  dpkg -L <pkg>              files in package' },
        { type: 'text', color: 'white',  text: '  dpkg -S <path>             which pkg owns file' },
        { type: 'text', color: 'dim',    text: '' },
        { type: 'text', color: 'cyan',   text: '  — SNAP —' },
        { type: 'text', color: 'white',  text: '  snap list                  installed snaps' },
        { type: 'text', color: 'white',  text: '  snap find <term>           search store' },
        { type: 'text', color: 'white',  text: '  snap info <snap>           snap details' },
        { type: 'text', color: 'white',  text: '  snap install / remove      manage snaps' },
        { type: 'text', color: 'white',  text: '  snap refresh               update snaps' },
        { type: 'text', color: 'dim',    text: '' },
        { type: 'text', color: 'cyan',   text: '  — DNF / YUM (RHEL/Fedora) —' },
        { type: 'text', color: 'white',  text: '  dnf list installed         list RPM packages' },
        { type: 'text', color: 'white',  text: '  dnf search / info <pkg>    search & details' },
        { type: 'text', color: 'white',  text: '  dnf install / remove       manage packages' },
        { type: 'text', color: 'white',  text: '  dnf history                transaction history' },
        { type: 'text', color: 'dim',    text: '' },
        { type: 'text', color: 'cyan',   text: '  — RPM (low-level) —' },
        { type: 'text', color: 'white',  text: '  rpm -qa                    list all RPM packages' },
        { type: 'text', color: 'white',  text: '  rpm -qi <pkg>              package info' },
        { type: 'text', color: 'white',  text: '  rpm -ql <pkg>              files in package' },
        { type: 'text', color: 'dim',    text: '' },
        { type: 'text', color: 'cyan',   text: '  — PACMAN (Arch Linux) —' },
        { type: 'text', color: 'white',  text: '  pacman -Ss <term>          search packages' },
        { type: 'text', color: 'white',  text: '  pacman -S <pkg>            install package' },
        { type: 'text', color: 'white',  text: '  pacman -Q                  list installed' },
        { type: 'text', color: 'white',  text: '  pacman -Syu                full system upgrade' },
        { type: 'text', color: 'dim',    text: '' },
        { type: 'text', color: 'cyan',   text: '  — Navigation —' },
        { type: 'text', color: 'white',  text: '  cd / ls / pwd / clear' },
      ];
    }

    /* ── unknown ── */
    else {
      responseLines = [{ type: 'text', color: 'red', text: `bash: ${cmd}: command not found` }];
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
          <span className="text-xs text-[#f87171] border border-[#f87171]/20 bg-[#f87171]/5 px-2 py-0.5 rounded font-mono">expert</span>
          <span className="text-xs text-[#4ade80] border border-[#4ade80]/20 bg-[#4ade80]/5 px-2 py-0.5 rounded font-mono">+{LESSON.xp} XP</span>
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
                    <code className="text-[11px] text-[#4ade80] font-bold min-w-[128px] flex-shrink-0">{c.name}</code>
                    <span className="text-[11px] text-[#333]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distro quick-ref */}
            <div className="bg-[#0a0f0a] border border-[#1c1c1c] rounded p-3">
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Package Manager by Distro</div>
              <div className="space-y-1">
                {[
                  ['Ubuntu / Debian', 'apt, dpkg'],
                  ['RHEL / CentOS 8+', 'dnf, rpm'],
                  ['Fedora',           'dnf, rpm'],
                  ['CentOS 7',         'yum, rpm'],
                  ['Arch / Manjaro',   'pacman'],
                  ['openSUSE',         'zypper, rpm'],
                  ['Cross-distro',     'snap, flatpak'],
                ].map(([distro, tools]) => (
                  <div key={distro} className="flex gap-3">
                    <span className="text-[11px] text-[#555] min-w-[100px]">{distro}</span>
                    <code className="text-[11px] text-[#4ade80]">{tools}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Try these packages */}
            <div>
              <div className="text-[10px] text-[#4ade80] font-bold tracking-[0.12em] uppercase mb-2">Packages to explore</div>
              <div className="space-y-1">
                {[
                  ['nginx',    'installed — web server'],
                  ['jq',       'available — JSON tool'],
                  ['tree',     'available — dir tree'],
                  ['neovim',   'available — editor'],
                  ['ripgrep',  'available — fast grep'],
                  ['code',     'snap — VS Code'],
                  ['git',      'RPM — version control'],
                ].map(([pkg, desc]) => (
                  <div key={pkg} className="flex gap-2 items-baseline">
                    <code className="text-[11px] text-[#444]">{pkg}</code>
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
            <div className="absolute bottom-[72px] right-5 bg-[#0a0f0a] border border-[#4ade80] rounded-lg px-5 py-4 w-80 shadow-[0_0_24px_#4ade8018] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#4ade80] font-bold mb-1.5">✓ Level 10 complete!</div>
              <div className="text-[11px] text-[#444] leading-relaxed mb-1">
                You can manage packages with <code className="text-[#4ade80]">apt</code> &amp; <code className="text-[#4ade80]">dpkg</code> on Debian/Ubuntu,
                <code className="text-[#4ade80]"> dnf</code>/<code className="text-[#4ade80]">rpm</code> on RHEL/Fedora,
                <code className="text-[#4ade80]"> snap</code> for cross-distro packages, and <code className="text-[#4ade80]">pacman</code> on Arch.
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