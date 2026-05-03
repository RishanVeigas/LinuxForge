"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── Fake network data ── */
const FAKE_NET = {
  interfaces: {
    eth0: {
      state: "UP",
      mac: "52:54:00:ab:cd:ef",
      ip4: "192.168.1.42",
      mask: "255.255.255.0",
      ip6: "fe80::5054:ff:feab:cdef",
      rx_bytes: 14823412,
      tx_bytes: 3920185,
      rx_packets: 98432,
      tx_packets: 61024,
    },
    lo: {
      state: "UNKNOWN",
      mac: "00:00:00:00:00:00",
      ip4: "127.0.0.1",
      mask: "255.0.0.0",
      ip6: "::1",
      rx_bytes: 204800,
      tx_bytes: 204800,
      rx_packets: 2048,
      tx_packets: 2048,
    },
    wlan0: {
      state: "DOWN",
      mac: "dc:a6:32:11:22:33",
      ip4: null,
      mask: null,
      ip6: null,
      rx_bytes: 0,
      tx_bytes: 0,
      rx_packets: 0,
      tx_packets: 0,
    },
  },
  routes: [
    { dest: "default", gw: "192.168.1.1", iface: "eth0", metric: 100 },
    { dest: "192.168.1.0/24", gw: "0.0.0.0", iface: "eth0", metric: 0 },
    { dest: "127.0.0.0/8", gw: "0.0.0.0", iface: "lo", metric: 0 },
  ],
  sockets: [
    { proto: "tcp", local: "0.0.0.0:22", foreign: "0.0.0.0:*", state: "LISTEN", pid: "812/sshd" },
    { proto: "tcp", local: "0.0.0.0:80", foreign: "0.0.0.0:*", state: "LISTEN", pid: "1024/nginx" },
    { proto: "tcp", local: "0.0.0.0:443", foreign: "0.0.0.0:*", state: "LISTEN", pid: "1024/nginx" },
    { proto: "tcp", local: "192.168.1.42:22", foreign: "192.168.1.10:54321", state: "ESTABLISHED", pid: "2201/sshd" },
    { proto: "tcp", local: "192.168.1.42:43210", foreign: "142.250.80.46:443", state: "ESTABLISHED", pid: "3301/curl" },
    { proto: "udp", local: "0.0.0.0:68", foreign: "0.0.0.0:*", state: "", pid: "500/dhclient" },
    { proto: "udp", local: "0.0.0.0:53", foreign: "0.0.0.0:*", state: "", pid: "611/dnsmasq" },
  ],
  dns: {
    "google.com": { A: ["142.250.80.46", "142.250.80.78"], MX: ["alt1.aspmx.l.google.com"], NS: ["ns1.google.com", "ns2.google.com"], TTL: 300 },
    "example.com": { A: ["93.184.216.34"], MX: ["mail.example.com"], NS: ["a.iana-servers.net"], TTL: 86400 },
    "github.com": { A: ["140.82.121.4"], MX: [], NS: ["ns-421.awsdns-52.com"], TTL: 3600 },
    "localhost": { A: ["127.0.0.1"], MX: [], NS: [], TTL: 0 },
  },
  whois: {
    "google.com": "Domain Name: GOOGLE.COM\nRegistrar: MarkMonitor Inc.\nRegistrant: Google LLC\nCreated: 1997-09-15\nExpires: 2028-09-14",
    "example.com": "Domain Name: EXAMPLE.COM\nRegistrar: ICANN\nRegistrant: IANA\nCreated: 1995-08-14\nExpires: 2025-08-13",
  },
};

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(1)} MiB`;
}

function randMs(base, spread) {
  return (base + (Math.random() * spread - spread / 2)).toFixed(3);
}

function randTTL() {
  return Math.floor(Math.random() * 200) + 40;
}

function fakeIP() {
  const pools = ["10.0.0.", "172.16.", "192.168.0.", "203.0.113."];
  const p = pools[Math.floor(Math.random() * pools.length)];
  return p + Math.floor(Math.random() * 254 + 1);
}

/* ── Objectives ── */
const OBJECTIVES = [
  {
    id: "ip_addr",
    label: "Inspect interfaces with ip addr",
    desc: "Use ip addr (or ip a) to list all network interfaces with their IP addresses.",
    hint: "ip addr",
    validate: (_cwd, hist) =>
      hist.some((h) => /^ip\s+(addr|a|address)(\s|$)/.test(h.trim())),
    successMsg:
      "ip addr shows every interface, its state (UP/DOWN), MAC address, IPv4 (inet) and IPv6 (inet6) addresses. Replaces the older ifconfig.",
  },
  {
    id: "ifconfig",
    label: "Use legacy ifconfig",
    desc: "Run ifconfig to see the older-style interface listing. Try ifconfig eth0 to see a specific interface.",
    hint: "ifconfig",
    validate: (_cwd, hist) =>
      hist.some((h) => /^ifconfig(\s|$)/.test(h.trim())),
    successMsg:
      "ifconfig is from net-tools; still common on older systems. ip is the modern replacement but ifconfig remains widely used for quick checks.",
  },
  {
    id: "ping_cmd",
    label: "Test connectivity with ping",
    desc: "Use ping to test reachability. Try: ping google.com  or  ping -c 4 8.8.8.8",
    hint: "ping -c 4 google.com",
    validate: (_cwd, hist) =>
      hist.some((h) => /^ping\s+\S+/.test(h.trim())),
    successMsg:
      "ping sends ICMP echo requests and measures RTT. -c N limits count, -i sets interval. RTT and packet loss tell you if the host is reachable.",
  },
  {
    id: "traceroute_cmd",
    label: "Trace network path with traceroute",
    desc: "Use traceroute (or tracepath) to show each hop between you and a remote host.",
    hint: "traceroute google.com",
    validate: (_cwd, hist) =>
      hist.some((h) => /^(traceroute|tracepath)\s+\S+/.test(h.trim())),
    successMsg:
      "traceroute increases TTL from 1 upward, recording each router that drops the packet. * means no ICMP response. Shows latency per hop.",
  },
  {
    id: "dig_cmd",
    label: "Query DNS with dig",
    desc: "Use dig to look up DNS records. Try: dig google.com  or  dig MX google.com  or  dig @8.8.8.8 example.com",
    hint: "dig google.com",
    validate: (_cwd, hist) =>
      hist.some((h) => /^dig\s+\S+/.test(h.trim())),
    successMsg:
      "dig (Domain Information Groper) queries DNS servers. dig TYPE domain queries specific record types (A, MX, NS, TXT, CNAME). The ANSWER SECTION shows the result.",
  },
  {
    id: "ss_cmd",
    label: "List open sockets with ss",
    desc: "Use ss to inspect socket state. Try: ss -tuln  (tcp+udp, listening, numeric)",
    hint: "ss -tuln",
    validate: (_cwd, hist) =>
      hist.some((h) => /^ss(\s|$)/.test(h.trim())),
    successMsg:
      "ss (socket statistics) replaces netstat. -t tcp, -u udp, -l listening only, -n numeric ports, -p show process. Faster than netstat on large systems.",
  },
  {
    id: "curl_cmd",
    label: "Transfer data with curl",
    desc: "Use curl to fetch a URL. Try: curl https://example.com  or  curl -I https://google.com  (headers only)",
    hint: "curl -I https://example.com",
    validate: (_cwd, hist) =>
      hist.some((h) => /^curl\s+\S+/.test(h.trim())),
    successMsg:
      "curl transfers data with many protocols. -I fetches headers only, -o saves to file, -L follows redirects, -X sets HTTP method, -H adds headers.",
  },
  {
    id: "nmap_cmd",
    label: "Scan ports with nmap",
    desc: "Use nmap to scan open ports. Try: nmap localhost  or  nmap -p 22,80,443 192.168.1.1",
    hint: "nmap localhost",
    validate: (_cwd, hist) =>
      hist.some((h) => /^nmap\s+\S+/.test(h.trim())),
    successMsg:
      "nmap is the premier port scanner. -p specifies ports, -sV detects service versions, -O OS detection, -A aggressive scan. Always get permission before scanning.",
  },
  {
    id: "ssh_cmd",
    label: "Connect remotely with ssh",
    desc: "Use ssh to initiate a remote connection. Try: ssh user@192.168.1.1  or see ssh options with ssh -v",
    hint: "ssh user@192.168.1.1",
    validate: (_cwd, hist) =>
      hist.some((h) => /^ssh\s+\S+/.test(h.trim())),
    successMsg:
      "SSH encrypts the entire session. -i specifies a key file, -p sets port, -L local port forwarding, -R remote port forwarding, -D SOCKS proxy.",
  },
  {
    id: "nc_cmd",
    label: "Use the Swiss Army knife: nc (netcat)",
    desc: "Use nc to open raw TCP/UDP connections. Try: nc -zv google.com 443  (port check) or nc -l 8080 (listen)",
    hint: "nc -zv google.com 443",
    validate: (_cwd, hist) =>
      hist.some((h) => /^nc\s+\S+/.test(h.trim())),
    successMsg:
      "nc (netcat) creates raw TCP/UDP connections. -z scan without sending data, -v verbose, -l listen mode, -u UDP mode. Useful for debugging and quick transfers.",
  },
];

const LESSONS_NAV = [
  { level: "07", title: "Process Management", status: "done", href: "/learn/intermediate/level-7" },
  { level: "08", title: "Permissions & Users", status: "done", href: "/learn/expert/level-8" },
  { level: "09", title: "Networking Basics", status: "active", href: "/learn/expert/level-9" },
  { level: "10", title: "Shell Scripting I", status: "locked", href: "#" },
  { level: "11", title: "Advanced Text Tools", status: "locked", href: "#" },
  { level: "12", title: "Containers & VMs", status: "locked", href: "#" },
];

const LESSON = {
  level: "09",
  track: "expert",
  title: "Networking Basics",
  module: "module_05 — expert",
  description: [
    { text: "Linux networking is built on layers of tools. " },
    { text: "ip", code: true },
    { text: " and " },
    { text: "ifconfig", code: true },
    { text: " inspect interfaces. " },
    { text: "ping", code: true },
    { text: ", " },
    { text: "traceroute", code: true },
    { text: ", and " },
    { text: "mtr", code: true },
    { text: " probe connectivity. " },
    { text: "dig", code: true },
    { text: " and " },
    { text: "nslookup", code: true },
    { text: " query DNS. " },
    { text: "ss", code: true },
    { text: " and " },
    { text: "netstat", code: true },
    { text: " show open sockets. " },
    { text: "curl", code: true },
    { text: ", " },
    { text: "wget", code: true },
    { text: " transfer data. " },
    { text: "nmap", code: true },
    { text: " scans ports. " },
    { text: "ssh", code: true },
    { text: " and " },
    { text: "nc", code: true },
    { text: " handle remote access and raw connections." },
  ],
  commands: [
    { name: "ip addr / ip a", desc: "list interfaces & IPs" },
    { name: "ip route / ip r", desc: "show routing table" },
    { name: "ip link", desc: "show link-layer info" },
    { name: "ifconfig [iface]", desc: "legacy interface listing" },
    { name: "hostname [-I]", desc: "show hostname / all IPs" },
    { name: "ping -c N <host>", desc: "ICMP reachability test" },
    { name: "traceroute <host>", desc: "show hop-by-hop path" },
    { name: "tracepath <host>", desc: "traceroute without root" },
    { name: "mtr <host>", desc: "live ping + traceroute" },
    { name: "dig [TYPE] <host>", desc: "DNS lookup" },
    { name: "nslookup <host>", desc: "simple DNS query" },
    { name: "host <host>", desc: "compact DNS lookup" },
    { name: "whois <domain>", desc: "domain registration info" },
    { name: "ss -tuln", desc: "open sockets (modern)" },
    { name: "netstat -tuln", desc: "open sockets (legacy)" },
    { name: "lsof -i", desc: "list open network files" },
    { name: "tcpdump -i eth0", desc: "capture packets" },
    { name: "curl -I <url>", desc: "HTTP headers only" },
    { name: "wget <url>", desc: "download file" },
    { name: "nmap <host>", desc: "port scanner" },
    { name: "nmap -p 80,443 <h>", desc: "scan specific ports" },
    { name: "ssh user@host", desc: "remote shell (encrypted)" },
    { name: "scp src user@h:dst", desc: "secure copy" },
    { name: "rsync -avz src dst", desc: "sync files over SSH" },
    { name: "sftp user@host", desc: "secure FTP session" },
    { name: "nc -zv host port", desc: "netcat port probe" },
    { name: "nc -l 8080", desc: "netcat listen mode" },
    { name: "iperf -s / -c host", desc: "bandwidth measurement" },
  ],
  xp: 300,
  nextLevel: "/expert/level-10",
};

/* ── Output renderer ── */
function OutputLine({ line }) {
  const colorMap = {
    green: "text-[#00e5ff]",
    cyan: "text-[#00bcd4]",
    yellow: "text-[#ffd740]",
    red: "text-[#ff5252]",
    dim: "text-[#37474f]",
    white: "text-[#cfd8dc]",
    blue: "text-[#40c4ff]",
    purple: "text-[#b388ff]",
    orange: "text-[#ffab40]",
    teal: "text-[#64ffda]",
  };
  const cls = colorMap[line.color] || "text-[#78909c]";

  if (line.type === "prompt") {
    return (
      <div className="flex items-center gap-1 font-mono text-[13px] leading-relaxed">
        <span className="font-bold text-[#00e5ff]">user</span>
        <span className="text-[#1c2a2e]">@</span>
        <span className="text-[#00e5ff] font-bold">netlab</span>
        <span className="text-[#1c2a2e]">:</span>
        <span className="text-[#40c4ff]">{line.path}</span>
        <span className="text-[#263238]">$</span>
        <span className="text-[#cfd8dc] ml-1">{line.cmd}</span>
      </div>
    );
  }

  if (line.type === "obj-complete") {
    return (
      <div className="flex items-start gap-2 bg-[#00151a] border border-[#00e5ff]/20 rounded px-3 py-2 my-1">
        <span className="text-[#00e5ff] text-[13px] mt-[1px]">✓</span>
        <div>
          <div className="text-[12px] text-[#00e5ff] font-bold">{line.label}</div>
          <div className="text-[11px] text-[#37474f] mt-0.5 leading-relaxed">{line.msg}</div>
        </div>
      </div>
    );
  }

  if (line.type === "iface-block") {
    const { name, iface } = line;
    const stateColor = iface.state === "UP" ? "#00e5ff" : iface.state === "DOWN" ? "#ff5252" : "#ffd740";
    return (
      <div className="font-mono text-[12px] leading-[1.75] mb-1">
        <div>
          <span className="text-[#ffd740] font-bold">{name}</span>
          <span className="text-[#37474f]">: flags=</span>
          <span className="text-[#40c4ff]">4163&lt;UP,BROADCAST,RUNNING,MULTICAST&gt;</span>
          <span className="text-[#37474f]">  mtu 1500</span>
        </div>
        {iface.ip4 && (
          <div className="pl-8">
            <span className="text-[#78909c]">inet </span>
            <span className="text-[#00e5ff]">{iface.ip4}</span>
            <span className="text-[#37474f]">  netmask </span>
            <span className="text-[#78909c]">{iface.mask}</span>
            <span className="text-[#37474f]">  broadcast </span>
            <span className="text-[#78909c]">192.168.1.255</span>
          </div>
        )}
        {iface.ip6 && (
          <div className="pl-8">
            <span className="text-[#78909c]">inet6 </span>
            <span className="text-[#40c4ff]">{iface.ip6}</span>
            <span className="text-[#37474f]">  prefixlen 64  scopeid 0x20&lt;link&gt;</span>
          </div>
        )}
        <div className="pl-8">
          <span className="text-[#78909c]">ether </span>
          <span className="text-[#b388ff]">{iface.mac}</span>
          <span className="text-[#37474f]">  txqueuelen 1000  (Ethernet)</span>
        </div>
        <div className="pl-8">
          <span className="text-[#37474f]">RX packets </span>
          <span className="text-[#64ffda]">{iface.rx_packets.toLocaleString()}</span>
          <span className="text-[#37474f]">  bytes </span>
          <span className="text-[#64ffda]">{fmtBytes(iface.rx_bytes)}</span>
        </div>
        <div className="pl-8">
          <span className="text-[#37474f]">TX packets </span>
          <span className="text-[#64ffda]">{iface.tx_packets.toLocaleString()}</span>
          <span className="text-[#37474f]">  bytes </span>
          <span className="text-[#64ffda]">{fmtBytes(iface.tx_bytes)}</span>
        </div>
        <div className="pl-8">
          <span className="text-[#37474f]">state </span>
          <span style={{ color: stateColor }} className="font-bold">{iface.state}</span>
        </div>
      </div>
    );
  }

  if (line.type === "ip-addr-block") {
    const { idx, name, iface } = line;
    const stateColor = iface.state === "UP" ? "#00e5ff" : iface.state === "DOWN" ? "#ff5252" : "#ffd740";
    return (
      <div className="font-mono text-[12px] leading-[1.75] mb-1">
        <div>
          <span className="text-[#ffd740]">{idx}: </span>
          <span className="text-[#00e5ff] font-bold">{name}</span>
          <span className="text-[#37474f]">: &lt;BROADCAST,MULTICAST,</span>
          <span style={{ color: stateColor }}>{iface.state === "UP" ? "UP" : "DOWN"}</span>
          <span className="text-[#37474f]">&gt; mtu 1500 qdisc pfifo_fast state </span>
          <span style={{ color: stateColor }} className="font-bold">{iface.state}</span>
          <span className="text-[#37474f]"> group default qlen 1000</span>
        </div>
        <div className="pl-4">
          <span className="text-[#78909c]">link/ether </span>
          <span className="text-[#b388ff]">{iface.mac}</span>
          <span className="text-[#37474f]"> brd ff:ff:ff:ff:ff:ff</span>
        </div>
        {iface.ip4 && (
          <div className="pl-4">
            <span className="text-[#78909c]">inet </span>
            <span className="text-[#00e5ff]">{iface.ip4}/24</span>
            <span className="text-[#37474f]"> brd 192.168.1.255 scope global dynamic eth0</span>
          </div>
        )}
        {iface.ip6 && (
          <div className="pl-4">
            <span className="text-[#78909c]">inet6 </span>
            <span className="text-[#40c4ff]">{iface.ip6}/64</span>
            <span className="text-[#37474f]"> scope link</span>
          </div>
        )}
      </div>
    );
  }

  if (line.type === "ping-output") {
    const { host, ip, lines: pLines } = line;
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#ffd740]">PING</span> <span className="text-[#00e5ff]">{host}</span> <span className="text-[#37474f]">({ip}) 56(84) bytes of data.</span></div>
        {pLines.map((pl, i) => (
          <div key={i}>
            <span className="text-[#37474f]">64 bytes from </span>
            <span className="text-[#40c4ff]">{host} ({ip})</span>
            <span className="text-[#37474f]">: icmp_seq={i + 1} ttl={randTTL()} time=</span>
            <span className="text-[#64ffda]">{pl} ms</span>
          </div>
        ))}
        <div className="mt-1 text-[#37474f]">--- {host} ping statistics ---</div>
        <div>
          <span className="text-[#64ffda]">{pLines.length} packets transmitted</span>
          <span className="text-[#37474f]">, </span>
          <span className="text-[#64ffda]">{pLines.length} received</span>
          <span className="text-[#37474f]">, </span>
          <span className="text-[#00e5ff]">0% packet loss</span>
        </div>
        <div>
          <span className="text-[#37474f]">rtt min/avg/max/mdev = </span>
          <span className="text-[#ffd740]">{Math.min(...pLines.map(Number)).toFixed(3)}/{(pLines.reduce((a, b) => a + Number(b), 0) / pLines.length).toFixed(3)}/{Math.max(...pLines.map(Number)).toFixed(3)}/0.087 ms</span>
        </div>
      </div>
    );
  }

  if (line.type === "traceroute-output") {
    const { host } = line;
    const hops = [
      { n: 1, ip: "192.168.1.1", host: "_gateway", ms: [randMs(1, 0.5), randMs(1, 0.5), randMs(1, 0.5)] },
      { n: 2, ip: "10.10.0.1", host: "isp-gw.local", ms: [randMs(8, 2), randMs(8, 2), randMs(8, 2)] },
      { n: 3, ip: "203.0.113.1", host: "core-r1.isp.net", ms: [randMs(15, 3), randMs(15, 3), randMs(15, 3)] },
      { n: 4, ip: "*", host: null, ms: null },
      { n: 5, ip: "209.85.142.53", host: "72.14.238.52", ms: [randMs(25, 5), randMs(25, 5), randMs(25, 5)] },
      { n: 6, ip: "142.250.80.46", host: `${host}`, ms: [randMs(30, 3), randMs(30, 3), randMs(30, 3)] },
    ];
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#ffd740]">traceroute to</span> <span className="text-[#00e5ff]">{host}</span> <span className="text-[#37474f]">(142.250.80.46), 30 hops max, 60 byte packets</span></div>
        {hops.map((h) => (
          <div key={h.n} className="flex gap-2">
            <span className="text-[#37474f] min-w-[20px] text-right">{h.n}</span>
            {h.ip === "*" ? (
              <span className="text-[#ff5252]">* * *</span>
            ) : (
              <>
                <span className="text-[#40c4ff]">{h.host || h.ip}</span>
                <span className="text-[#37474f]">({h.ip})</span>
                {h.ms.map((m, i) => <span key={i} className="text-[#64ffda]"> {m} ms</span>)}
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (line.type === "dig-output") {
    const { host, qtype, data } = line;
    const rec = data?.A?.[0] || "NXDOMAIN";
    const answers = qtype === "MX" ? (data?.MX || []) : qtype === "NS" ? (data?.NS || []) : (data?.A || []);
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#37474f]">; &lt;&lt;&gt;&gt; DiG 9.18.1 &lt;&lt;&gt;&gt; {qtype !== "A" ? qtype + " " : ""}{host}</div>
        <div className="text-[#37474f]">;; global options: +cmd</div>
        <div className="text-[#37474f]">;; Got answer:</div>
        <div className="text-[#37474f]">;; -&gt;&gt;HEADER&lt;&lt;- opcode: QUERY, status: NOERROR, id: {Math.floor(Math.random()*65535)}</div>
        <div className="text-[#37474f]">;; flags: qr rd ra; QUERY: 1, ANSWER: {answers.length}, AUTHORITY: 0, ADDITIONAL: 0</div>
        <div className="mt-1 text-[#ffd740]">;; QUESTION SECTION:</div>
        <div><span className="text-[#78909c]">;{host}.</span><span className="text-[#37474f]">                IN      {qtype || "A"}</span></div>
        {answers.length > 0 && <div className="mt-1 text-[#ffd740]">;; ANSWER SECTION:</div>}
        {answers.map((a, i) => (
          <div key={i}>
            <span className="text-[#00e5ff]">{host}.</span>
            <span className="text-[#37474f]">           {data?.TTL || 300}    IN      {qtype || "A"}     </span>
            <span className="text-[#64ffda]">{a}</span>
          </div>
        ))}
        <div className="mt-1 text-[#37474f]">;; Query time: {Math.floor(Math.random()*50)+5} msec</div>
        <div className="text-[#37474f]">;; SERVER: 8.8.8.8#53(8.8.8.8)</div>
        <div className="text-[#37474f]">;; MSG SIZE  rcvd: {Math.floor(Math.random()*100)+60}</div>
      </div>
    );
  }

  if (line.type === "nslookup-output") {
    const { host, data } = line;
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#37474f]">Server:         </span><span className="text-[#40c4ff]">8.8.8.8</span></div>
        <div><span className="text-[#37474f]">Address:        </span><span className="text-[#40c4ff]">8.8.8.8#53</span></div>
        <div className="mt-1"><span className="text-[#37474f]">Non-authoritative answer:</span></div>
        <div><span className="text-[#37474f]">Name:   </span><span className="text-[#00e5ff]">{host}</span></div>
        {(data?.A || []).map((a, i) => (
          <div key={i}><span className="text-[#37474f]">Address: </span><span className="text-[#64ffda]">{a}</span></div>
        ))}
      </div>
    );
  }

  if (line.type === "ss-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="flex gap-3 text-[#37474f] border-b border-[#0d1f24] pb-0.5 mb-1">
          <span className="min-w-[40px]">Netid</span>
          <span className="min-w-[64px]">State</span>
          <span className="min-w-[160px]">Local Address:Port</span>
          <span className="min-w-[160px]">Peer Address:Port</span>
          <span>Process</span>
        </div>
        {line.sockets.map((s, i) => {
          const stateColor = s.state === "LISTEN" ? "#ffd740" : s.state === "ESTABLISHED" ? "#00e5ff" : "#78909c";
          return (
            <div key={i} className="flex gap-3">
              <span className="min-w-[40px] text-[#40c4ff]">{s.proto}</span>
              <span className="min-w-[64px]" style={{ color: stateColor }}>{s.state || "    "}</span>
              <span className="min-w-[160px] text-[#64ffda]">{s.local}</span>
              <span className="min-w-[160px] text-[#37474f]">{s.foreign}</span>
              <span className="text-[#78909c]">{s.pid}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (line.type === "curl-output") {
    const { url, headersOnly, content } = line;
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        {headersOnly ? (
          <>
            <div><span className="text-[#00e5ff] font-bold">HTTP/2 200</span></div>
            <div><span className="text-[#37474f]">content-type: </span><span className="text-[#64ffda]">text/html; charset=UTF-8</span></div>
            <div><span className="text-[#37474f]">server: </span><span className="text-[#64ffda]">nginx/1.24.0</span></div>
            <div><span className="text-[#37474f]">content-length: </span><span className="text-[#64ffda]">1256</span></div>
            <div><span className="text-[#37474f]">cache-control: </span><span className="text-[#64ffda]">max-age=3600</span></div>
            <div><span className="text-[#37474f]">x-content-type-options: </span><span className="text-[#64ffda]">nosniff</span></div>
          </>
        ) : (
          <div className="text-[#78909c] whitespace-pre-wrap">{content}</div>
        )}
      </div>
    );
  }

  if (line.type === "wget-output") {
    const { url, filename } = line;
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#37474f]">--2026-05-03 09:22:14--  </span><span className="text-[#00e5ff]">{url}</span></div>
        <div><span className="text-[#37474f]">Resolving </span><span className="text-[#40c4ff]">example.com</span><span className="text-[#37474f]">... </span><span className="text-[#64ffda]">93.184.216.34</span></div>
        <div><span className="text-[#37474f]">Connecting to example.com (93.184.216.34)|port 80|... connected.</span></div>
        <div><span className="text-[#37474f]">HTTP request sent, awaiting response... </span><span className="text-[#00e5ff]">200 OK</span></div>
        <div><span className="text-[#37474f]">Length: 1256 (1.2K) [text/html]</span></div>
        <div><span className="text-[#37474f]">Saving to: '</span><span className="text-[#ffd740]">{filename}</span><span className="text-[#37474f]">'</span></div>
        <div className="text-[#64ffda]">{filename}                    100%[====================================================&gt;]   1.23K  --.-KB/s    in 0.001s</div>
        <div><span className="text-[#37474f]">2026-05-03 09:22:14 (1.23 MB/s) - '</span><span className="text-[#ffd740]">{filename}</span><span className="text-[#37474f]">' saved [1256/1256]</span></div>
      </div>
    );
  }

  if (line.type === "nmap-output") {
    const { host, ip } = line;
    const ports = [
      { port: 22, state: "open", service: "ssh", version: "OpenSSH 8.9p1" },
      { port: 80, state: "open", service: "http", version: "nginx 1.24.0" },
      { port: 443, state: "open", service: "https", version: "nginx 1.24.0" },
      { port: 3306, state: "filtered", service: "mysql", version: "" },
      { port: 8080, state: "closed", service: "http-proxy", version: "" },
    ];
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#37474f]">Starting Nmap 7.94 ( https://nmap.org ) at 2026-05-03 09:22 UTC</div>
        <div><span className="text-[#37474f]">Nmap scan report for </span><span className="text-[#00e5ff]">{host}</span><span className="text-[#37474f]"> ({ip})</span></div>
        <div><span className="text-[#37474f]">Host is up (</span><span className="text-[#64ffda]">0.0042s latency</span><span className="text-[#37474f]">).</span></div>
        <div className="mt-1 flex gap-3 text-[#37474f] border-b border-[#0d1f24] pb-0.5">
          <span className="min-w-[80px]">PORT</span>
          <span className="min-w-[64px]">STATE</span>
          <span className="min-w-[80px]">SERVICE</span>
          <span>VERSION</span>
        </div>
        {ports.map((p) => {
          const stateColor = p.state === "open" ? "#00e5ff" : p.state === "filtered" ? "#ffd740" : "#ff5252";
          return (
            <div key={p.port} className="flex gap-3">
              <span className="min-w-[80px] text-[#40c4ff]">{p.port}/tcp</span>
              <span className="min-w-[64px]" style={{ color: stateColor }}>{p.state}</span>
              <span className="min-w-[80px] text-[#78909c]">{p.service}</span>
              <span className="text-[#64ffda]">{p.version}</span>
            </div>
          );
        })}
        <div className="mt-1 text-[#37474f]">Nmap done: 1 IP address (1 host up) scanned in 2.34 seconds</div>
      </div>
    );
  }

  if (line.type === "ssh-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#37474f]">The authenticity of host '{line.host}' can't be established.</div>
        <div><span className="text-[#37474f]">ED25519 key fingerprint is </span><span className="text-[#b388ff]">SHA256:HbW3g8zUjNSksFbqTiUWPWg2Bf1TseUYGBLLXGvPxAE</span></div>
        <div className="text-[#ffd740]">Are you sure you want to continue connecting? (Simulated — not actually connecting)</div>
        <div className="text-[#37474f]">Warning: Permanently added '{line.host}' (ED25519) to the list of known hosts.</div>
        <div><span className="text-[#00e5ff]">{line.user}@{line.host}</span><span className="text-[#37474f]">'s password: </span><span className="text-[#37474f]">[sandbox: connection simulated]</span></div>
      </div>
    );
  }

  if (line.type === "nc-output") {
    const { host, port, mode } = line;
    if (mode === "scan") {
      const open = [443, 80, 22].includes(Number(port));
      return (
        <div className="font-mono text-[12px]">
          <span className="text-[#37474f]">Connection to </span>
          <span className="text-[#40c4ff]">{host}</span>
          <span className="text-[#37474f]"> {port} port [tcp/*] </span>
          {open ? <span className="text-[#00e5ff] font-bold">succeeded!</span> : <span className="text-[#ff5252]">failed: Connection refused</span>}
        </div>
      );
    }
    if (mode === "listen") {
      return (
        <div className="font-mono text-[12px]">
          <span className="text-[#ffd740]">Listening on 0.0.0.0:{port}</span>
          <span className="text-[#37474f]"> (sandbox: press Enter to simulate close)</span>
        </div>
      );
    }
    return null;
  }

  if (line.type === "lsof-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="flex gap-3 text-[#37474f] border-b border-[#0d1f24] pb-0.5 mb-1">
          <span className="min-w-[80px]">COMMAND</span>
          <span className="min-w-[40px]">PID</span>
          <span className="min-w-[56px]">USER</span>
          <span className="min-w-[32px]">FD</span>
          <span className="min-w-[32px]">TYPE</span>
          <span>NAME</span>
        </div>
        {[
          { cmd: "sshd", pid: 812, user: "root", fd: "3u", type: "IPv4", name: "*:22 (LISTEN)" },
          { cmd: "nginx", pid: 1024, user: "www-data", fd: "5u", type: "IPv4", name: "*:80 (LISTEN)" },
          { cmd: "nginx", pid: 1024, user: "www-data", fd: "6u", type: "IPv4", name: "*:443 (LISTEN)" },
          { cmd: "curl", pid: 3301, user: "user", fd: "4u", type: "IPv4", name: "192.168.1.42:43210->142.250.80.46:443 (ESTABLISHED)" },
        ].map((r, i) => (
          <div key={i} className="flex gap-3">
            <span className="min-w-[80px] text-[#ffd740]">{r.cmd}</span>
            <span className="min-w-[40px] text-[#40c4ff]">{r.pid}</span>
            <span className="min-w-[56px] text-[#78909c]">{r.user}</span>
            <span className="min-w-[32px] text-[#37474f]">{r.fd}</span>
            <span className="min-w-[32px] text-[#37474f]">{r.type}</span>
            <span className="text-[#64ffda]">{r.name}</span>
          </div>
        ))}
      </div>
    );
  }

  if (line.type === "tcpdump-output") {
    const iface = line.iface || "eth0";
    const entries = [
      `09:22:15.123456 IP 192.168.1.42.43210 > 142.250.80.46.443: Flags [S], seq 0, win 65535`,
      `09:22:15.153789 IP 142.250.80.46.443 > 192.168.1.42.43210: Flags [S.], seq 0, ack 1, win 64240`,
      `09:22:15.153802 IP 192.168.1.42.43210 > 142.250.80.46.443: Flags [.], ack 1, win 65535`,
      `09:22:15.200011 IP 192.168.1.42.43210 > 142.250.80.46.443: Flags [P.], length 517`,
      `09:22:15.231445 IP 142.250.80.46.443 > 192.168.1.42.43210: Flags [.], ack 518, win 64240`,
    ];
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#ffd740]">tcpdump</span><span className="text-[#37474f]">: verbose output suppressed, use -v[v]... for full protocol decode</span></div>
        <div><span className="text-[#37474f]">listening on </span><span className="text-[#00e5ff]">{iface}</span><span className="text-[#37474f]">, link-type EN10MB (Ethernet), snapshot length 262144 bytes</span></div>
        {entries.map((e, i) => (
          <div key={i} className="text-[#78909c]">
            <span className="text-[#37474f]">{e.split(" IP ")[0]} IP </span>
            <span className="text-[#64ffda]">{e.split(" IP ")[1]}</span>
          </div>
        ))}
        <div className="text-[#37474f] mt-1">^C</div>
        <div><span className="text-[#64ffda]">5 packets captured</span><span className="text-[#37474f]">, 5 packets received by filter, 0 packets dropped by kernel</span></div>
      </div>
    );
  }

  if (line.type === "mtr-output") {
    const { host } = line;
    const hops = [
      { n: 1, host: "_gateway", loss: "0.0%", avg: randMs(1, 0.3) },
      { n: 2, host: "isp-gw.local", loss: "0.0%", avg: randMs(8, 2) },
      { n: 3, host: "core-r1.isp.net", loss: "0.0%", avg: randMs(15, 3) },
      { n: 4, host: "???", loss: "100.0%", avg: "—" },
      { n: 5, host: "72.14.238.52", loss: "0.0%", avg: randMs(25, 5) },
      { n: 6, host, loss: "0.0%", avg: randMs(30, 3) },
    ];
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#37474f]">Start: 2026-05-03T09:22:00+0000</span></div>
        <div><span className="text-[#ffd740]">HOST: netlab                      Loss%   Avg</span></div>
        {hops.map((h) => (
          <div key={h.n} className="flex gap-3">
            <span className="text-[#37474f] min-w-[20px]">{h.n}.</span>
            <span className="text-[#40c4ff] min-w-[220px]">{h.host}</span>
            <span className={`min-w-[60px] ${h.loss === "100.0%" ? "text-[#ff5252]" : "text-[#64ffda]"}`}>{h.loss}</span>
            <span className="text-[#ffd740]">{h.avg}</span>
          </div>
        ))}
      </div>
    );
  }

  if (line.type === "route-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="flex gap-4 text-[#37474f] border-b border-[#0d1f24] pb-0.5 mb-1">
          <span className="min-w-[140px]">Destination</span>
          <span className="min-w-[120px]">Gateway</span>
          <span className="min-w-[80px]">Iface</span>
          <span>Metric</span>
        </div>
        {FAKE_NET.routes.map((r, i) => (
          <div key={i} className="flex gap-4">
            <span className="min-w-[140px] text-[#00e5ff]">{r.dest}</span>
            <span className="min-w-[120px] text-[#40c4ff]">{r.gw}</span>
            <span className="min-w-[80px] text-[#ffd740]">{r.iface}</span>
            <span className="text-[#37474f]">{r.metric}</span>
          </div>
        ))}
      </div>
    );
  }

  if (line.type === "whois-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75] text-[#78909c] whitespace-pre-wrap">{line.content}</div>
    );
  }

  if (line.type === "iperf-output") {
    const { mode } = line;
    if (mode === "server") {
      return (
        <div className="font-mono text-[12px] leading-[1.75]">
          <div><span className="text-[#37474f]">-----------------------------------------------------------</span></div>
          <div><span className="text-[#ffd740]">Server listening on 5201 (TCP)</span></div>
          <div><span className="text-[#37474f]">-----------------------------------------------------------</span></div>
          <div className="text-[#37474f]">[sandbox: iperf server mode simulated — use iperf -c host to connect]</div>
        </div>
      );
    }
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#37474f]">Connecting to host </span><span className="text-[#00e5ff]">{line.host}</span><span className="text-[#37474f]">, port 5201</span></div>
        <div className="text-[#37474f]">[  5] local 192.168.1.42 port 45678 connected to {line.host} port 5201</div>
        <div className="flex gap-3 text-[#37474f] mt-1">
          <span className="min-w-[40px]">[ ID]</span>
          <span className="min-w-[120px]">Interval</span>
          <span className="min-w-[80px]">Transfer</span>
          <span>Bitrate</span>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <span className="min-w-[40px] text-[#37474f]">[  5]</span>
            <span className="min-w-[120px] text-[#40c4ff]">{i}.00-{i + 1}.00 sec</span>
            <span className="min-w-[80px] text-[#64ffda]">{(100 + Math.random() * 20).toFixed(1)} MBytes</span>
            <span className="text-[#ffd740]">{(800 + Math.random() * 200).toFixed(0)} Mbits/sec</span>
          </div>
        ))}
        <div className="mt-1 text-[#37474f]">- - - - - - - - - - - - - - - - - - - - - - - - -</div>
        <div className="flex gap-3">
          <span className="min-w-[40px] text-[#37474f]">[  5]</span>
          <span className="min-w-[120px] text-[#40c4ff]">0.00-4.00 sec</span>
          <span className="min-w-[80px] text-[#64ffda]">412 MBytes</span>
          <span className="text-[#ffd740] font-bold">864 Mbits/sec    sender</span>
        </div>
      </div>
    );
  }

  if (line.type === "host-output") {
    const { host, data } = line;
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        {(data?.A || []).map((a, i) => (
          <div key={i}><span className="text-[#40c4ff]">{host}</span><span className="text-[#37474f]"> has address </span><span className="text-[#64ffda]">{a}</span></div>
        ))}
        {(data?.MX || []).map((m, i) => (
          <div key={i}><span className="text-[#40c4ff]">{host}</span><span className="text-[#37474f]"> mail is handled by 10 </span><span className="text-[#64ffda]">{m}</span></div>
        ))}
      </div>
    );
  }

  if (line.type === "scp-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#ffd740]">{line.file}</span><span className="text-[#37474f]">                                       100%   </span><span className="text-[#64ffda]">1256     1.2MB/s   00:00</span></div>
      </div>
    );
  }

  if (line.type === "rsync-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div className="text-[#37474f]">sending incremental file list</div>
        <div className="text-[#ffd740]">{line.src}</div>
        <div className="mt-1 text-[#37474f]">sent 1,256 bytes  received 35 bytes  2,582.00 bytes/sec</div>
        <div className="text-[#37474f]">total size is 1,256  speedup is 0.95</div>
      </div>
    );
  }

  if (line.type === "sftp-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#37474f]">Connected to </span><span className="text-[#00e5ff]">{line.host}</span><span className="text-[#37474f]">.</span></div>
        <div className="text-[#ffd740]">sftp&gt; <span className="text-[#37474f]">[sandbox: sftp session simulated. Type exit to quit]</span></div>
      </div>
    );
  }

  if (line.type === "telnet-output") {
    return (
      <div className="font-mono text-[12px] leading-[1.75]">
        <div><span className="text-[#37474f]">Trying </span><span className="text-[#40c4ff]">{line.ip}</span><span className="text-[#37474f]">...</span></div>
        <div className="text-[#ff5252]">telnet: Unable to connect to remote host: Connection refused</div>
        <div className="text-[#37474f] text-[11px]">Note: telnet is unencrypted — use ssh for remote access.</div>
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
export default function Level9Page() {
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
  const [cwd, setCwd] = useState("/home/user");

  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const allHistRef = useRef(allHistory);
  const cwdRef = useRef(cwd);

  allHistRef.current = allHistory;
  cwdRef.current = cwd;

  const progress = levelDone ? 100 : Math.round((completed.length / OBJECTIVES.length) * 90);
  const currentObj = OBJECTIVES[objIdx];

  function cwdDisplay(p) {
    if (p === "/home/user") return "~";
    if (p.startsWith("/home/user/")) return "~/" + p.slice("/home/user/".length);
    return p;
  }

  useEffect(() => {
    setOutput([
      { id: 0, type: "text", color: "dim", text: "Linux Learning Platform  —  bash 5.2.21" },
      { id: 1, type: "text", color: "dim", text: "Type 'help' to see commands." },
      { id: 2, type: "text", color: "dim", text: "" },
      { id: 3, type: "text", color: "green", text: "Welcome to Level 09 — Networking Basics" },
      { id: 4, type: "text", color: "yellow", text: `Objective 1/${OBJECTIVES.length}: ${OBJECTIVES[0].label}` },
      { id: 5, type: "text", color: "dim", text: OBJECTIVES[0].desc },
      { id: 6, type: "text", color: "dim", text: "" },
    ]);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const addLines = useCallback((lines) => {
    setOutput((prev) => {
      const base = prev.length;
      return [...prev, ...lines.map((l, i) => ({ ...l, id: base + i }))];
    });
  }, []);

  const checkObjective = useCallback((newAllHistory) => {
    setObjIdx((prevIdx) => {
      if (levelDone) return prevIdx;
      const obj = OBJECTIVES[prevIdx];
      if (!obj) return prevIdx;
      if (obj.validate(cwdRef.current, newAllHistory)) {
        const nextIdx = prevIdx + 1;
        setTimeout(() => {
          addLines([
            { type: "obj-complete", label: `✓ Objective ${prevIdx + 1}/${OBJECTIVES.length}: ${obj.label}`, msg: obj.successMsg },
            { type: "text", color: "dim", text: "" },
          ]);
          setCompleted((prev) => [...prev, obj.id]);
          if (nextIdx >= OBJECTIVES.length) {
            setLevelDone(true);
            setTimeout(() => {
              addLines([{ type: "text", color: "green", text: "✓ All objectives complete! Level 09 passed." }]);
              setShowToast(true);
            }, 400);
          } else {
            setTimeout(() => {
              addLines([
                { type: "text", color: "yellow", text: `▸ Objective ${nextIdx + 1}/${OBJECTIVES.length}: ${OBJECTIVES[nextIdx].label}` },
                { type: "text", color: "dim", text: OBJECTIVES[nextIdx].desc },
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
  }, [levelDone, addLines]);

  function resolveHost(arg) {
    const knownIps = { "google.com": "142.250.80.46", "example.com": "93.184.216.34", "github.com": "140.82.121.4", "localhost": "127.0.0.1", "8.8.8.8": "8.8.8.8", "192.168.1.1": "192.168.1.1" };
    return knownIps[arg] || fakeIP();
  }

  const runCommand = useCallback((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setCmdHistory((prev) => [trimmed, ...prev]);
    setHistIdx(-1);
    const newAllHistory = [trimmed, ...allHistRef.current];
    setAllHistory(newAllHistory);
    allHistRef.current = newAllHistory;

    const currentCwd = cwdRef.current;
    const promptLine = { type: "prompt", path: cwdDisplay(currentCwd), cmd: trimmed };

    const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd = parts[0];
    const rawArgs = parts.slice(1).map((a) => a.replace(/^["']|["']$/g, ""));
    const flags = rawArgs.filter((a) => a.startsWith("-"));
    const args = rawArgs.filter((a) => !a.startsWith("-"));

    let responseLines = [];

    /* ── cd (kept from L8) ── */
    if (cmd === "cd") {
      const target = rawArgs[0] || "~";
      const dest = target === "~" || !target ? "/home/user" : target.startsWith("/") ? target : currentCwd + "/" + target;
      setCwd(dest);
      cwdRef.current = dest;
      addLines([promptLine, { type: "text", color: "dim", text: "" }]);
      checkObjective(newAllHistory);
      return;
    }

    /* ── ls (kept minimal) ── */
    if (cmd === "ls") {
      addLines([promptLine, { type: "text", color: "white", text: "notes.txt  deploy.sh  backup.sh  projects/  logs/" }, { type: "text", color: "dim", text: "" }]);
      checkObjective(newAllHistory);
      return;
    }

    /* ── pwd ── */
    if (cmd === "pwd") {
      responseLines = [{ type: "text", color: "cyan", text: currentCwd }];
    }

    /* ── clear ── */
    else if (cmd === "clear") {
      setOutput([]);
      return;
    }

    /* ── ip ── */
    else if (cmd === "ip") {
      const sub = args[0] || rawArgs[0];
      if (!sub || sub === "addr" || sub === "a" || sub === "address") {
        responseLines = Object.entries(FAKE_NET.interfaces).flatMap(([name, iface], idx) => [
          { type: "ip-addr-block", idx: idx + 1, name, iface },
        ]);
      } else if (sub === "route" || sub === "r") {
        responseLines = [{ type: "route-output" }];
      } else if (sub === "link") {
        responseLines = Object.entries(FAKE_NET.interfaces).map(([name, iface]) => ({
          type: "text", color: "cyan",
          text: `${name}: state ${iface.state}  mac ${iface.mac}`,
        }));
      } else {
        responseLines = [{ type: "text", color: "red", text: `ip: unknown sub-command '${sub}'` }];
      }
    }

    /* ── ifconfig ── */
    else if (cmd === "ifconfig") {
      const target = args[0];
      const entries = target
        ? Object.entries(FAKE_NET.interfaces).filter(([n]) => n === target)
        : Object.entries(FAKE_NET.interfaces);
      if (!entries.length) {
        responseLines = [{ type: "text", color: "red", text: `ifconfig: ${target}: error fetching interface information: Device not found` }];
      } else {
        responseLines = entries.flatMap(([name, iface]) => [{ type: "iface-block", name, iface }]);
      }
    }

    /* ── hostname ── */
    else if (cmd === "hostname") {
      if (flags.includes("-I")) {
        responseLines = [{ type: "text", color: "cyan", text: "192.168.1.42 " }];
      } else {
        responseLines = [{ type: "text", color: "cyan", text: "netlab" }];
      }
    }

    /* ── ping ── */
    else if (cmd === "ping") {
      const host = args[0];
      if (!host) {
        responseLines = [{ type: "text", color: "red", text: "ping: usage error: Destination address required" }];
      } else {
        const countFlag = flags.find((f) => f.startsWith("-c"));
        let count = 4;
        if (countFlag) {
          const c = countFlag.slice(2) || args.find((_, i) => rawArgs[rawArgs.indexOf(countFlag) + 1] === args[i]);
          count = parseInt(countFlag.slice(2)) || 4;
        }
        const pLines = Array.from({ length: Math.min(count, 6) }, () => randMs(28, 8));
        responseLines = [{ type: "ping-output", host, ip: resolveHost(host), lines: pLines }];
      }
    }

    /* ── traceroute / tracepath ── */
    else if (cmd === "traceroute" || cmd === "tracepath") {
      const host = args[0];
      if (!host) {
        responseLines = [{ type: "text", color: "red", text: `${cmd}: usage: ${cmd} hostname` }];
      } else {
        responseLines = [{ type: "traceroute-output", host }];
      }
    }

    /* ── mtr ── */
    else if (cmd === "mtr") {
      const host = args[0];
      if (!host) {
        responseLines = [{ type: "text", color: "red", text: "mtr: No destination given." }];
      } else {
        responseLines = [{ type: "mtr-output", host }];
      }
    }

    /* ── dig ── */
    else if (cmd === "dig") {
      let qtype = "A";
      let host = null;
      // dig [@server] [TYPE] host
      const nonFlag = rawArgs.filter((a) => !a.startsWith("@") && !a.startsWith("-"));
      const types = ["A", "MX", "NS", "TXT", "CNAME", "AAAA", "SOA"];
      if (types.includes(nonFlag[0]?.toUpperCase())) {
        qtype = nonFlag[0].toUpperCase();
        host = nonFlag[1];
      } else {
        host = nonFlag[0];
        if (types.includes(nonFlag[1]?.toUpperCase())) qtype = nonFlag[1].toUpperCase();
      }
      if (!host) {
        responseLines = [{ type: "text", color: "red", text: "dig: need a host to look up" }];
      } else {
        const data = FAKE_NET.dns[host] || { A: [fakeIP()], MX: [], NS: [], TTL: 300 };
        responseLines = [{ type: "dig-output", host, qtype, data }];
      }
    }

    /* ── nslookup ── */
    else if (cmd === "nslookup") {
      const host = args[0];
      if (!host) {
        responseLines = [{ type: "text", color: "red", text: "nslookup: need a hostname" }];
      } else {
        const data = FAKE_NET.dns[host] || { A: [fakeIP()], TTL: 300 };
        responseLines = [{ type: "nslookup-output", host, data }];
      }
    }

    /* ── host ── */
    else if (cmd === "host") {
      const host = args[0];
      if (!host) {
        responseLines = [{ type: "text", color: "red", text: "host: usage: host [-t type] hostname" }];
      } else {
        const data = FAKE_NET.dns[host] || { A: [fakeIP()], MX: [] };
        responseLines = [{ type: "host-output", host, data }];
      }
    }

    /* ── whois ── */
    else if (cmd === "whois") {
      const domain = args[0];
      if (!domain) {
        responseLines = [{ type: "text", color: "red", text: "whois: need a domain" }];
      } else {
        const content = FAKE_NET.whois[domain] || `Domain Name: ${domain.toUpperCase()}\nRegistrar: Unknown\nRegistrant: Unknown`;
        responseLines = [{ type: "whois-output", content }];
      }
    }

    /* ── ss ── */
    else if (cmd === "ss") {
      const showTcp = !flags.length || flags.some((f) => f.includes("t"));
      const showUdp = flags.some((f) => f.includes("u"));
      const listenOnly = flags.some((f) => f.includes("l"));
      let sockets = FAKE_NET.sockets;
      if (!showUdp && showTcp) sockets = sockets.filter((s) => s.proto === "tcp");
      if (showUdp && !showTcp) sockets = sockets.filter((s) => s.proto === "udp");
      if (listenOnly) sockets = sockets.filter((s) => s.state === "LISTEN" || s.proto === "udp");
      responseLines = [{ type: "ss-output", sockets }];
    }

    /* ── netstat ── */
    else if (cmd === "netstat") {
      responseLines = [{ type: "ss-output", sockets: FAKE_NET.sockets }];
    }

    /* ── lsof ── */
    else if (cmd === "lsof") {
      responseLines = [{ type: "lsof-output" }];
    }

    /* ── tcpdump ── */
    else if (cmd === "tcpdump") {
      const ifaceFlag = flags.find((f) => f === "-i");
      const ifaceIdx = rawArgs.indexOf("-i");
      const iface = ifaceIdx >= 0 ? rawArgs[ifaceIdx + 1] : "eth0";
      responseLines = [{ type: "tcpdump-output", iface }];
    }

    /* ── curl ── */
    else if (cmd === "curl") {
      const url = args[0] || rawArgs.find((a) => a.startsWith("http"));
      if (!url) {
        responseLines = [{ type: "text", color: "red", text: "curl: try 'curl --help'" }];
      } else {
        const headersOnly = flags.includes("-I") || flags.includes("--head");
        const content = `<!DOCTYPE html>\n<html>\n<head><title>Example Domain</title></head>\n<body>\n<h1>Example Domain</h1>\n<p>This domain is for illustrative examples.</p>\n</body>\n</html>`;
        responseLines = [{ type: "curl-output", url, headersOnly, content }];
      }
    }

    /* ── wget ── */
    else if (cmd === "wget") {
      const url = args[0];
      if (!url) {
        responseLines = [{ type: "text", color: "red", text: "wget: missing URL" }];
      } else {
        const filename = url.split("/").pop() || "index.html";
        responseLines = [{ type: "wget-output", url, filename }];
      }
    }

    /* ── nmap ── */
    else if (cmd === "nmap") {
      const host = args[0];
      if (!host) {
        responseLines = [{ type: "text", color: "red", text: "nmap: no target specified" }];
      } else {
        const ip = resolveHost(host);
        responseLines = [{ type: "nmap-output", host, ip }];
      }
    }

    /* ── ssh ── */
    else if (cmd === "ssh") {
      const target = args[0] || rawArgs.find((a) => a.includes("@"));
      if (!target) {
        responseLines = [{ type: "text", color: "dim", text: "usage: ssh [-v] user@host" }];
      } else {
        const [user, host] = target.includes("@") ? target.split("@") : ["user", target];
        responseLines = [{ type: "ssh-output", user, host }];
      }
    }

    /* ── scp ── */
    else if (cmd === "scp") {
      const file = args[0] || "file";
      responseLines = [{ type: "scp-output", file }];
    }

    /* ── rsync ── */
    else if (cmd === "rsync") {
      const src = args[0] || "src";
      responseLines = [{ type: "rsync-output", src }];
    }

    /* ── sftp ── */
    else if (cmd === "sftp") {
      const target = args[0] || rawArgs[0];
      const host = target?.includes("@") ? target.split("@")[1] : target || "host";
      responseLines = [{ type: "sftp-output", host }];
    }

    /* ── telnet ── */
    else if (cmd === "telnet") {
      const host = args[0] || "host";
      responseLines = [{ type: "telnet-output", ip: resolveHost(host) }];
    }

    /* ── ftp / lftp ── */
    else if (cmd === "ftp" || cmd === "lftp") {
      responseLines = [
        { type: "text", color: "yellow", text: `${cmd}: connecting to ${args[0] || "host"}...` },
        { type: "text", color: "red", text: "ftp: connect: Connection refused" },
        { type: "text", color: "dim", text: "Note: FTP is unencrypted — prefer sftp or rsync over SSH." },
      ];
    }

    /* ── aria2 ── */
    else if (cmd === "aria2" || cmd === "aria2c") {
      const url = args[0];
      if (!url) {
        responseLines = [{ type: "text", color: "red", text: "aria2c: need a URL" }];
      } else {
        const file = url.split("/").pop() || "download";
        responseLines = [
          { type: "text", color: "cyan", text: `aria2c: downloading ${url}` },
          { type: "text", color: "white", text: `[#abc123 0B/1.2KiB CN:1 DL:512KiB]` },
          { type: "text", color: "green", text: `Download complete: ${file}` },
        ];
      }
    }

    /* ── nc / netcat ── */
    else if (cmd === "nc" || cmd === "netcat") {
      const isListen = flags.includes("-l");
      const isScan = flags.includes("-z");
      const isVerbose = flags.includes("-v");
      if (isListen) {
        const port = args[0] || "8080";
        responseLines = [{ type: "nc-output", mode: "listen", port }];
      } else if (isScan) {
        const host = args[0];
        const port = args[1];
        if (!host || !port) {
          responseLines = [{ type: "text", color: "red", text: "nc: usage: nc -zv host port" }];
        } else {
          responseLines = [{ type: "nc-output", mode: "scan", host, port }];
        }
      } else {
        responseLines = [
          { type: "text", color: "dim", text: "nc: use -l to listen, -zv host port to scan, or pipe data." },
        ];
      }
    }

    /* ── iperf ── */
    else if (cmd === "iperf" || cmd === "iperf3") {
      if (flags.includes("-s")) {
        responseLines = [{ type: "iperf-output", mode: "server" }];
      } else if (flags.includes("-c") || args[0]) {
        const host = args[0] || "192.168.1.1";
        responseLines = [{ type: "iperf-output", mode: "client", host }];
      } else {
        responseLines = [{ type: "text", color: "dim", text: "iperf: -s to run server, -c host to run client" }];
      }
    }

    /* ── help ── */
    else if (cmd === "help") {
      responseLines = [
        { type: "text", color: "green", text: "Level 09 — Networking commands:" },
        { type: "text", color: "dim", text: "" },
        { type: "text", color: "cyan", text: "  — Interfaces —" },
        { type: "text", color: "white", text: "  ip addr / ip a          show all interfaces" },
        { type: "text", color: "white", text: "  ip route / ip r         show routing table" },
        { type: "text", color: "white", text: "  ifconfig [iface]        legacy interface list" },
        { type: "text", color: "white", text: "  hostname / hostname -I  show name / IPs" },
        { type: "text", color: "dim", text: "" },
        { type: "text", color: "cyan", text: "  — Connectivity —" },
        { type: "text", color: "white", text: "  ping -c 4 <host>        ICMP test" },
        { type: "text", color: "white", text: "  traceroute <host>       hop-by-hop path" },
        { type: "text", color: "white", text: "  tracepath <host>        no-root traceroute" },
        { type: "text", color: "white", text: "  mtr <host>              live ping+trace" },
        { type: "text", color: "dim", text: "" },
        { type: "text", color: "cyan", text: "  — DNS —" },
        { type: "text", color: "white", text: "  dig [TYPE] <host>       DNS lookup" },
        { type: "text", color: "white", text: "  nslookup <host>         simple DNS" },
        { type: "text", color: "white", text: "  host <host>             compact DNS" },
        { type: "text", color: "white", text: "  whois <domain>          domain registration" },
        { type: "text", color: "dim", text: "" },
        { type: "text", color: "cyan", text: "  — Sockets —" },
        { type: "text", color: "white", text: "  ss -tuln                open sockets (modern)" },
        { type: "text", color: "white", text: "  netstat -tuln           open sockets (legacy)" },
        { type: "text", color: "white", text: "  lsof -i                 network file list" },
        { type: "text", color: "white", text: "  tcpdump -i eth0         packet capture" },
        { type: "text", color: "dim", text: "" },
        { type: "text", color: "cyan", text: "  — Transfer —" },
        { type: "text", color: "white", text: "  curl -I <url>           HTTP headers" },
        { type: "text", color: "white", text: "  wget <url>              download file" },
        { type: "text", color: "white", text: "  scp src user@h:dst      secure copy" },
        { type: "text", color: "white", text: "  rsync -avz src dst      sync over SSH" },
        { type: "text", color: "white", text: "  sftp user@host          SFTP session" },
        { type: "text", color: "white", text: "  aria2c <url>            multi-source download" },
        { type: "text", color: "dim", text: "" },
        { type: "text", color: "cyan", text: "  — Remote / Scan —" },
        { type: "text", color: "white", text: "  ssh user@host           encrypted shell" },
        { type: "text", color: "white", text: "  telnet host             unencrypted (legacy)" },
        { type: "text", color: "white", text: "  nmap <host>             port scanner" },
        { type: "text", color: "white", text: "  nc -zv host port        netcat port probe" },
        { type: "text", color: "white", text: "  nc -l 8080              netcat listen" },
        { type: "text", color: "white", text: "  iperf -s / -c host      bandwidth test" },
        { type: "text", color: "dim", text: "" },
        { type: "text", color: "cyan", text: "  — Navigation —" },
        { type: "text", color: "white", text: "  cd / ls / pwd / clear" },
      ];
    }

    /* ── unknown ── */
    else {
      responseLines = [{ type: "text", color: "red", text: `bash: ${cmd}: command not found` }];
    }

    addLines([promptLine, ...responseLines, { type: "text", color: "dim", text: "" }]);
    checkObjective(newAllHistory);
  }, [levelDone, addLines, checkObjective]);

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
      className="h-screen flex flex-col bg-[#020b0e] text-[#cfd8dc] overflow-hidden font-mono"
      onClick={() => inputRef.current?.focus()}
    >
      {/* ── TOP BAR ── */}
      <header className="h-11 flex-shrink-0 bg-[#03111a] border-b border-[#0d2530] flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden text-[#263238] hover:text-[#00e5ff] transition-colors mr-1"
            onClick={(e) => { e.stopPropagation(); setSidebarOpen((o) => !o); }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect y="2" width="16" height="1.5" rx="1" /><rect y="7" width="16" height="1.5" rx="1" /><rect y="12" width="16" height="1.5" rx="1" />
            </svg>
          </button>
          <div className="w-6 h-6 rounded border border-[#00e5ff]/30 flex items-center justify-center">
            <span className="text-[#00e5ff] text-xs font-bold">$_</span>
          </div>
          <span className="text-white text-xs font-bold tracking-tight" style={{ fontFamily: "Syne, sans-serif" }}>
            LinuxMastery
          </span>
        </div>
        <div className="flex items-center gap-2">
          {LESSONS_NAV.map((l) => (
            <a key={l.level} href={l.href} title={`Level ${l.level}: ${l.title}`}
              className={`w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
                l.status === "done" ? "bg-[#00e5ff] border-[#00e5ff]"
                  : l.status === "active" ? "bg-[#ffd740] border-[#ffd740] shadow-[0_0_6px_#ffd74088]"
                  : "bg-[#0d2530] border-[#0d2530]"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#00e5ff] border border-[#00e5ff]/20 bg-[#00e5ff]/5 px-2 py-0.5 rounded font-mono">expert</span>
          <span className="text-xs text-[#ffd740] border border-[#ffd740]/20 bg-[#ffd740]/5 px-2 py-0.5 rounded font-mono">+{LESSON.xp} XP</span>
          <a href="/" className="text-xs text-[#263238] hover:text-[#00e5ff] transition-colors">exit</a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR ── */}
        <aside
          className={`w-72 flex-shrink-0 bg-[#03111a] border-r border-[#0d2530] flex flex-col overflow-hidden
            md:relative md:translate-x-0 absolute inset-y-0 left-0 z-30 transition-transform duration-300
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#021018] border-b border-[#0d2530] px-5 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#00e5ff] font-bold tracking-[0.15em] uppercase">Level {LESSON.level}</span>
              <span className="text-[10px] text-[#263238] font-mono">{LESSON.track}</span>
            </div>
            <h1 className="text-white font-bold text-base leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
              {LESSON.title}
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
            {/* Description */}
            <div>
              <div className="text-[10px] text-[#00e5ff] font-bold tracking-[0.12em] uppercase mb-2">Description</div>
              <p className="text-[12px] text-[#37474f] leading-[1.8]">
                {LESSON.description.map((seg, i) =>
                  seg.code
                    ? <code key={i} className="text-[#00e5ff] bg-[#021018] px-1 rounded text-[11px]">{seg.text}</code>
                    : <span key={i}>{seg.text}</span>
                )}
              </p>
            </div>

            {/* Objectives */}
            <div>
              <div className="text-[10px] text-[#00e5ff] font-bold tracking-[0.12em] uppercase mb-2">
                Objectives <span className="ml-2 text-[#1c2a2e] normal-case tracking-normal">{completed.length}/{OBJECTIVES.length}</span>
              </div>
              <div className="space-y-1.5">
                {OBJECTIVES.map((obj, i) => {
                  const done = completed.includes(obj.id);
                  const active = i === objIdx && !levelDone;
                  return (
                    <div key={obj.id}
                      className={`flex items-start gap-2.5 px-2.5 py-2 rounded text-[11px] transition-colors ${
                        done ? "bg-[#021018] border border-[#0d2530]"
                          : active ? "bg-[#00e5ff]/5 border border-[#00e5ff]/20"
                          : "border border-transparent"
                      }`}
                    >
                      <span className={`mt-[2px] flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold ${
                        done ? "border-[#00e5ff] bg-[#00e5ff] text-black"
                          : active ? "border-[#ffd740] text-[#ffd740]"
                          : "border-[#0d2530] text-[#1c2a2e]"
                      }`}>
                        {done ? "✓" : i + 1}
                      </span>
                      <div>
                        <div className={done ? "text-[#1c2a2e] line-through" : active ? "text-[#cfd8dc]" : "text-[#0d2530]"}>
                          {obj.label}
                        </div>
                        {active && <div className="text-[#263238] mt-0.5 leading-relaxed">{obj.desc}</div>}
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
                    hintOpen ? "border-[#003a4a] text-[#00e5ff] bg-[#001e28]"
                      : "border-[#0d2530] text-[#263238] hover:border-[#00e5ff] hover:text-[#00e5ff]"
                  }`}
                  onClick={() => setHintOpen((o) => !o)}
                >
                  {hintOpen ? "[ hide hint ]" : `[ hint for objective ${objIdx + 1} ]`}
                </button>
                {hintOpen && (
                  <div className="mt-2 bg-[#001e28] border border-[#003a4a] rounded px-3 py-2.5 text-[11px] text-[#00e5ff] leading-[1.7]">
                    {currentObj.hint}
                  </div>
                )}
              </div>
            )}

            {/* Commands */}
            <div>
              <div className="text-[10px] text-[#00e5ff] font-bold tracking-[0.12em] uppercase mb-2">Commands</div>
              <div className="space-y-1.5">
                {LESSON.commands.map((c) => (
                  <div key={c.name} className="flex gap-3 items-baseline">
                    <code className="text-[11px] text-[#40c4ff] font-bold min-w-[128px] flex-shrink-0">{c.name}</code>
                    <span className="text-[11px] text-[#1c2a2e]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* OSI quick ref */}
            <div className="bg-[#021018] border border-[#0d2530] rounded p-3">
              <div className="text-[10px] text-[#00e5ff] font-bold tracking-[0.12em] uppercase mb-2">Network Layers (OSI)</div>
              <div className="space-y-0.5">
                {[
                  ["7", "Application", "curl, ssh, ftp"],
                  ["4", "Transport", "TCP, UDP — ss, netstat"],
                  ["3", "Network", "IP, ICMP — ip, ping"],
                  ["2", "Data Link", "Ethernet — ifconfig"],
                  ["1", "Physical", "cables / WiFi"],
                ].map(([n, name, tools]) => (
                  <div key={n} className="flex gap-2 items-baseline">
                    <code className="text-[11px] text-[#ffd740] min-w-[16px]">{n}</code>
                    <span className="text-[11px] text-[#37474f] min-w-[80px]">{name}</span>
                    <span className="text-[10px] text-[#1c2a2e]">{tools}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Common ports */}
            <div>
              <div className="text-[10px] text-[#00e5ff] font-bold tracking-[0.12em] uppercase mb-2">Common Ports</div>
              <div className="space-y-0.5">
                {[["22", "SSH"], ["25", "SMTP"], ["53", "DNS"], ["80", "HTTP"], ["443", "HTTPS"], ["3306", "MySQL"], ["5432", "Postgres"]].map(([p, s]) => (
                  <div key={p} className="flex gap-3">
                    <code className="text-[11px] text-[#40c4ff] min-w-[36px]">{p}</code>
                    <span className="text-[11px] text-[#263238]">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Level nav */}
            <div>
              <div className="text-[10px] text-[#00e5ff] font-bold tracking-[0.12em] uppercase mb-2">Module</div>
              <div className="space-y-0.5">
                {LESSONS_NAV.map((l) => (
                  <a key={l.level} href={l.status === "locked" ? undefined : l.href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-[11px] transition-colors duration-150 ${
                      l.status === "active" ? "bg-[#00e5ff]/8 text-white"
                        : l.status === "done" ? "text-[#263238] hover:text-[#37474f]"
                        : "text-[#0d2530] cursor-default"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      l.status === "done" ? "bg-[#00e5ff]"
                        : l.status === "active" ? "bg-[#ffd740]"
                        : "bg-[#0d2530]"
                    }`} />
                    <span>{l.level}</span>
                    <span className="text-[#0d2530] mx-0.5">—</span>
                    <span className="truncate">{l.title}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="h-[3px] bg-[#0d2530] border-t border-[#0d2530] flex-shrink-0">
            <div className="h-full bg-[#00e5ff] transition-all duration-500" style={{ width: `${progress}%`, boxShadow: "0 0 8px #00e5ff60" }} />
          </div>
        </aside>

        {/* ── TERMINAL ── */}
        <div className="flex-1 bg-[#000d11] flex flex-col overflow-hidden relative">
          {/* Title bar */}
          <div className="h-[34px] bg-[#03111a] border-b border-[#0d2530] flex-shrink-0 flex items-center justify-between px-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[11px] text-[#0d2530] tracking-[0.05em]">bash — user@netlab</span>
            <div>
              {levelDone
                ? <span className="text-[10px] text-[#00e5ff] border border-[#00e5ff]/30 px-2 py-0.5 rounded-full">✓ complete</span>
                : <span className="text-[10px] text-[#1c2a2e] font-mono">{completed.length}/{OBJECTIVES.length} done</span>
              }
            </div>
          </div>

          {/* Output */}
          <div ref={outputRef} className="flex-1 overflow-y-auto px-5 pt-4 pb-2 flex flex-col gap-[2px]"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#0d2530 #000d11" }}>
            {output.map((line) => <OutputLine key={line.id} line={line} />)}
          </div>

          {/* Toast */}
          {showToast && (
            <div className="absolute bottom-[72px] right-5 bg-[#021018] border border-[#00e5ff] rounded-lg px-5 py-4 w-80 shadow-[0_0_24px_#00e5ff18] z-10 animate-[slideUp_0.3s_ease]">
              <div className="text-[13px] text-[#00e5ff] font-bold mb-1.5">✓ Level 09 complete!</div>
              <div className="text-[11px] text-[#263238] leading-relaxed mb-1">
                You can now inspect interfaces with <code className="text-[#00e5ff]">ip</code> &amp; <code className="text-[#00e5ff]">ifconfig</code>, probe connectivity with <code className="text-[#00e5ff]">ping</code>/<code className="text-[#00e5ff]">traceroute</code>, query DNS with <code className="text-[#00e5ff]">dig</code>, audit sockets with <code className="text-[#00e5ff]">ss</code>, transfer data with <code className="text-[#00e5ff]">curl</code>, scan ports with <code className="text-[#00e5ff]">nmap</code>, and connect remotely with <code className="text-[#00e5ff]">ssh</code> &amp; <code className="text-[#00e5ff]">nc</code>.
              </div>
              <div className="text-[11px] text-[#00e5ff]/50 mb-3">+{LESSON.xp} XP earned</div>
              <div className="flex gap-2">
                <a href={LESSON.nextLevel} className="flex-1 bg-[#00e5ff] text-black text-[12px] font-bold py-1.5 rounded text-center hover:opacity-90 transition-opacity">
                  Next Level →
                </a>
                <button onClick={() => setShowToast(false)} className="text-[11px] text-[#1c2a2e] hover:text-[#263238] px-2">✕</button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 border-t border-[#0d2530] px-5 py-3 flex items-center gap-2">
            <div className="flex items-center gap-1 flex-shrink-0 text-[13px]">
              <span className="text-[#00e5ff] font-bold">user</span>
              <span className="text-[#1c2a2e]">@</span>
              <span className="text-[#00e5ff] font-bold">netlab</span>
              <span className="text-[#1c2a2e]">:</span>
              <span className="text-[#40c4ff]">{cwdDisplay(cwd)}</span>
              <span className="text-[#263238]">$</span>
            </div>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#cfd8dc] caret-[#00e5ff] font-mono"
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
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #0d2530; border-radius: 2px; }
      `}</style>
    </div>
  );
}