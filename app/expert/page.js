import { useState, useRef, useEffect, useCallback } from "react";

// ── Virtual Filesystem ──────────────────────────────────────────────────────
const FS_INITIAL = () => ({
  home: {
    user: {
      documents: {
        "report.txt": "Q3 Financial Report\nRevenue: $1.2M\nExpenses: $800K\nProfit: $400K",
        "notes.md": "# Meeting Notes\n- Follow up with team\n- Review budget\n- Deploy new features",
        "config.json": '{\n  "host": "192.168.1.1",\n  "port": 8080,\n  "debug": false\n}',
      },
      downloads: {
        "setup.sh": "#!/bin/bash\necho installing...",
        "log.txt": "ERROR: disk full\nINFO: service started\nERROR: connection timeout\nWARN: high memory\nERROR: null pointer\nINFO: backup complete",
        "data.csv": "name,age,role\nAlice,30,admin\nBob,25,user\nCarol,28,dev",
      },
      projects: {
        "app.py": "# Flask app\nfrom flask import Flask\napp = Flask(__name__)",
        "requirements.txt": "flask==2.3.0\nrequests==2.31.0\nnumpy==1.24.0",
      },
      ".bashrc": "# bash configuration\nexport PATH=$PATH:/usr/local/bin",
      ".profile": "# profile loaded on login",
    },
  },
  etc: {
    hosts: "127.0.0.1 localhost\n::1 localhost\n192.168.1.1 gateway",
    passwd: "root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000::/home/user:/bin/bash",
    sudoers: "root    ALL=(ALL:ALL) ALL\nuser    ALL=(ALL) NOPASSWD: ALL",
  },
  var: {
    log: { syslog: "[system log entries...]", "auth.log": "sudo: user TTY=pts/0 ; USER=root ; COMMAND=/bin/apt" },
    www: { html: { "index.html": "<html><body>Hello World</body></html>" } },
  },
  tmp: {},
  usr: { local: { bin: {} } },
});

const DISK_INFO = [
  { fs: "overlay",   size: "50G",  used: "23G",  avail: "25G",  use: "48%", mount: "/" },
  { fs: "/dev/sda1", size: "100G", used: "61G",  avail: "39G",  use: "61%", mount: "/home" },
  { fs: "/dev/sda2", size: "20G",  used: "8.2G", avail: "11G",  use: "43%", mount: "/var" },
  { fs: "tmpfs",     size: "7.8G", used: "1.2G", avail: "6.6G", use: "16%", mount: "/tmp" },
];

const DU_MAP = { documents: "128K", downloads: "512K", projects: "64K", ".bashrc": "4.0K", ".profile": "4.0K" };

function normalizePath(p) {
  const parts = p.split("/").filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part !== ".") out.push(part);
  }
  return "/" + out.join("/");
}

function getNode(fs, path) {
  if (path === "/") return fs;
  const parts = path.split("/").filter(Boolean);
  let node = fs;
  for (const p of parts) {
    if (node && typeof node === "object" && p in node) node = node[p];
    else return null;
  }
  return node;
}

function cwdDisplay(cwd) {
  if (cwd === "/home/user") return "~";
  if (cwd.startsWith("/home/user/")) return "~/" + cwd.slice("/home/user/".length);
  return cwd;
}

function resolvePath(cwd, input) {
  if (!input || input === "~") return "/home/user";
  if (input.startsWith("/")) return normalizePath(input);
  if (input === "..") return normalizePath(cwd + "/..");
  if (input === ".") return cwd;
  return normalizePath(cwd + "/" + input);
}

const LEVELS = [
  { label: "Where Am I?",   done: true },
  { label: "Moving Around", done: true },
  { label: "Text & Search", done: true },
  { label: "Permissions",   done: true },
  { label: "Expert",        done: false, active: true },
];

const OBJECTIVES = [
  { id: "ping",   text: "Run <code>ping google.com</code> to test network connectivity",       done: false },
  { id: "curl",   text: "Use <code>curl https://api.github.com</code> to fetch a URL",         done: false },
  { id: "wget",   text: "Use <code>wget https://example.com/file.zip</code> to download",      done: false },
  { id: "zip",    text: "Run <code>zip out.zip documents/report.txt</code> to compress",       done: false },
  { id: "unzip",  text: "Run <code>unzip out.zip</code> to extract an archive",                done: false },
  { id: "df",     text: "Run <code>df -h</code> to inspect disk space usage",                  done: false },
  { id: "du",     text: "Run <code>du -sh downloads/</code> to check folder size",             done: false },
  { id: "sudo",   text: "Run <code>sudo apt update</code> to execute as superuser",            done: false },
];

const CMD_REF = [
  ["ping",   "test network connectivity to a host"],
  ["curl",   "transfer data from/to a URL"],
  ["wget",   "download files from the web"],
  ["zip",    "compress files into a .zip archive"],
  ["unzip",  "extract files from a .zip archive"],
  ["df",     "report filesystem disk space usage"],
  ["du",     "estimate file/directory space usage"],
  ["sudo",   "execute command as superuser"],
  ["ls",     "list directory contents"],
  ["cd",     "change directory"],
  ["pwd",    "print working directory"],
  ["cat",    "display file contents"],
  ["mkdir",  "create directory"],
  ["rm",     "remove file or directory"],
  ["cp",     "copy files"],
  ["mv",     "move/rename files"],
  ["echo",   "print/write text"],
  ["grep",   "search text patterns"],
  ["chmod",  "change file permissions"],
  ["ps",     "list running processes"],
  ["kill",   "terminate a process"],
  ["clear",  "clear terminal screen"],
  ["help",   "list all commands"],
];

const EXPERT_CMDS = new Set(["ping","curl","wget","zip","unzip","df","du","sudo"]);

export default function LinuxLearn() {
  const [fs, setFs]             = useState(FS_INITIAL);
  const [cwd, setCwd]           = useState("/home/user");
  const [lines, setLines]       = useState([
    { text: "Linux Learning Platform  —  bash 5.2.21", cls: "dim" },
    { text: "Type 'help' to see all available commands.", cls: "dim" },
    { text: "", cls: "" },
    { text: "⚡ Welcome to Expert Level — Networking & System Tools", cls: "expert" },
    { text: "Master 8 advanced commands to complete this level.", cls: "yellow" },
    { text: "", cls: "" },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx]   = useState(-1);
  const [hintVisible, setHintVisible] = useState(false);
  const [objectives, setObjectives] = useState(OBJECTIVES);
  const [levelDone, setLevelDone]   = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const outputRef = useRef(null);
  const inputRef  = useRef(null);

  const completedCount = objectives.filter((o) => o.done).length;
  const progress = levelDone ? 100 : Math.round((completedCount / objectives.length) * 90);

  useEffect(() => {
    if (outputRef.current)
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  const addLine = useCallback((text, cls = "") => {
    setLines((prev) => [...prev, { text, cls }]);
  }, []);

  const addLines = useCallback((arr) => {
    setLines((prev) => [...prev, ...arr]);
  }, []);

  const scheduleLines = useCallback((pairs, delayMs = 80) => {
    pairs.forEach(([text, cls], i) => {
      setTimeout(() => setLines((prev) => [...prev, { text, cls: cls || "cyan" }]), i * delayMs);
    });
  }, []);

  const markObjective = useCallback((id) => {
    setObjectives((prev) => {
      const updated = prev.map((o) => (o.id === id ? { ...o, done: true } : o));
      if (updated.every((o) => o.done)) {
        setTimeout(() => {
          setLevelDone(true);
          setToastVisible(true);
          setLines((l) => [
            ...l,
            { text: "", cls: "" },
            { text: "🏆 All objectives complete! Expert Level cleared!", cls: "expert" },
            { text: "You are now a Linux power user.", cls: "dim" },
          ]);
        }, 400);
      }
      return updated;
    });
  }, []);

  // ── Command engine ────────────────────────────────────────────────────────
  const COMMANDS = useCallback((fsSnap) => ({

    ping(args) {
      const host = args.find((a) => !a.startsWith("-")) || "localhost";
      addLine(`PING ${host} (93.184.216.34): 56 data bytes`, "dim");
      const rows = Array.from({ length: 4 }, (_, i) =>
        [`64 bytes from 93.184.216.34: icmp_seq=${i} ttl=55 time=${(12.3 + Math.random() * 5).toFixed(3)} ms`, "cyan"]
      );
      scheduleLines(rows, 300);
      setTimeout(() => {
        setLines((prev) => [
          ...prev,
          { text: "", cls: "" },
          { text: `--- ${host} ping statistics ---`, cls: "dim" },
          { text: "4 packets transmitted, 4 received, 0% packet loss", cls: "green" },
          { text: "round-trip min/avg/max = 12.3/14.1/17.2 ms", cls: "dim" },
        ]);
      }, 4 * 300 + 200);
      markObjective("ping");
    },

    curl(args) {
      const url = args.find((a) => !a.startsWith("-")) || "";
      if (!url) { addLine("curl: no URL specified", "red"); return; }
      const oIdx = args.indexOf("-o");
      const outFile = oIdx !== -1 ? args[oIdx + 1] : null;
      const body = url.includes("github")
        ? '{\n  "current_user_url": "https://api.github.com/user",\n  "rate_limit_url": "https://api.github.com/rate_limit"\n}'
        : '<!DOCTYPE html>\n<html>\n<head><title>Example Domain</title></head>\n<body><h1>Example Domain</h1></body>\n</html>';
      addLine("  % Total    % Received  Xferd  Average Speed   Time", "dim");
      setTimeout(() => {
        addLine(`100  ${body.length}  100  ${body.length}    0     0   8821      0 --:--:-- --:--:--  9012`, "dim");
        if (outFile) {
          setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); getNode(c, cwd)[outFile] = body; return c; });
          addLine(`Saved to: ${outFile}`, "green");
        } else {
          body.split("\n").forEach((l) => addLine(l, "cyan"));
        }
        markObjective("curl");
      }, 500);
    },

    wget(args) {
      const url = args.find((a) => !a.startsWith("-")) || "";
      if (!url) { addLine("wget: missing URL", "red"); return; }
      const filename = url.split("/").pop() || "downloaded_file";
      scheduleLines([
        [`--2026-04-30 10:42:17--  ${url}`, "dim"],
        [`Resolving example.com... 93.184.216.34`, "dim"],
        [`Connecting to example.com|93.184.216.34|:443... connected.`, "dim"],
      ], 120);
      setTimeout(() => {
        setLines((prev) => [
          ...prev,
          { text: "HTTP request sent, awaiting response... 200 OK", cls: "green" },
          { text: "Length: 1256 (1.2K) [application/zip]", cls: "dim" },
          { text: `Saving to: '${filename}'`, cls: "dim" },
          { text: "", cls: "" },
          { text: `${filename}     100%[===================>]   1.23K  --.-KB/s    in 0s`, cls: "cyan" },
          { text: "", cls: "" },
          { text: `2026-04-30 10:42:18 (12.4 MB/s) - '${filename}' saved [1256/1256]`, cls: "green" },
        ]);
        setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); getNode(c, cwd)[filename] = `[downloaded from ${url}]`; return c; });
        markObjective("wget");
      }, 600);
    },

    zip(args) {
      const nonFlags = args.filter((a) => !a.startsWith("-"));
      const zipName  = nonFlags[0];
      const targets  = nonFlags.slice(1);
      if (!zipName || !targets.length) { addLine("zip: usage: zip archive.zip file1 [file2 ...]", "red"); return; }
      targets.forEach((t) => {
        const node = getNode(fsSnap, resolvePath(cwd, t));
        addLine(node === null
          ? `  adding: ${t} (No such file or directory)`
          : `  adding: ${t} (deflated 68%)`, node === null ? "red" : "cyan");
      });
      addLine(`Created: ${zipName}`, "green");
      setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); getNode(c, cwd)[zipName] = `[zip: ${targets.join(", ")}]`; return c; });
      markObjective("zip");
    },

    unzip(args) {
      const zipFile = args.find((a) => !a.startsWith("-"));
      if (!zipFile) { addLine("unzip: missing archive name", "red"); return; }
      const node = getNode(fsSnap, resolvePath(cwd, zipFile));
      if (node === null) { addLine(`unzip: cannot find or open ${zipFile}`, "red"); return; }
      addLines([
        { text: `Archive:  ${zipFile}`, cls: "dim" },
        { text: "  inflating: extracted_file.txt", cls: "cyan" },
        { text: "  inflating: extracted_data.json", cls: "cyan" },
        { text: "  inflating: README.md", cls: "cyan" },
        { text: "Extracted 3 files.", cls: "green" },
      ]);
      setFs((prev) => {
        const c = JSON.parse(JSON.stringify(prev));
        const dir = getNode(c, cwd);
        dir["extracted_file.txt"]  = "extracted content";
        dir["extracted_data.json"] = '{"status":"ok"}';
        dir["README.md"]           = "# Extracted README\nThis file was unzipped.";
        return c;
      });
      markObjective("unzip");
    },

    df(args) {
      const human = args.some((a) => a.includes("h") || a.includes("H"));
      addLine(`Filesystem      ${human ? "Size " : "1K-blocks "} Used  Avail Use% Mounted on`, "dim");
      DISK_INFO.forEach((d) => {
        const pct = parseInt(d.use);
        addLine(
          `${d.fs.padEnd(16)}${(human ? d.size : "52428800").padEnd(7)} ${(human ? d.used : "24117248").padEnd(7)}${(human ? d.avail : "26214400").padEnd(7)}${d.use.padEnd(5)} ${d.mount}`,
          pct > 80 ? "red" : pct > 55 ? "yellow" : "cyan"
        );
      });
      markObjective("df");
    },

    du(args) {
      const summarize = args.some((a) => a.includes("s"));
      const target    = args.find((a) => !a.startsWith("-")) || ".";
      const resolved  = resolvePath(cwd, target);
      const node      = getNode(fsSnap, resolved);
      if (node === null) { addLine(`du: cannot access '${target}': No such file or directory`, "red"); return; }
      const key = target.replace(/\/$/, "").split("/").pop();
      if (typeof node === "string" || summarize) {
        addLine(`${DU_MAP[key] || "256K"}\t${target}`, "cyan");
      } else {
        Object.keys(node).forEach((name) => {
          addLine(`${DU_MAP[name] || "4.0K"}\t${target.replace(/\/$/, "")}/${name}`, "cyan");
        });
        addLine(`${DU_MAP[key] || "512K"}\t${target}`, "green");
      }
      markObjective("du");
    },

    sudo(args) {
      if (!args.length) { addLine("sudo: usage: sudo <command> [args]", "red"); return; }
      const sub = args[0]; const rest = args.slice(1);
      if (sub === "apt") {
        const action = rest[0] || "";
        addLine("[sudo] password for user: ", "dim");
        setTimeout(() => {
          if (action === "update") {
            scheduleLines([
              ["Hit:1 http://archive.ubuntu.com/ubuntu jammy InRelease", "cyan"],
              ["Hit:2 http://archive.ubuntu.com/ubuntu jammy-updates InRelease", "cyan"],
              ["Hit:3 http://security.ubuntu.com/ubuntu jammy-security InRelease", "cyan"],
              ["Reading package lists... Done", "cyan"],
              ["Building dependency tree... Done", "cyan"],
              ["12 packages can be upgraded. Run 'apt list --upgradable' to see them.", "green"],
            ], 80);
          } else if (action === "install") {
            const pkg = rest[1] || "package";
            scheduleLines([
              [`Reading package lists... Done`, "cyan"],
              [`The following NEW packages will be installed: ${pkg}`, "cyan"],
              [`0 upgraded, 1 newly installed, 0 to remove.`, "dim"],
              [`Fetched 1,234 kB in 1s (1,234 kB/s)`, "dim"],
              [`Setting up ${pkg} ... done`, "green"],
            ], 80);
          } else {
            addLine(`sudo: apt ${action}: unknown action`, "red");
          }
          setTimeout(() => markObjective("sudo"), 700);
        }, 400);
        return;
      }
      // generic sudo passthrough
      addLine(`[sudo] Running as root: ${args.join(" ")}`, "yellow");
      const cmds = COMMANDS(fsSnap);
      if (sub in cmds) cmds[sub](rest);
      else addLine(`sudo: ${sub}: command not found`, "red");
      markObjective("sudo");
    },

    // ── Standard commands ─────────────────────────────────────────────────
    pwd()   { addLine(cwd, "cyan"); },
    whoami(){ addLine("user", "cyan"); },
    uname(args) {
      addLine(args.includes("-a")
        ? "Linux linux 6.5.0-1025-generic #25~22.04.1-Ubuntu SMP x86_64 GNU/Linux"
        : "Linux", "cyan");
    },

    ls(args) {
      const showHidden = args.some((a) => a.includes("a"));
      const longFmt    = args.some((a) => a.includes("l"));
      const node = getNode(fsSnap, cwd);
      if (!node || typeof node === "string") { addLine("ls: cannot access directory", "red"); return; }
      const entries = Object.keys(node).filter((k) => showHidden || !k.startsWith("."));
      if (!entries.length) { addLine("(empty)", "dim"); return; }
      if (longFmt) {
        addLine("total " + entries.length * 4, "dim");
        entries.forEach((e) => {
          const isDir = typeof node[e] === "object";
          addLine(`${isDir ? "drwxr-xr-x" : "-rw-r--r--"}  1 user user ${isDir ? " 4096" : String((node[e]||"").length).padStart(5)} Apr 30 10:00 ${e}${isDir ? "/" : ""}`, isDir ? "blue" : "");
        });
      } else {
        const parts = entries.map((e) => ({ text: e + (typeof node[e] === "object" ? "/" : ""), isDir: typeof node[e] === "object" }));
        setLines((prev) => [...prev, { text: "", cls: "", lsRow: parts }]);
      }
    },

    cd(args) {
      const resolved = resolvePath(cwd, args[0] || "~");
      const node = getNode(fsSnap, resolved);
      if (node === null)          { addLine(`bash: cd: ${args[0]}: No such file or directory`, "red"); return; }
      if (typeof node === "string") { addLine(`bash: cd: ${args[0]}: Not a directory`, "red"); return; }
      setCwd(resolved);
    },

    cat(args) {
      if (!args[0]) { addLine("cat: missing operand", "red"); return; }
      const node = getNode(fsSnap, resolvePath(cwd, args[0]));
      if (node === null)            { addLine(`cat: ${args[0]}: No such file or directory`, "red"); return; }
      if (typeof node === "object") { addLine(`cat: ${args[0]}: Is a directory`, "red"); return; }
      (node || "(empty)").split("\n").forEach((l) => addLine(l));
    },

    mkdir(args) {
      if (!args[0]) { addLine("mkdir: missing operand", "red"); return; }
      const node = getNode(fsSnap, cwd);
      if (args[0] in node) { addLine(`mkdir: '${args[0]}': File exists`, "red"); return; }
      setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); getNode(c, cwd)[args[0]] = {}; return c; });
    },

    touch(args) {
      if (!args[0]) { addLine("touch: missing operand", "red"); return; }
      setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); const n = getNode(c, cwd); if (!(args[0] in n)) n[args[0]] = ""; return c; });
    },

    rm(args) {
      const recursive = args.some((a) => a === "-r" || a === "-rf");
      const target    = args.find((a) => !a.startsWith("-"));
      if (!target) { addLine("rm: missing operand", "red"); return; }
      const node = getNode(fsSnap, cwd);
      if (!(target in node)) { addLine(`rm: '${target}': No such file or directory`, "red"); return; }
      if (typeof node[target] === "object" && !recursive) { addLine(`rm: '${target}': Is a directory`, "red"); return; }
      setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); delete getNode(c, cwd)[target]; return c; });
    },

    cp(args) {
      const nf = args.filter((a) => !a.startsWith("-"));
      if (nf.length < 2) { addLine("cp: missing destination", "red"); return; }
      const node = getNode(fsSnap, resolvePath(cwd, nf[0]));
      if (node === null) { addLine(`cp: '${nf[0]}': No such file`, "red"); return; }
      setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); getNode(c, cwd)[nf[1]] = JSON.parse(JSON.stringify(node)); return c; });
      addLine(`'${nf[0]}' -> '${nf[1]}'`, "cyan");
    },

    mv(args) {
      const nf = args.filter((a) => !a.startsWith("-"));
      if (nf.length < 2) { addLine("mv: missing destination", "red"); return; }
      const node = getNode(fsSnap, cwd);
      if (!(nf[0] in node)) { addLine(`mv: '${nf[0]}': No such file`, "red"); return; }
      setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); const d = getNode(c, cwd); d[nf[1]] = d[nf[0]]; delete d[nf[0]]; return c; });
      addLine(`'${nf[0]}' -> '${nf[1]}'`, "cyan");
    },

    echo(args) {
      const gtIdx = args.indexOf(">");
      if (gtIdx !== -1) {
        const text = args.slice(0, gtIdx).join(" ").replace(/^"|"$/g, "");
        const fn   = args[gtIdx + 1];
        if (!fn) { addLine("bash: syntax error near '>'", "red"); return; }
        setFs((prev) => { const c = JSON.parse(JSON.stringify(prev)); getNode(c, cwd)[fn] = text; return c; });
      } else {
        addLine(args.join(" ").replace(/^"|"$/g, ""));
      }
    },

    grep(args) {
      const iFlag   = args.some((a) => a === "-i");
      const cleaned = args.filter((a) => !a.startsWith("-"));
      if (cleaned.length < 2) { addLine("grep: usage: grep [options] PATTERN FILE", "red"); return; }
      const node = getNode(fsSnap, resolvePath(cwd, cleaned[1]));
      if (!node || typeof node === "object") { addLine(`grep: ${cleaned[1]}: No such file`, "red"); return; }
      const regex = new RegExp(cleaned[0], iFlag ? "i" : "");
      const hits  = node.split("\n").filter((l) => regex.test(l));
      if (!hits.length) addLine("(no matches)", "dim");
      else hits.forEach((l) => addLine(l, "green"));
    },

    chmod(args) {
      if (args.length < 2) { addLine("chmod: missing operand", "red"); return; }
      addLine(`mode of '${args[1]}' changed to ${args[0]}`, "cyan");
    },

    ps() {
      addLines([
        { text: "  PID TTY          TIME CMD", cls: "dim" },
        { text: " 1023 pts/0    00:00:00 bash",    cls: "cyan" },
        { text: " 1847 pts/0    00:00:00 node",    cls: "cyan" },
        { text: " 2041 pts/0    00:00:01 python3", cls: "cyan" },
        { text: " 3102 pts/0    00:00:00 ps",      cls: "cyan" },
      ]);
    },

    kill(args) {
      const pid = args.find((a) => !a.startsWith("-"));
      if (!pid) { addLine("kill: missing PID", "red"); return; }
      addLine(`Process ${pid} terminated.`, "yellow");
    },

    history(_a, _r, hist) {
      if (!hist.length) { addLine("(no history)", "dim"); return; }
      hist.forEach((cmd, i) => addLine(`  ${String(hist.length - i).padStart(3)}  ${cmd}`, "dim"));
    },

    clear() { setLines([]); },

    help() {
      addLines([
        { text: "⚡ Expert Level Commands:", cls: "expert" },
        { text: "", cls: "" },
        ...CMD_REF.map(([name, desc]) => ({ text: `  ${name.padEnd(10)} — ${desc}`, cls: "dim", cmdRef: { name, desc } })),
      ]);
    },
  }), [cwd, addLine, addLines, scheduleLines, markObjective]);

  // ── Run command ───────────────────────────────────────────────────────────
  function runCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const newHist = [trimmed, ...cmdHistory];
    setCmdHistory(newHist);
    setHistIdx(-1);
    setLines((prev) => [...prev, { text: "", cls: "", promptEcho: { path: cwdDisplay(cwd), cmd: trimmed } }]);
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd   = parts[0];
    const args  = parts.slice(1).map((a) => a.replace(/^"|"$/g, ""));
    const cmds  = COMMANDS(fs);
    if (cmd in cmds) cmds[cmd](args, trimmed, newHist);
    else addLine(`bash: ${cmd}: command not found`, "red");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") { const v = inputVal; setInputVal(""); runCommand(v); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistIdx((i) => { const n = Math.min(i + 1, cmdHistory.length - 1); setInputVal(cmdHistory[n] || ""); return n; });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistIdx((i) => { const n = i - 1; if (n < 0) { setInputVal(""); return -1; } setInputVal(cmdHistory[n] || ""); return n; });
    } else if (e.key === "Tab") {
      e.preventDefault();
      const node = getNode(fs, cwd);
      if (!node || typeof node === "string") return;
      const p2   = inputVal.split(" ");
      const last = p2[p2.length - 1];
      const hits = Object.keys(node).filter((k) => k.startsWith(last));
      if (hits.length === 1) { p2[p2.length - 1] = hits[0]; setInputVal(p2.join(" ")); }
    }
  }

  // ── Colours ───────────────────────────────────────────────────────────────
  const EX  = "#a78bfa"; // expert purple
  const GR  = "#4ade80"; // green accent
  const colorMap = {
    green: GR, dim: "#52525b", yellow: "#facc15",
    red: "#f87171", cyan: "#67e8f9", blue: "#93c5fd",
    expert: EX, "": "#d4d4d8",
  };

  return (
    <div
      className="flex flex-col h-screen font-mono overflow-hidden"
      style={{ background: "#0e0e0e", fontFamily: "'JetBrains Mono', monospace" }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* ── Topbar ── */}
      <div className="flex items-center justify-between px-5 flex-shrink-0"
        style={{ height: 40, background: "#0e0e0e", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: GR, fontWeight: 700, letterSpacing: "0.08em", fontSize: 13 }}>linuxlearn</span>
          <span style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: EX, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.1em" }}>
            EXPERT
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {LEVELS.map((lv, i) => (
            <div key={i} title={`Level ${i + 1}: ${lv.label}`} style={{
              width: 10, height: 10, borderRadius: "50%",
              background: lv.active ? EX : lv.done ? GR : "#2a2a2a",
              border: `1px solid ${lv.active ? EX : lv.done ? GR : "#3a3a3a"}`,
              boxShadow: lv.active ? `0 0 8px ${EX}66` : lv.done ? `0 0 4px ${GR}44` : "none",
            }} />
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Lesson Panel ── */}
        <div className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: "38%", background: "#111", borderRight: "1px solid #1e1e1e" }}>

          {/* Level Header */}
          <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid #1e1e1e", background: "#0f0d14" }}>
            <div style={{ fontSize: 10, color: EX, letterSpacing: "0.14em", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
              EXPERT LEVEL
            </div>
            <div style={{ fontSize: 15, color: "#e8e8e8", fontWeight: 600 }}>Networking &amp; System Tools</div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 5, letterSpacing: "0.04em" }}>
              ping · wget · curl · zip · unzip · df · du · sudo
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto" style={{ padding: "16px 20px" }}>

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: EX, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Description</div>
              <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.75, margin: 0 }}>
                Expert Linux means working with <span style={{ color: EX }}>network tools</span>, <span style={{ color: EX }}>file transfer</span>,{" "}
                <span style={{ color: EX }}>compression</span>, and <span style={{ color: EX }}>system administration</span>.
                These commands are used daily by sysadmins and DevOps engineers in production environments.
              </p>
            </div>

            {/* Objectives */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: EX, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                Objectives — {completedCount}/{objectives.length}
              </div>
              {/* Progress bar */}
              <div style={{ height: 2, background: "#1e1e1e", borderRadius: 2, marginBottom: 10 }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: `linear-gradient(90deg, ${GR}, ${EX})`,
                  borderRadius: 2, transition: "width 0.5s ease",
                }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {objectives.map((obj) => (
                  <div key={obj.id} style={{
                    borderRadius: 4, padding: "8px 12px", fontSize: 11, lineHeight: 1.6,
                    border: `1px solid ${obj.done ? EX : "#2a2a2a"}`,
                    background: obj.done ? "rgba(167,139,250,0.06)" : "#0d0d0d",
                    color: obj.done ? EX : "#9ca3af",
                    transition: "all 0.3s ease",
                  }}>
                    <span style={{ marginRight: 8 }}>{obj.done ? "✓" : "○"}</span>
                    <span dangerouslySetInnerHTML={{
                      __html: obj.text
                        .replace(/<code>/g, '<span style="color:#facc15">')
                        .replace(/<\/code>/g, "</span>"),
                    }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Hint */}
            <div style={{ marginBottom: 20 }}>
              <button
                style={{
                  width: "100%", textAlign: "left", fontSize: 11, fontFamily: "inherit",
                  border: `1px solid ${hintVisible ? "#facc15" : "#2a2a2a"}`,
                  color: hintVisible ? "#facc15" : "#555",
                  padding: "7px 12px", borderRadius: 4, background: "transparent",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onClick={(e) => { e.stopPropagation(); setHintVisible((v) => !v); }}
              >
                {hintVisible ? "[ hide hint ]" : "[ show hint ]"}
              </button>
              {hintVisible && (
                <div style={{ marginTop: 8, background: "#130f00", border: "1px solid #3a2800", borderRadius: 4, padding: "10px 14px", fontSize: 11, color: "#facc15", lineHeight: 2 }}>
                  <span style={{ color: "#fde68a" }}>ping google.com</span><br />
                  <span style={{ color: "#fde68a" }}>curl https://api.github.com</span><br />
                  <span style={{ color: "#fde68a" }}>wget https://example.com/file.zip</span><br />
                  <span style={{ color: "#fde68a" }}>zip out.zip documents/report.txt</span><br />
                  <span style={{ color: "#fde68a" }}>unzip out.zip</span><br />
                  <span style={{ color: "#fde68a" }}>df -h</span><br />
                  <span style={{ color: "#fde68a" }}>du -sh downloads/</span><br />
                  <span style={{ color: "#fde68a" }}>sudo apt update</span>
                </div>
              )}
            </div>

            {/* Commands */}
            <div>
              <div style={{ fontSize: 10, color: EX, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Commands</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {CMD_REF.map(([name, desc]) => {
                  const isExpert = EXPERT_CMDS.has(name);
                  return (
                    <div key={name} style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "baseline" }}>
                      <span style={{ color: isExpert ? EX : GR, fontWeight: 700, minWidth: 64 }}>{name}</span>
                      <span style={{ color: "#4b5563" }}>{desc}</span>
                      {isExpert && <span style={{ fontSize: 9, color: EX, opacity: 0.5 }}>★</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#2e2e2e" }}>★ expert commands for this level</div>
            </div>
          </div>
        </div>

        {/* ── Terminal ── */}
        <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: "#000" }}>
          {/* Title bar */}
          <div className="flex items-center justify-between flex-shrink-0"
            style={{ padding: "0 16px", height: 36, background: "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#ff5f57","#ffbd2e","#28c840"].map((bg, i) => (
                <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: bg }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: "#3a3a3a", letterSpacing: "0.05em" }}>bash — user@linux — Expert</span>
            <span />
          </div>

          {/* Output */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto"
            style={{ padding: "16px", paddingBottom: 8, display: "flex", flexDirection: "column", gap: 1, fontSize: 13, lineHeight: 1.6 }}
          >
            {lines.map((line, i) => {
              if (line.promptEcho) return (
                <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <span style={{ color: GR, fontWeight: 700 }}>user@linux</span>
                  <span style={{ color: "#444" }}>:</span>
                  <span style={{ color: "#60a5fa" }}>{line.promptEcho.path}</span>
                  <span style={{ color: "#444" }}>$</span>{" "}
                  <span style={{ color: "#e4e4e7" }}>{line.promptEcho.cmd}</span>
                </div>
              );
              if (line.lsRow) return (
                <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  {line.lsRow.map((entry, j) => (
                    <span key={j} style={{ color: entry.isDir ? "#93c5fd" : "#e4e4e7", fontWeight: entry.isDir ? 700 : 400 }}>{entry.text}</span>
                  ))}
                </div>
              );
              if (line.cmdRef) return (
                <div key={i} style={{ fontSize: 13 }}>
                  <span style={{ color: EXPERT_CMDS.has(line.cmdRef.name) ? EX : GR, display: "inline-block", minWidth: 80 }}>{line.cmdRef.name}</span>
                  <span style={{ color: "#333" }}> — </span>
                  <span style={{ color: "#555" }}>{line.cmdRef.desc}</span>
                </div>
              );
              return (
                <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", color: colorMap[line.cls] || "#d4d4d8" }}>
                  {line.text || "\u00A0"}
                </div>
              );
            })}
          </div>

          {/* Completion toast */}
          {toastVisible && (
            <div style={{
              position: "absolute", bottom: 72, right: 16, width: 272,
              background: "#0f0d14", border: `1px solid ${EX}`,
              borderRadius: 8, padding: "16px",
              boxShadow: `0 0 32px ${EX}22`, zIndex: 10,
              animation: "fadeUp 0.3s ease",
            }}>
              <div style={{ color: EX, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🏆 Expert Level Complete!</div>
              <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 12, lineHeight: 1.6 }}>
                You've mastered networking, archiving, and system admin tools. Outstanding work.
              </div>
              <button
                style={{
                  width: "100%", fontFamily: "inherit", border: "none", cursor: "pointer",
                  background: `linear-gradient(90deg, ${GR}, ${EX})`,
                  color: "#000", fontWeight: 700, fontSize: 12, padding: "8px 0", borderRadius: 4,
                }}
                onClick={() => alert("🎓 You've completed all levels! You are a Linux master.")}
              >
                Claim Certificate →
              </button>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center flex-shrink-0" style={{ padding: "8px 16px 16px", borderTop: "1px solid #111" }}>
            <span style={{ fontSize: 13, whiteSpace: "nowrap", flexShrink: 0, userSelect: "none" }}>
              <span style={{ color: GR, fontWeight: 700 }}>user@linux</span>
              <span style={{ color: "#444" }}>:</span>
              <span style={{ color: "#60a5fa" }}>{cwdDisplay(cwd)}</span>
              <span style={{ color: "#444" }}>$</span>
            </span>
            <input
              ref={inputRef}
              style={{ background: "transparent", border: "none", outline: "none", fontFamily: "inherit", fontSize: 13, color: "#e4e4e7", flex: 1, caretColor: EX, marginLeft: 8 }}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} autoFocus
            />
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
      `}</style>
    </div>
  );
}
