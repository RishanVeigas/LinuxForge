"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── Virtual Filesystem with permission metadata ── */
const INITIAL_FS = {
  "/home/user": {
    type: "dir",
    owner: "user",
    group: "user",
    mode: 0o755,
    children: {
      "notes.txt": {
        type: "file",
        owner: "user",
        group: "user",
        mode: 0o644,
        size: 312,
        content: "Personal notes",
      },
      "secret.txt": {
        type: "file",
        owner: "user",
        group: "user",
        mode: 0o600,
        size: 128,
        content: "API_KEY=sk-prod-abc123",
      },
      "deploy.sh": {
        type: "file",
        owner: "user",
        group: "user",
        mode: 0o644,
        size: 512,
        content: "#!/bin/bash\necho deploying",
      },
      "backup.sh": {
        type: "file",
        owner: "user",
        group: "user",
        mode: 0o755,
        size: 480,
        content: "#!/bin/bash\ntar -czf backup.tar.gz ~",
      },
      "shared.txt": {
        type: "file",
        owner: "user",
        group: "devteam",
        mode: 0o664,
        size: 200,
        content: "shared team file",
      },
      "readonly.cfg": {
        type: "file",
        owner: "root",
        group: "root",
        mode: 0o444,
        size: 96,
        content: "system config",
      },
      "locked.dat": {
        type: "file",
        owner: "root",
        group: "root",
        mode: 0o600,
        size: 2048,
        content: "locked data",
      },
      projects: {
        type: "dir",
        owner: "user",
        group: "user",
        mode: 0o755,
        children: {
          "app.js": {
            type: "file",
            owner: "user",
            group: "devteam",
            mode: 0o664,
            size: 1024,
            content: 'const app = require("express")()',
          },
          "config.env": {
            type: "file",
            owner: "user",
            group: "user",
            mode: 0o600,
            size: 256,
            content: "DB_PASS=secret",
          },
          public: {
            type: "dir",
            owner: "user",
            group: "www-data",
            mode: 0o755,
            children: {
              "index.html": {
                type: "file",
                owner: "user",
                group: "www-data",
                mode: 0o644,
                size: 512,
                content: "<html>Hello</html>",
              },
              "style.css": {
                type: "file",
                owner: "user",
                group: "www-data",
                mode: 0o644,
                size: 320,
                content: "body { margin: 0 }",
              },
            },
          },
        },
      },
      logs: {
        type: "dir",
        owner: "user",
        group: "user",
        mode: 0o700,
        children: {
          "app.log": {
            type: "file",
            owner: "user",
            group: "user",
            mode: 0o600,
            size: 8192,
            content: "log data",
          },
          "error.log": {
            type: "file",
            owner: "user",
            group: "user",
            mode: 0o600,
            size: 4096,
            content: "error data",
          },
        },
      },
    },
  },
  "/etc": {
    type: "dir",
    owner: "root",
    group: "root",
    mode: 0o755,
    children: {
      passwd: {
        type: "file",
        owner: "root",
        group: "root",
        mode: 0o644,
        size: 1872,
        content:
          "root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000::/home/user:/bin/bash",
      },
      shadow: {
        type: "file",
        owner: "root",
        group: "shadow",
        mode: 0o640,
        size: 1120,
        content: "root:$6$hash:19000:0:99999:7:::",
      },
      sudoers: {
        type: "file",
        owner: "root",
        group: "root",
        mode: 0o440,
        size: 756,
        content:
          "root ALL=(ALL:ALL) ALL\nuser ALL=(ALL) NOPASSWD: /usr/bin/apt",
      },
      hosts: {
        type: "file",
        owner: "root",
        group: "root",
        mode: 0o644,
        size: 188,
        content: "127.0.0.1 localhost",
      },
    },
  },
  "/var": {
    type: "dir",
    owner: "root",
    group: "root",
    mode: 0o755,
    children: {
      log: {
        type: "dir",
        owner: "root",
        group: "adm",
        mode: 0o775,
        children: {
          syslog: {
            type: "file",
            owner: "root",
            group: "adm",
            mode: 0o640,
            size: 65536,
            content: "syslog data",
          },
          "auth.log": {
            type: "file",
            owner: "root",
            group: "adm",
            mode: 0o640,
            size: 32768,
            content: "auth log data",
          },
          "app.log": {
            type: "file",
            owner: "www-data",
            group: "adm",
            mode: 0o664,
            size: 16384,
            content: "app log data",
          },
        },
      },
    },
  },
  "/tmp": {
    type: "dir",
    owner: "root",
    group: "root",
    mode: 0o1777,
    children: {
      "session.tmp": {
        type: "file",
        owner: "user",
        group: "user",
        mode: 0o600,
        size: 64,
        content: "SESSION=abc123",
      },
      "cache.tmp": {
        type: "file",
        owner: "user",
        group: "user",
        mode: 0o644,
        size: 512,
        content: "cache",
      },
    },
  },
};

/* ── Permission helpers ── */
function modeToStr(mode, isDir) {
  const sticky = mode & 0o1000 ? "t" : "-";
  const bits = [
    mode & 0o400 ? "r" : "-",
    mode & 0o200 ? "w" : "-",
    mode & 0o100 ? "x" : "-",
    mode & 0o040 ? "r" : "-",
    mode & 0o020 ? "w" : "-",
    mode & 0o010 ? "x" : "-",
    mode & 0o004 ? "r" : "-",
    mode & 0o002 ? "w" : "-",
    mode & 0o001 ? "x" : sticky !== "t" ? "-" : "t",
  ];
  if (sticky === "t") bits[8] = bits[8] === "-" ? "T" : "t";
  return (isDir ? "d" : "-") + bits.join("");
}

function parseChmod(modeStr, currentMode) {
  // numeric: chmod 755
  if (/^\d+$/.test(modeStr)) {
    return parseInt(modeStr, 8);
  }
  // symbolic: chmod u+x, g-w, o=r, a+x etc.
  let mode = currentMode & 0o7777;
  const ops = modeStr.split(",");
  for (const op of ops) {
    const m = op.match(/^([ugoa]*)([+\-=])([rwxst]*)$/);
    if (!m) return null;
    let [, who, action, perms] = m;
    if (!who || who === "a") who = "ugo";
    const permBits = {
      r: [0o400, 0o040, 0o004],
      w: [0o200, 0o020, 0o002],
      x: [0o100, 0o010, 0o001],
    };
    const whoIdx = { u: 0, g: 1, o: 2 };
    let mask = 0;
    for (const p of perms) {
      if (permBits[p]) {
        for (const w of who) {
          if (whoIdx[w] !== undefined) mask |= permBits[p][whoIdx[w]];
        }
      }
    }
    if (action === "+") mode |= mask;
    else if (action === "-") mode &= ~mask;
    else if (action === "=") {
      let clearMask = 0;
      for (const w of who) {
        if (w === "u") clearMask |= 0o700;
        if (w === "g") clearMask |= 0o070;
        if (w === "o") clearMask |= 0o007;
      }
      mode = (mode & ~clearMask) | mask;
    }
  }
  return mode;
}

function canRead(node, user) {
  return user === "root" || node.owner === user
    ? !!(node.mode & 0o400)
    : !!(node.mode & 0o004);
}
function canWrite(node, user) {
  return user === "root" || node.owner === user
    ? !!(node.mode & 0o200)
    : !!(node.mode & 0o002);
}

function getNode(fs, path) {
  if (path === "/")
    return {
      type: "dir",
      owner: "root",
      group: "root",
      mode: 0o755,
      children: fs,
    };
  const parts = path.split("/").filter(Boolean);
  let node = fs;
  let cur = null;
  for (const p of parts) {
    const entries = cur ? cur.children : node;
    if (!entries || !entries[p]) return null;
    cur = entries[p];
  }
  return cur;
}

function getParentAndName(path) {
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop();
  const parent = "/" + parts.join("/");
  return { parent: parent || "/", name };
}

function normalizePath(p) {
  const parts = p.split("/").filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part !== ".") out.push(part);
  }
  return "/" + out.join("/");
}

function resolvePath(input, cwd) {
  if (!input || input === "~") return "/home/user";
  if (input.startsWith("~/"))
    return normalizePath("/home/user/" + input.slice(2));
  if (input.startsWith("/")) return normalizePath(input);
  return normalizePath(cwd + "/" + input);
}

function cwdDisplay(cwd) {
  if (cwd === "/home/user") return "~";
  if (cwd.startsWith("/home/user/"))
    return "~/" + cwd.slice("/home/user/".length);
  return cwd;
}

function fmtSize(n) {
  if (n < 1024) return `${n}`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`;
  return `${(n / 1024 / 1024).toFixed(1)}M`;
}

function fakeDate() {
  return "May  3 09:" + String(Math.floor(Math.random() * 59)).padStart(2, "0");
}

/* ── Objectives ── */
const OBJECTIVES = [
  {
    id: "ls_l",
    label: "Inspect permissions with ls -l",
    desc: "Use ls -l to list files with their permission bits, owner, group, and size.",
    hint: "ls -l",
    validate: (_cwd, hist) =>
      hist.some(
        (h) =>
          /^ls\s+.*-[a-zA-Z]*l/.test(h.trim()) || /^ls\s+-l/.test(h.trim()),
      ),
    successMsg:
      "ls -l shows the full permission string (e.g. -rwxr-xr-x), owner, group, size and mtime for every entry.",
  },
  {
    id: "stat_cmd",
    label: "Get detailed file metadata with stat",
    desc: "Use stat on any file (e.g. notes.txt) to see octal permissions, inode, and timestamps.",
    hint: "stat notes.txt",
    validate: (_cwd, hist) => hist.some((h) => /^stat\s+\S+/.test(h.trim())),
    successMsg:
      "stat reveals the full inode metadata: octal mode, link count, uid/gid, all three timestamps (atime, mtime, ctime), and block usage.",
  },
  {
    id: "chmod_numeric",
    label: "Set permissions numerically with chmod",
    desc: "Use chmod with an octal number to set permissions. Make deploy.sh executable: chmod 755 deploy.sh",
    hint: "chmod 755 deploy.sh",
    validate: (_cwd, hist) =>
      hist.some((h) => /^chmod\s+\d{3,4}\s+\S+/.test(h.trim())),
    successMsg:
      "chmod 755 = rwxr-xr-x. Each digit is owner/group/other. 4=read, 2=write, 1=execute — add them to combine.",
  },
  {
    id: "chmod_symbolic",
    label: "Set permissions symbolically with chmod",
    desc: "Use chmod with symbolic notation. Try: chmod u+x deploy.sh  or  chmod go-w secret.txt",
    hint: "chmod u+x deploy.sh",
    validate: (_cwd, hist) =>
      hist.some((h) => /^chmod\s+[ugoa]+[+\-=][rwxst]+\s+\S+/.test(h.trim())),
    successMsg:
      "Symbolic chmod: [ugoa][+-=][rwxst]. u=user, g=group, o=other, a=all. +adds, -removes, =sets exactly.",
  },
  {
    id: "chown_cmd",
    label: "Change file owner with chown (via sudo)",
    desc: "Only root can change ownership. Use sudo chown to change the owner of shared.txt.",
    hint: "sudo chown root shared.txt",
    validate: (_cwd, hist) =>
      hist.some((h) => /^sudo\s+chown\s+\S+\s+\S+/.test(h.trim())),
    successMsg:
      "chown requires root. sudo chown user:group file sets both owner and group at once. Use chown -R for directories.",
  },
  {
    id: "chgrp_cmd",
    label: "Change file group with chgrp",
    desc: 'Use chgrp to change the group of shared.txt to "devteam". You own the file so no sudo needed.',
    hint: "chgrp devteam shared.txt",
    validate: (_cwd, hist) =>
      hist.some((h) => /^(sudo\s+)?chgrp\s+\S+\s+\S+/.test(h.trim())),
    successMsg:
      "chgrp changes the group. You can chgrp a file you own to any group you belong to. Use -R for recursive.",
  },
  {
    id: "umask_cmd",
    label: "Check the default permission mask with umask",
    desc: "Run umask to see the current creation mask, then try umask 027 to change it.",
    hint: "umask",
    validate: (_cwd, hist) =>
      hist.some((h) => /^umask(\s+\d+)?$/.test(h.trim())),
    successMsg:
      "umask subtracts from the default (666 for files, 777 for dirs). umask 022 → files get 644, dirs get 755.",
  },
  {
    id: "sudo_cmd",
    label: "Run a privileged command with sudo",
    desc: "Use sudo to read a root-only file, e.g. sudo cat /etc/shadow  or  sudo chmod on a root-owned file.",
    hint: "sudo cat /etc/shadow",
    validate: (_cwd, hist) => hist.some((h) => /^sudo\s+\S+/.test(h.trim())),
    successMsg:
      "sudo runs the next command as root. Configured in /etc/sudoers. Use sudo -l to list your allowed commands, sudo -i for a root shell.",
  },
];

const LESSONS_NAV = [
  {
    level: "06",
    title: "Pipes & Redirection",
    status: "done",
    href: "/learn/intermediate/level-6",
  },
  {
    level: "07",
    title: "Process Management",
    status: "done",
    href: "/learn/intermediate/level-7",
  },
  {
    level: "08",
    title: "Permissions & Users",
    status: "active",
    href: "/learn/expert/level-8",
  },
  { level: "09", title: "Networking Basics", status: "locked", href: "#" },
  { level: "10", title: "Shell Scripting I", status: "locked", href: "#" },
  { level: "11", title: "Advanced Text Tools", status: "locked", href: "#" },
];

const LESSON = {
  level: "08",
  track: "expert",
  title: "Permissions & Ownership",
  module: "module_04 — expert",
  description: [
    {
      text: "Linux permissions are a three-layer shield: owner, group, and others — each with read, write, and execute bits. ",
    },
    { text: "chmod", code: true },
    { text: " sets those bits, " },
    { text: "chown", code: true },
    { text: " and " },
    { text: "chgrp", code: true },
    { text: " change who owns a file. " },
    { text: "umask", code: true },
    { text: " controls the default permissions for new files. " },
    { text: "sudo", code: true },
    {
      text: " is the gateway to privilege escalation — understanding it is essential for safe system administration.",
    },
  ],
  commands: [
    { name: "ls -l", desc: "long list with permissions" },
    { name: "ls -la", desc: "include hidden files" },
    { name: "stat <file>", desc: "full inode metadata" },
    { name: "chmod 755 <file>", desc: "set perms numerically" },
    { name: "chmod u+x <file>", desc: "set perms symbolically" },
    { name: "chmod -R 644 <dir>", desc: "recursive permission change" },
    { name: "chown user <file>", desc: "change owner" },
    { name: "chown user:grp <file>", desc: "change owner and group" },
    { name: "chgrp group <file>", desc: "change group only" },
    { name: "umask", desc: "show creation mask" },
    { name: "umask 027", desc: "set creation mask" },
    { name: "sudo <cmd>", desc: "run as root" },
    { name: "sudo -l", desc: "list sudo privileges" },
    { name: "sudo -u user <cmd>", desc: "run as another user" },
  ],
  xp: 250,
  nextLevel: "/expert/level-9",
};

const KNOWN_GROUPS = [
  "user",
  "root",
  "devteam",
  "www-data",
  "adm",
  "sudo",
  "docker",
  "shadow",
];

/* ── Output renderer ── */
function OutputLine({ line }) {
  const colorMap = {
    green: "text-[#4ade80]",
    cyan: "text-[#22d3ee]",
    yellow: "text-[#fbbf24]",
    red: "text-[#f87171]",
    dim: "text-[#3f3f3f]",
    white: "text-[#d4d4d4]",
    blue: "text-[#60a5fa]",
    purple: "text-[#a78bfa]",
    orange: "text-[#fb923c]",
  };
  const cls = colorMap[line.color] || "text-[#aaa]";

  if (line.type === "prompt") {
    const isSudo = line.isSudo;
    return (
      <div className="flex items-center gap-1 font-mono text-[13px] leading-relaxed">
        <span
          className={`font-bold ${isSudo ? "text-[#f87171]" : "text-[#4ade80]"}`}
        >
          {isSudo ? "root" : "user"}
        </span>
        <span className="text-[#2a2a2a]">@</span>
        <span className="text-[#4ade80] font-bold">linux</span>
        <span className="text-[#2a2a2a]">:</span>
        <span className="text-[#60a5fa]">{line.path}</span>
        <span className="text-[#444]">{isSudo ? "#" : "$"}</span>
        <span className="text-[#d4d4d4] ml-1">{line.cmd}</span>
      </div>
    );
  }

  if (line.type === "ls-long") {
    /* one entry per file */
    const p = line.entry;
    const modeColor = p.mode.startsWith("d")
      ? "#60a5fa"
      : p.mode.includes("x")
        ? "#4ade80"
        : p.mode.startsWith("-rw")
          ? "#d4d4d4"
          : "#888";
    const ownerColor =
      p.owner === "root"
        ? "#f87171"
        : p.owner === "user"
          ? "#4ade80"
          : "#60a5fa";
    return (
      <div className="font-mono text-[12px] leading-[1.65] flex gap-2">
        <span style={{ color: modeColor }}>{p.mode}</span>
        <span className="text-[#444] min-w-[16px] text-right">{p.links}</span>
        <span style={{ color: ownerColor }} className="min-w-[52px]">
          {p.owner}
        </span>
        <span className="text-[#555] min-w-[52px]">{p.group}</span>
        <span className="text-[#444] min-w-[44px] text-right">{p.size}</span>
        <span className="text-[#2a2a2a] min-w-[72px]">{p.date}</span>
        <span
          style={{
            color: modeColor,
            fontWeight: p.mode.startsWith("d") ? 700 : 400,
          }}
        >
          {p.name}
          {p.mode.startsWith("d") ? "/" : ""}
        </span>
      </div>
    );
  }

  if (line.type === "stat-display") {
    const s = line.stat;
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div>
          <span className="text-[#555]"> File: </span>
          <span className="text-[#4ade80]">{s.file}</span>
        </div>
        <div>
          <span className="text-[#555]"> Size: </span>
          <span className="text-[#d4d4d4]">{s.size}</span>
          <span className="text-[#444]">
            {" "}
            Blocks: {s.blocks} IO Block: 4096{" "}
            {s.isDir ? "directory" : "regular file"}
          </span>
        </div>
        <div>
          <span className="text-[#555]">Device: </span>
          <span className="text-[#444]">fd01h/{s.inode}d </span>
          <span className="text-[#555]">Inode: </span>
          <span className="text-[#a78bfa]">{s.inode}</span>
          <span className="text-[#444]"> Links: 1</span>
        </div>
        <div>
          <span className="text-[#555]">Access: </span>
          <span className="text-[#fbbf24]">{s.modeStr}</span>
          <span className="text-[#555]"> Uid: </span>
          <span className="text-[#4ade80]">
            ({s.uid}/{s.owner})
          </span>
          <span className="text-[#555]"> Gid: </span>
          <span className="text-[#60a5fa]">
            ({s.gid}/{s.group})
          </span>
        </div>
        <div>
          <span className="text-[#555]">Access: </span>
          <span className="text-[#444]">2026-05-03 09:14:22.000</span>
        </div>
        <div>
          <span className="text-[#555]">Modify: </span>
          <span className="text-[#444]">2026-05-03 09:10:05.000</span>
        </div>
        <div>
          <span className="text-[#555]">Change: </span>
          <span className="text-[#444]">2026-05-03 09:10:05.000</span>
        </div>
        <div>
          <span className="text-[#555]"> Birth: </span>
          <span className="text-[#444]">2026-05-03 09:00:00.000</span>
        </div>
      </div>
    );
  }

  if (line.type === "perm-change") {
    return (
      <div className="flex items-center gap-3 font-mono text-[12px] leading-relaxed">
        <span className="text-[#f87171] line-through opacity-60">
          {line.before}
        </span>
        <span className="text-[#3f3f3f]">→</span>
        <span className="text-[#4ade80]">{line.after}</span>
        <span className="text-[#444] text-[11px]">{line.file}</span>
      </div>
    );
  }

  if (line.type === "owner-change") {
    return (
      <div className="flex items-center gap-3 font-mono text-[12px] leading-relaxed">
        <span className="text-[#555]">{line.file}:</span>
        <span className="text-[#f87171] opacity-70">
          {line.beforeOwner}:{line.beforeGroup}
        </span>
        <span className="text-[#3f3f3f]">→</span>
        <span className="text-[#4ade80]">
          {line.afterOwner}:{line.afterGroup}
        </span>
      </div>
    );
  }

  if (line.type === "umask-display") {
    return (
      <div className="font-mono text-[13px] leading-relaxed">
        <span className="text-[#fbbf24]">{line.mask}</span>
        {line.explain && (
          <span className="text-[#444] text-[11px] ml-3">
            → new files:{" "}
            <span className="text-[#4ade80]">{line.filePerms}</span>
            {"  "}new dirs:{" "}
            <span className="text-[#4ade80]">{line.dirPerms}</span>
          </span>
        )}
      </div>
    );
  }

  if (line.type === "sudo-l") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#555]">
          Matching Defaults entries for user on linux:
        </div>
        <div className="text-[#444] pl-4">
          env_reset, mail_badpass, secure_path=/usr/sbin:/usr/bin:/sbin:/bin
        </div>
        <div className="text-[#555] mt-1">
          User user may run the following commands on linux:
        </div>
        <div className="text-[#4ade80] pl-4">(ALL) NOPASSWD: /usr/bin/apt</div>
        <div className="text-[#4ade80] pl-4">(ALL : ALL) ALL</div>
      </div>
    );
  }

  if (line.type === "obj-complete") {
    return (
      <div className="flex items-start gap-2 bg-[#051305] border border-[#4ade80]/25 rounded px-3 py-2 my-1">
        <span className="text-[#4ade80] text-[13px] mt-[1px]">✓</span>
        <div>
          <div className="text-[12px] text-[#4ade80] font-bold">
            {line.label}
          </div>
          <div className="text-[11px] text-[#444] mt-0.5 leading-relaxed">
            {line.msg}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all ${cls}`}
    >
      {line.text}
    </div>
  );
}

/* ── Main component ── */
export default function Level8Page() {
  const [output, setOutput] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [hintOpen, setHintOpen] = useState(false);
  const [objIdx, setObjIdx] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [levelDone, setLevelDone] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allHistory, setAllHistory] = useState([]);
  const [fs, setFs] = useState(INITIAL_FS);
  const [cwd, setCwd] = useState("/home/user");
  const [umask, setUmask] = useState(0o022);

  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const allHistRef = useRef(allHistory);
  const fsRef = useRef(fs);
  const cwdRef = useRef(cwd);
  const umaskRef = useRef(umask);

  allHistRef.current = allHistory;
  fsRef.current = fs;
  cwdRef.current = cwd;
  umaskRef.current = umask;

  const progress = levelDone
    ? 100
    : Math.round((completed.length / OBJECTIVES.length) * 90);
  const currentObj = OBJECTIVES[objIdx];

  useEffect(() => {
    setOutput([
      {
        id: 0,
        type: "text",
        color: "dim",
        text: "Linux Learning Platform  —  bash 5.2.21",
      },
      {
        id: 1,
        type: "text",
        color: "dim",
        text: "Type 'help' to see commands.",
      },
      { id: 2, type: "text", color: "dim", text: "" },
      {
        id: 3,
        type: "text",
        color: "green",
        text: "Welcome to Level 08 — Permissions & Ownership",
      },
      {
        id: 4,
        type: "text",
        color: "yellow",
        text: `Objective 1/${OBJECTIVES.length}: ${OBJECTIVES[0].label}`,
      },
      { id: 5, type: "text", color: "dim", text: OBJECTIVES[0].desc },
      { id: 6, type: "text", color: "dim", text: "" },
    ]);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outputRef.current)
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const addLines = useCallback((lines) => {
    setOutput((prev) => {
      const base = prev.length;
      return [...prev, ...lines.map((l, i) => ({ ...l, id: base + i }))];
    });
  }, []);

  const checkObjective = useCallback(
    (newAllHistory) => {
      setObjIdx((prevIdx) => {
        if (levelDone) return prevIdx;
        const obj = OBJECTIVES[prevIdx];
        if (!obj) return prevIdx;
        if (obj.validate(cwdRef.current, newAllHistory)) {
          const nextIdx = prevIdx + 1;
          setTimeout(() => {
            addLines([
              {
                type: "obj-complete",
                label: `✓ Objective ${prevIdx + 1}/${OBJECTIVES.length}: ${obj.label}`,
                msg: obj.successMsg,
              },
              { type: "text", color: "dim", text: "" },
            ]);
            setCompleted((prev) => [...prev, obj.id]);
            if (nextIdx >= OBJECTIVES.length) {
              setLevelDone(true);
              setTimeout(() => {
                addLines([
                  {
                    type: "text",
                    color: "green",
                    text: "✓ All objectives complete! Level 08 passed.",
                  },
                ]);
                setShowToast(true);
              }, 400);
            } else {
              setTimeout(() => {
                addLines([
                  {
                    type: "text",
                    color: "yellow",
                    text: `▸ Objective ${nextIdx + 1}/${OBJECTIVES.length}: ${OBJECTIVES[nextIdx].label}`,
                  },
                  {
                    type: "text",
                    color: "dim",
                    text: OBJECTIVES[nextIdx].desc,
                  },
                  { type: "text", color: "dim", text: "" },
                ]);
              }, 400);
            }
          }, 200);
          setHintOpen(false);
          return nextIdx;
        }
        return prevIdx;
      });
    },
    [levelDone, addLines],
  );

  /* ── helpers ── */
  function getNodeFromPath(targetPath) {
    const currentFs = fsRef.current;
    if (targetPath === "/")
      return {
        type: "dir",
        owner: "root",
        group: "root",
        mode: 0o755,
        children: currentFs,
      };
    const parts = targetPath.split("/").filter(Boolean);
    let children = currentFs;
    let node = null;
    for (let i = 0; i < parts.length; i++) {
      const entry = children[parts[i]];
      if (!entry) return null;
      if (i === parts.length - 1) {
        node = entry;
        break;
      }
      if (!entry.children) return null;
      children = entry.children;
    }
    return node;
  }

  function updateNodeInFs(targetPath, updater) {
    const parts = targetPath.split("/").filter(Boolean);
    setFs((prevFs) => {
      const clone = JSON.parse(JSON.stringify(prevFs));
      let children = clone;
      for (let i = 0; i < parts.length - 1; i++) {
        children = children[parts[i]].children;
      }
      const last = parts[parts.length - 1];
      children[last] = updater(children[last]);
      return clone;
    });
  }

  function lsLongEntries(node, targetPath, showHidden, user) {
    const lines = [];
    const entries = node.children || {};
    const keys = Object.keys(entries).filter(
      (k) => showHidden || !k.startsWith("."),
    );
    if (!keys.length)
      return [{ type: "text", color: "dim", text: "(empty directory)" }];
    lines.push({
      type: "text",
      color: "dim",
      text: `total ${keys.length * 8}`,
    });
    for (const k of keys) {
      const e = entries[k];
      const isDir = e.type === "dir";
      lines.push({
        type: "ls-long",
        entry: {
          mode: modeToStr(e.mode, isDir),
          links: isDir ? 2 : 1,
          owner: e.owner,
          group: e.group,
          size: fmtSize(isDir ? 4096 : e.size || 0),
          date: fakeDate(),
          name: k,
        },
      });
    }
    return lines;
  }

  const runCommand = useCallback(
    (raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      setCmdHistory((prev) => [trimmed, ...prev]);
      setHistIdx(-1);
      const newAllHistory = [trimmed, ...allHistRef.current];
      setAllHistory(newAllHistory);
      allHistRef.current = newAllHistory;

      const currentCwd = cwdRef.current;

      /* detect sudo prefix */
      const isSudo = /^sudo\s+/.test(trimmed);
      const effectiveUser = isSudo ? "root" : "user";
      const cmdBody = isSudo ? trimmed.replace(/^sudo\s+/, "") : trimmed;

      const promptLine = {
        type: "prompt",
        path: cwdDisplay(currentCwd),
        cmd: trimmed,
        isSudo,
      };

      const parts = cmdBody.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      const cmd = parts[0];
      const rawArgs = parts.slice(1).map((a) => a.replace(/^["']|["']$/g, ""));
      const flags = rawArgs.filter((a) => a.startsWith("-"));
      const args = rawArgs.filter((a) => !a.startsWith("-"));

      let responseLines = [];

      switch (cmd) {
        /* ─── cd ─── */
        case "cd": {
          const target = rawArgs[0] || "~";
          const resolved = resolvePath(target, currentCwd);
          const node = getNodeFromPath(resolved);
          if (!node) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `bash: cd: ${target}: No such file or directory`,
              },
            ];
          } else if (node.type !== "dir") {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `bash: cd: ${target}: Not a directory`,
              },
            ];
          } else if (effectiveUser !== "root" && !canRead(node, "user")) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `bash: cd: ${target}: Permission denied`,
              },
            ];
          } else {
            setCwd(resolved);
            cwdRef.current = resolved;
          }
          break;
        }

        /* ─── ls ─── */
        case "ls": {
          const showHidden = flags.some((f) => f.includes("a"));
          const longFmt = flags.some((f) => f.includes("l"));
          const targetArg = args[0];
          const targetPath = targetArg
            ? resolvePath(targetArg, currentCwd)
            : currentCwd;
          const node = getNodeFromPath(targetPath);

          if (!node) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `ls: cannot access '${targetArg || "."}': No such file or directory`,
              },
            ];
            break;
          }
          if (node.type === "file") {
            if (longFmt) {
              responseLines = [
                {
                  type: "ls-long",
                  entry: {
                    mode: modeToStr(node.mode, false),
                    links: 1,
                    owner: node.owner,
                    group: node.group,
                    size: fmtSize(node.size || 0),
                    date: fakeDate(),
                    name: targetArg,
                  },
                },
              ];
            } else {
              responseLines = [
                { type: "text", color: "white", text: targetArg },
              ];
            }
            break;
          }
          if (longFmt) {
            responseLines = lsLongEntries(
              node,
              targetPath,
              showHidden,
              effectiveUser,
            );
          } else {
            const keys = Object.keys(node.children || {}).filter(
              (k) => showHidden || !k.startsWith("."),
            );
            responseLines = [
              {
                type: "ls-grid",
                entries: keys.map((k) => ({
                  name: k,
                  isDir: node.children[k].type === "dir",
                  isExec: !!(node.children[k].mode & 0o100),
                })),
              },
            ];
          }
          break;
        }

        /* ─── stat ─── */
        case "stat": {
          if (!args[0]) {
            responseLines = [
              { type: "text", color: "red", text: "stat: missing operand" },
            ];
            break;
          }
          const targetPath = resolvePath(args[0], currentCwd);
          const node = getNodeFromPath(targetPath);
          if (!node) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `stat: cannot stat '${args[0]}': No such file or directory`,
              },
            ];
            break;
          }
          const isDir = node.type === "dir";
          const size = isDir ? 4096 : node.size || 0;
          const inode =
            123456 +
            (Math.abs(
              targetPath.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
            ) %
              900000);
          responseLines = [
            {
              type: "stat-display",
              stat: {
                file: args[0],
                size,
                blocks: Math.ceil(size / 512),
                inode,
                modeStr: `(${(node.mode | (isDir ? 0o40000 : 0o100000)).toString(8).slice(-4)}/${modeToStr(node.mode, isDir)})`,
                uid: node.owner === "root" ? 0 : 1000,
                gid:
                  node.group === "root"
                    ? 0
                    : node.group === "user"
                      ? 1000
                      : 1001,
                owner: node.owner,
                group: node.group,
                isDir,
              },
            },
          ];
          break;
        }

        /* ─── chmod ─── */
        case "chmod": {
          const isRecursive = flags.includes("-R") || flags.includes("-r");
          const modeArg = args[0];
          const fileArg = args[1] || args[0];

          if (!modeArg || !fileArg || modeArg === fileArg) {
            responseLines = [
              { type: "text", color: "red", text: "chmod: missing operand" },
            ];
            break;
          }

          const targetPath = resolvePath(fileArg, currentCwd);
          const node = getNodeFromPath(targetPath);
          if (!node) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `chmod: cannot access '${fileArg}': No such file or directory`,
              },
            ];
            break;
          }

          if (effectiveUser !== "root" && node.owner !== "user") {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `chmod: changing permissions of '${fileArg}': Operation not permitted`,
              },
            ];
            break;
          }

          const before = modeToStr(node.mode, node.type === "dir");
          const newMode = parseChmod(modeArg, node.mode);
          if (newMode === null) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `chmod: invalid mode: '${modeArg}'`,
              },
            ];
            break;
          }
          const after = modeToStr(newMode, node.type === "dir");

          updateNodeInFs(targetPath, (n) => ({ ...n, mode: newMode }));
          responseLines = [
            { type: "perm-change", before, after, file: fileArg },
          ];
          break;
        }

        /* ─── chown ─── */
        case "chown": {
          if (effectiveUser !== "root") {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `chown: changing ownership of '${args[1] || ""}': Operation not permitted\nHint: use sudo chown`,
              },
            ];
            break;
          }
          const ownerArg = args[0];
          const fileArg = args[1];
          if (!ownerArg || !fileArg) {
            responseLines = [
              { type: "text", color: "red", text: "chown: missing operand" },
            ];
            break;
          }

          const [newOwner, newGroup] = ownerArg.includes(":")
            ? ownerArg.split(":")
            : [ownerArg, null];
          const targetPath = resolvePath(fileArg, currentCwd);
          const node = getNodeFromPath(targetPath);
          if (!node) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `chown: cannot access '${fileArg}': No such file or directory`,
              },
            ];
            break;
          }

          const beforeOwner = node.owner;
          const beforeGroup = node.group;
          updateNodeInFs(targetPath, (n) => ({
            ...n,
            owner: newOwner,
            group: newGroup || n.group,
          }));
          responseLines = [
            {
              type: "owner-change",
              file: fileArg,
              beforeOwner,
              beforeGroup,
              afterOwner: newOwner,
              afterGroup: newGroup || node.group,
            },
          ];
          break;
        }

        /* ─── chgrp ─── */
        case "chgrp": {
          const groupArg = args[0];
          const fileArg = args[1];
          if (!groupArg || !fileArg) {
            responseLines = [
              { type: "text", color: "red", text: "chgrp: missing operand" },
            ];
            break;
          }
          if (!KNOWN_GROUPS.includes(groupArg)) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `chgrp: invalid group: '${groupArg}'`,
              },
            ];
            break;
          }

          const targetPath = resolvePath(fileArg, currentCwd);
          const node = getNodeFromPath(targetPath);
          if (!node) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `chgrp: cannot access '${fileArg}': No such file or directory`,
              },
            ];
            break;
          }
          if (effectiveUser !== "root" && node.owner !== "user") {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `chgrp: changing group of '${fileArg}': Operation not permitted`,
              },
            ];
            break;
          }

          const beforeGroup = node.group;
          updateNodeInFs(targetPath, (n) => ({ ...n, group: groupArg }));
          responseLines = [
            {
              type: "owner-change",
              file: fileArg,
              beforeOwner: node.owner,
              beforeGroup,
              afterOwner: node.owner,
              afterGroup: groupArg,
            },
          ];
          break;
        }

        /* ─── umask ─── */
        case "umask": {
          const newMask = args[0] ? parseInt(args[0], 8) : null;
          if (newMask !== null) {
            setUmask(newMask);
            umaskRef.current = newMask;
            responseLines = [{ type: "text", color: "dim", text: "" }];
          }
          const displayMask = newMask !== null ? newMask : umaskRef.current;
          const filePerms = modeToStr(0o666 & ~displayMask, false).slice(1);
          const dirPerms = modeToStr(0o777 & ~displayMask, false).slice(1);
          responseLines = [
            {
              type: "umask-display",
              mask: "0" + displayMask.toString(8).padStart(3, "0"),
              explain: true,
              filePerms,
              dirPerms,
            },
          ];
          break;
        }

        /* ─── sudo (direct handling for sudo -l, sudo -i, sudo -u) ─── */
        case "sudo": {
          /* sudo -l */
          if (rawArgs[0] === "-l") {
            responseLines = [{ type: "sudo-l" }];
            break;
          }
          /* sudo -i */
          if (rawArgs[0] === "-i") {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: "(sudo -i would open an interactive root shell — not supported in this sandbox)",
              },
            ];
            break;
          }
          /* sudo with no real subcmd */
          if (!rawArgs.length) {
            responseLines = [
              { type: "text", color: "red", text: "usage: sudo command" },
            ];
            break;
          }
          /* fall through — the full trimmed command is re-run with isSudo=true above */
          responseLines = [
            {
              type: "text",
              color: "dim",
              text: "(sudo: pass a command, e.g. sudo cat /etc/shadow)",
            },
          ];
          break;
        }

        /* ─── cat (for sudo cat /etc/shadow etc.) ─── */
        case "cat": {
          const fileArg = args[0];
          if (!fileArg) {
            responseLines = [
              { type: "text", color: "red", text: "cat: missing operand" },
            ];
            break;
          }
          const targetPath = resolvePath(fileArg, currentCwd);
          const node = getNodeFromPath(targetPath);
          if (!node) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `cat: ${fileArg}: No such file or directory`,
              },
            ];
            break;
          }
          if (node.type === "dir") {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `cat: ${fileArg}: Is a directory`,
              },
            ];
            break;
          }
          if (effectiveUser !== "root" && !canRead(node, "user")) {
            responseLines = [
              {
                type: "text",
                color: "red",
                text: `cat: ${fileArg}: Permission denied\nHint: try sudo cat ${fileArg}`,
              },
            ];
            break;
          }
          responseLines = (node.content || "")
            .split("\n")
            .map((l) => ({ type: "text", color: "white", text: l }));
          break;
        }

        /* ─── pwd ─── */
        case "pwd": {
          responseLines = [{ type: "text", color: "cyan", text: currentCwd }];
          break;
        }

        /* ─── clear ─── */
        case "clear": {
          setOutput([]);
          return;
        }

        /* ─── help ─── */
        case "help": {
          responseLines = [
            { type: "text", color: "green", text: "Level 08 commands:" },
            { type: "text", color: "dim", text: "" },
            { type: "text", color: "cyan", text: "  — Inspection —" },
            {
              type: "text",
              color: "white",
              text: "  ls -l [path]          long list with permissions",
            },
            {
              type: "text",
              color: "white",
              text: "  stat <file>           full inode metadata",
            },
            { type: "text", color: "dim", text: "" },
            { type: "text", color: "cyan", text: "  — Permissions —" },
            {
              type: "text",
              color: "white",
              text: "  chmod 755 <file>      numeric permission change",
            },
            {
              type: "text",
              color: "white",
              text: "  chmod u+x <file>      symbolic permission change",
            },
            {
              type: "text",
              color: "white",
              text: "  umask [mask]          show / set creation mask",
            },
            { type: "text", color: "dim", text: "" },
            { type: "text", color: "cyan", text: "  — Ownership —" },
            {
              type: "text",
              color: "white",
              text: "  chown <user> <file>   change owner (needs sudo)",
            },
            {
              type: "text",
              color: "white",
              text: "  chown u:g <file>      change owner + group",
            },
            {
              type: "text",
              color: "white",
              text: "  chgrp <group> <file>  change group",
            },
            { type: "text", color: "dim", text: "" },
            { type: "text", color: "cyan", text: "  — Privilege —" },
            {
              type: "text",
              color: "white",
              text: "  sudo <cmd>            run command as root",
            },
            {
              type: "text",
              color: "white",
              text: "  sudo -l               list sudo privileges",
            },
            {
              type: "text",
              color: "white",
              text: "  sudo cat /etc/shadow  read root-only file",
            },
            { type: "text", color: "dim", text: "" },
            { type: "text", color: "cyan", text: "  — Navigation —" },
            { type: "text", color: "white", text: "  cd / ls / pwd / clear" },
          ];
          break;
        }

        default:
          responseLines = [
            {
              type: "text",
              color: "red",
              text: `bash: ${cmd}: command not found`,
            },
          ];
      }

      addLines([
        promptLine,
        ...responseLines,
        { type: "text", color: "dim", text: "" },
      ]);
      checkObjective(newAllHistory);
    },
    [levelDone, addLines, checkObjective],
  );

  /* ── ls-grid output type needs renderer ── */
  const OutputLineWithGrid = useCallback(({ line }) => {
    if (line.type === "ls-grid") {
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-0.5 font-mono text-[13px]">
          {line.entries.map((e) => (
            <span
              key={e.name}
              style={{
                color: e.isDir ? "#60a5fa" : e.isExec ? "#4ade80" : "#aaa",
                fontWeight: e.isDir ? 700 : 400,
              }}
            >
              {e.name}
              {e.isDir ? "/" : ""}
            </span>
          ))}
        </div>
      );
    }
    return <OutputLine line={line} />;
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const val = inputVal;
      setInputVal("");
      runCommand(val);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistIdx((prev) => {
        const n = Math.min(prev + 1, cmdHistory.length - 1);
        setInputVal(cmdHistory[n] || "");
        return n;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistIdx((prev) => {
        const n = Math.max(prev - 1, -1);
        setInputVal(n === -1 ? "" : cmdHistory[n] || "");
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
          <button
            className="md:hidden text-[#444] hover:text-[#4ade80] transition-colors mr-1"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen((o) => !o);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect y="2" width="16" height="1.5" rx="1" />
              <rect y="7" width="16" height="1.5" rx="1" />
              <rect y="12" width="16" height="1.5" rx="1" />
            </svg>
          </button>
          <div className="w-6 h-6 rounded border border-[#4ade80]/40 flex items-center justify-center">
            <span className="text-[#4ade80] text-xs font-bold">$_</span>
          </div>
          <span
            className="text-white text-xs font-bold tracking-tight"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
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
                l.status === "done"
                  ? "bg-[#4ade80] border-[#4ade80]"
                  : l.status === "active"
                    ? "bg-[#fbbf24] border-[#fbbf24] shadow-[0_0_6px_#fbbf2488]"
                    : "bg-[#1a1a1a] border-[#2a2a2a]"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#f87171] border border-[#f87171]/20 bg-[#f87171]/5 px-2 py-0.5 rounded font-mono">
            expert
          </span>
          <span className="text-xs text-[#4ade80] border border-[#4ade80]/20 bg-[#4ade80]/5 px-2 py-0.5 rounded font-mono">
            +{LESSON.xp} XP
          </span>
          <a
            href="/"
            className="text-xs text-[#444] hover:text-[#4ade80] transition-colors"
          >
            exit
          </a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR ── */}
        <aside
          className={`
          w-72 flex-shrink-0 bg-[#0c0c0c] border-r border-[#1c1c1c] flex flex-col overflow-hidden
          md:relative md:translate-x-0 absolute inset-y-0 left-0 z-30 transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#0f0a0a] border-b border-[#1c1c1c] px-5 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#f87171] font-bold tracking-[0.15em] uppercase">
                Level {LESSON.level}
              </span>
              <span className="text-[10px] text-[#444] font-mono">
                {LESSON.track}
              </span>
            </div>
            <h1
              className="text-white font-bold text-base leading-tight"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              {LESSON.title}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
            {/* Description */}
            <div>
              <div className="text-[10px] text-[#f87171] font-bold tracking-[0.12em] uppercase mb-2">
                Description
              </div>
              <p className="text-[12px] text-[#555] leading-[1.8]">
                {LESSON.description.map((seg, i) => {
                  if (seg.code)
                    return (
                      <code
                        key={i}
                        className="text-[#f87171] bg-[#0f0a0a] px-1 rounded text-[11px]"
                      >
                        {seg.text}
                      </code>
                    );
                  return <span key={i}>{seg.text}</span>;
                })}
              </p>
            </div>

            {/* Objectives */}
            <div>
              <div className="text-[10px] text-[#f87171] font-bold tracking-[0.12em] uppercase mb-2">
                Objectives{" "}
                <span className="ml-2 text-[#333] normal-case tracking-normal">
                  {completed.length}/{OBJECTIVES.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {OBJECTIVES.map((obj, i) => {
                  const done = completed.includes(obj.id);
                  const active = i === objIdx && !levelDone;
                  return (
                    <div
                      key={obj.id}
                      className={`flex items-start gap-2.5 px-2.5 py-2 rounded text-[11px] transition-colors ${
                        done
                          ? "bg-[#0f0a0a] border border-[#2e1a1a]"
                          : active
                            ? "bg-[#f87171]/5 border border-[#f87171]/20"
                            : "border border-transparent"
                      }`}
                    >
                      <span
                        className={`mt-[2px] flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold ${
                          done
                            ? "border-[#f87171] bg-[#f87171] text-black"
                            : active
                              ? "border-[#fbbf24] text-[#fbbf24]"
                              : "border-[#2a2a2a] text-[#333]"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <div>
                        <div
                          className={
                            done
                              ? "text-[#333] line-through"
                              : active
                                ? "text-[#d4d4d4]"
                                : "text-[#2a2a2a]"
                          }
                        >
                          {obj.label}
                        </div>
                        {active && (
                          <div className="text-[#444] mt-0.5 leading-relaxed">
                            {obj.desc}
                          </div>
                        )}
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
                      ? "border-[#3a2800] text-[#ffa000] bg-[#1a1200]"
                      : "border-[#2a2a2a] text-[#444] hover:border-[#ffa000] hover:text-[#ffa000]"
                  }`}
                  onClick={() => setHintOpen((o) => !o)}
                >
                  {hintOpen
                    ? "[ hide hint ]"
                    : `[ hint for objective ${objIdx + 1} ]`}
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
              <div className="text-[10px] text-[#f87171] font-bold tracking-[0.12em] uppercase mb-2">
                Commands
              </div>
              <div className="space-y-1.5">
                {LESSON.commands.map((c) => (
                  <div key={c.name} className="flex gap-3 items-baseline">
                    <code className="text-[11px] text-[#f87171] font-bold min-w-[112px] flex-shrink-0">
                      {c.name}
                    </code>
                    <span className="text-[11px] text-[#333]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Permission bits reference */}
            <div className="bg-[#0f0a0a] border border-[#1c1c1c] rounded p-3">
              <div className="text-[10px] text-[#f87171] font-bold tracking-[0.12em] uppercase mb-2">
                Permission Bits
              </div>
              <div className="font-mono text-[11px] text-[#555] mb-2">
                drwxr-xr-x
              </div>
              <div className="space-y-0.5">
                {[
                  ["d", "directory flag"],
                  ["rwx", "owner: read write execute"],
                  ["r-x", "group: read execute"],
                  ["r-x", "others: read execute"],
                ].map(([bits, desc], i) => (
                  <div key={i} className="flex gap-3">
                    <code className="text-[11px] text-[#60a5fa] min-w-[28px]">
                      {bits}
                    </code>
                    <span className="text-[11px] text-[#333]">{desc}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-0.5">
                {[
                  ["4", "r — read"],
                  ["2", "w — write"],
                  ["1", "x — execute"],
                ].map(([n, d]) => (
                  <div key={n} className="flex gap-3">
                    <code className="text-[11px] text-[#fbbf24] min-w-[28px]">
                      {n}
                    </code>
                    <span className="text-[11px] text-[#333]">{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Files to experiment with */}
            <div>
              <div className="text-[10px] text-[#f87171] font-bold tracking-[0.12em] uppercase mb-2">
                Files to explore
              </div>
              <div className="space-y-1">
                {[
                  ["notes.txt", "644 — user owned"],
                  ["secret.txt", "600 — private"],
                  ["deploy.sh", "644 → make executable"],
                  ["readonly.cfg", "444 — root owned"],
                  ["locked.dat", "600 root — needs sudo"],
                  ["/etc/shadow", "640 root — sudo cat"],
                ].map(([f, d]) => (
                  <div key={f} className="flex gap-2 items-baseline">
                    <code className="text-[11px] text-[#444]">{f}</code>
                    <span className="text-[10px] text-[#2a2a2a] flex-shrink-0">
                      {d}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Level nav */}
            <div>
              <div className="text-[10px] text-[#f87171] font-bold tracking-[0.12em] uppercase mb-2">
                Module
              </div>
              <div className="space-y-0.5">
                {LESSONS_NAV.map((l) => (
                  <a
                    key={l.level}
                    href={l.status === "locked" ? undefined : l.href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-[11px] transition-colors duration-150 ${
                      l.status === "active"
                        ? "bg-[#f87171]/8 text-white"
                        : l.status === "done"
                          ? "text-[#444] hover:text-[#666]"
                          : "text-[#222] cursor-default"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        l.status === "done"
                          ? "bg-[#4ade80]"
                          : l.status === "active"
                            ? "bg-[#f87171]"
                            : "bg-[#2a2a2a]"
                      }`}
                    />
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
            <div
              className="h-full bg-[#f87171] transition-all duration-500"
              style={{ width: `${progress}%`, boxShadow: "0 0 8px #f8717160" }}
            />
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
            <span className="text-[11px] text-[#2a2a2a] tracking-[0.05em]">
              bash — user@linux
            </span>
            <div>
              {levelDone ? (
                <span className="text-[10px] text-[#f87171] border border-[#f87171]/30 px-2 py-0.5 rounded-full">
                  ✓ complete
                </span>
              ) : (
                <span className="text-[10px] text-[#333] font-mono">
                  {completed.length}/{OBJECTIVES.length} done
                </span>
              )}
            </div>
          </div>

          {/* Output */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-[2px]"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#1a1a1a #000" }}
          >
            {output.map((line) => (
              <OutputLineWithGrid key={line.id} line={line} />
            ))}
          </div>

          {/* Success toast */}
          {showToast && (
            <div className="absolute bottom-[72px] right-5 bg-[#0f0a0a] border border-[#f87171] rounded-lg px-5 py-4 w-72 shadow-[0_0_24px_#f8717118] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#f87171] font-bold mb-1.5">
                ✓ Level 08 complete!
              </div>
              <div className="text-[11px] text-[#444] leading-relaxed mb-1">
                You can now read permissions with{" "}
                <code className="text-[#f87171]">ls -l</code> &{" "}
                <code className="text-[#f87171]">stat</code>, change them with{" "}
                <code className="text-[#f87171]">chmod</code>, transfer
                ownership with <code className="text-[#f87171]">chown</code>/
                <code className="text-[#f87171]">chgrp</code>, and escalate
                safely with <code className="text-[#f87171]">sudo</code>.
              </div>
              <div className="text-[11px] text-[#f87171]/60 mb-3">
                +{LESSON.xp} XP earned
              </div>
              <div className="flex gap-2">
                <a
                  href={LESSON.nextLevel}
                  className="flex-1 bg-[#f87171] text-black text-[12px] font-bold py-1.5 rounded text-center hover:bg-[#f87171]/90 transition-opacity"
                >
                  Next Level →
                </a>
                <button
                  onClick={() => setShowToast(false)}
                  className="text-[11px] text-[#333] hover:text-[#555] px-2"
                >
                  ✕
                </button>
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
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#d4d4d4] caret-[#f87171] font-mono"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

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
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #1c1c1c; border-radius: 2px; }
      `}</style>
    </div>
  );
}
