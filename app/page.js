"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const observerRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    document.querySelectorAll(".track-enter").forEach((el) => {
      observerRef.current.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollToTracks = () => {
    document.getElementById("tracks")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-[#080c08] text-gray-100 overflow-x-hidden font-display">
      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a2e1a] bg-[#080c08]/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded border border-[#3ddc84]/40 flex items-center justify-center">
              <span className="text-[#3ddc84] font-mono text-xs font-bold">
                $_
              </span>
            </div>
            <span className="font-display font-bold text-white text-sm tracking-tight">
              LinuxForge
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-gray-500 font-mono">
            <a
              href="#tracks"
              className="hover:text-[#3ddc84] transition-colors duration-200"
            >
              tracks
            </a>
            <a
              href="#curriculum"
              className="hover:text-[#3ddc84] transition-colors duration-200"
            >
              curriculum
            </a>
            <a
              href="#community"
              className="hover:text-[#3ddc84] transition-colors duration-200"
            >
              community
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="font-mono text-xs text-gray-500 hover:text-white transition-colors duration-200 hidden sm:block"
              onClick={(e) => {
                router.push("/login");
              }}
            >
              sign in
            </button>
            <button className="font-mono text-xs bg-[#3ddc84] text-black px-4 py-2 rounded font-bold hover:bg-[#3ddc84]/90 transition-all duration-200 hover:scale-[1.02]">
              start free
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center grid-bg pt-14">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[#3ddc84]/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-[#1a2e1a] bg-[#0d120d] rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc84] animate-pulse" />
            <span className="font-mono text-xs text-[#3ddc84]">
              v2.0 — 240 lessons, 12 modules
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
            Command the
            <br />
            <span className="text-[#3ddc84] glow-text">Linux Shell.</span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Learn Linux commands the right way — hands-on, in the terminal, with
            real feedback. From your first{" "}
            <span className="font-mono text-gray-300 text-base">ls</span> to
            writing shell scripts that ship to production.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={scrollToTracks}
              className="w-full sm:w-auto bg-[#3ddc84] text-black font-display font-bold text-sm px-8 py-3.5 rounded hover:bg-[#3ddc84]/90 transition-all duration-200 hover:scale-[1.02] glow-green"
            >
              Choose your track →
            </button>
            <button className="w-full sm:w-auto border border-[#1a2e1a] text-gray-400 font-mono text-sm px-8 py-3.5 rounded hover:border-gray-500 hover:text-white transition-all duration-200">
              [ watch demo ]
            </button>
          </div>

          {/* Terminal preview */}
          <div className="max-w-xl mx-auto border border-[#1a2e1a] rounded-lg overflow-hidden bg-[#0d120d] animate-float">
            <div className="border-b border-[#1a2e1a] px-4 py-2.5 flex items-center justify-between">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <span className="font-mono text-xs text-gray-600">
                bash — user@linux:~
              </span>
              <span />
            </div>
            <div className="p-5 text-left font-mono text-sm space-y-3">
              <div className="text-gray-500 text-xs mb-2">
                # Interactive terminal. Real commands. Real output.
              </div>
              <div className="text-[#3ddc84] typewriter">
                $ ls -la /home/user
              </div>
              <div className="text-gray-400 text-xs leading-relaxed opacity-0 fade-in-delayed-1">
                <div className="text-gray-600">total 28</div>
                <div>
                  <span className="text-[#22d3ee]">drwxr-xr-x</span> documents/{" "}
                  <span className="text-gray-600 ml-2">Apr 20</span>
                </div>
                <div>
                  <span className="text-[#22d3ee]">drwxr-xr-x</span> projects/{" "}
                  <span className="text-gray-600 ml-2">Apr 19</span>
                </div>
                <div>
                  <span className="text-gray-400">-rw-r--r--</span> .bashrc{" "}
                  <span className="text-gray-600 ml-2">Apr 18</span>
                </div>
              </div>
              <div className="text-[#3ddc84] typewriter-2">$ cd documents</div>
              <div className="text-[#3ddc84] typewriter-3">
                $ cat report.txt
              </div>
              <div className="flex items-center gap-0.5 mt-1">
                <span className="text-[#3ddc84] text-xs">$ </span>
                <span className="w-2 h-4 bg-[#3ddc84] animate-blink inline-block ml-0.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="font-mono text-xs text-gray-600">scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-[#1a2e1a] to-transparent" />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-[#1a2e1a] bg-[#0d120d]/50">
        <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "12,400+", label: "active learners" },
            { value: "240", label: "hands-on lessons" },
            { value: "98%", label: "completion rate" },
            { value: "4.9 ★", label: "average rating" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-2xl font-bold text-white tabular-nums">
                {stat.value}
              </div>
              <div className="font-mono text-xs text-gray-500 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRACKS ── */}
      <section id="tracks" className="py-28 relative">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 track-enter">
            <div className="inline-block font-mono text-xs text-[#3ddc84] border border-[#3ddc84]/30 px-3 py-1 rounded-full mb-4">
              choose your track
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Where do you start?
            </h2>
            <p className="text-gray-500 mt-4 max-w-md mx-auto font-mono text-sm">
              Every developer has been here. Pick your level and we&apos;ll meet
              you there.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <TrackCard
              delay="0.1s"
              accentColor="#22d3ee"
              number="01"
              level="beginner"
              title="First Steps"
              description="Never touched a terminal? Start here. You'll learn navigation, files, and your first real commands."
              topics={[
                "Navigating the filesystem",
                "Creating & reading files",
                "Permissions & users",
                "Pipes & redirections",
              ]}
              meta="10 lessons · 2 hrs"
              hoverClass="beginner-glow"
              topLineClass="via-[#22d3ee]/40"
              onClick={() => {
                router.push("/beginner/level-1");
              }}
            />
            <TrackCard
              delay="0.2s"
              accentColor="#3ddc84"
              number="02"
              level="intermediate"
              title="Power User"
              description="You know the basics. Now automate everything. Shell scripting, processes, and the tools pros use daily."
              topics={[
                "Bash scripting & loops",
                "grep, awk, sed mastery",
                "Process management",
                "Cron jobs & automation",
              ]}
              meta="90 lessons · 12 hrs"
              hoverClass="intermediate-glow"
              topLineClass="via-[#3ddc84]/60"
              featured
              onClick={() => {
                router.push("/intermidiate/level-5");
              }}
            />
            <TrackCard
              delay="0.3s"
              accentColor="#f59e0b"
              number="03"
              level="expert"
              title="Shell Craft"
              description="Go deep. Kernel internals, system calls, performance tuning, and writing scripts that run in production."
              topics={[
                "Kernel & system internals",
                "Performance & profiling",
                "Network stack & sockets",
                "Production shell scripting",
              ]}
              meta="90 lessons · 15 hrs"
              hoverClass="expert-glow"
              topLineClass="via-[#f59e0b]/40"
              onClick={() => {
                router.push("/expert/level-8");
              }}
            />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="curriculum" className="py-24 border-t border-[#1a2e1a]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="track-enter">
              <div className="inline-block font-mono text-xs text-[#3ddc84] border border-[#3ddc84]/30 px-3 py-1 rounded-full mb-6">
                how it works
              </div>
              <h2 className="font-display text-4xl font-extrabold text-white tracking-tight mb-6">
                Learn by doing,
                <br />
                not watching.
              </h2>
              <p className="text-gray-500 font-mono text-sm leading-relaxed mb-8">
                Every lesson runs a real bash environment in your browser. No
                setup. No VMs. Just you and the shell.
              </p>
              <div className="space-y-5">
                {[
                  {
                    n: "01",
                    title: "Read the concept",
                    desc: "Concise explanations with zero fluff. The important thing is shown — not buried.",
                  },
                  {
                    n: "02",
                    title: "Run it in the terminal",
                    desc: "A real shell environment validates your commands. You feel it click.",
                  },
                  {
                    n: "03",
                    title: "Complete the challenge",
                    desc: "Each lesson ends with a real-world task. No multiple choice. Just the shell.",
                  },
                ].map((step) => (
                  <div key={step.n} className="flex gap-4">
                    <div className="w-8 h-8 rounded border border-[#1a2e1a] flex items-center justify-center flex-shrink-0 font-mono text-xs text-[#3ddc84]">
                      {step.n}
                    </div>
                    <div>
                      <div className="font-display font-semibold text-white text-sm mb-1">
                        {step.title}
                      </div>
                      <div className="font-mono text-xs text-gray-500 leading-relaxed">
                        {step.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Curriculum preview */}
            <div className="track-enter border border-[#1a2e1a] rounded-xl overflow-hidden bg-[#0d120d]">
              <div className="border-b border-[#1a2e1a] px-5 py-3 flex items-center justify-between">
                <span className="font-mono text-xs text-gray-500">
                  module_01 — foundations
                </span>
                <span className="font-mono text-xs text-[#3ddc84]">
                  12 lessons
                </span>
              </div>
              <div className="divide-y divide-[#1a2e1a]">
                <LessonRow status="done" label="01 — Where am I? (pwd)" />
                <LessonRow
                  status="active"
                  label="02 — Moving around (cd, ls)"
                />
                <LessonRow
                  status="locked"
                  label="03 — Creating things (mkdir, touch)"
                />
                <LessonRow
                  status="locked"
                  label="04 — Reading files (cat, less)"
                />
                <LessonRow
                  status="locked"
                  label="05 — Permissions (chmod, chown)"
                />
              </div>
              <div className="px-5 py-3 border-t border-[#1a2e1a]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs text-gray-600">
                    module progress
                  </span>
                  <span className="font-mono text-xs text-[#3ddc84]">
                    1 / 12
                  </span>
                </div>
                <div className="h-1 bg-[#1a2e1a] rounded-full">
                  <div
                    className="h-1 bg-[#3ddc84] rounded-full"
                    style={{ width: "8.33%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMMAND SHOWCASE ── */}
      <section className="py-20 border-t border-[#1a2e1a] bg-[#0d120d]/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12 track-enter">
            <h2 className="font-display text-3xl font-extrabold text-white tracking-tight">
              What you&apos;ll master
            </h2>
            <p className="font-mono text-xs text-gray-500 mt-3">
              A taste of the commands you&apos;ll own by the end
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 track-enter">
            {[
              { cmd: "find", desc: "search filesystem", color: "#3ddc84" },
              { cmd: "grep", desc: "search file contents", color: "#3ddc84" },
              { cmd: "awk", desc: "text processing", color: "#3ddc84" },
              { cmd: "sed", desc: "stream editor", color: "#22d3ee" },
              { cmd: "chmod", desc: "file permissions", color: "#22d3ee" },
              { cmd: "cron", desc: "job scheduling", color: "#f59e0b" },
              { cmd: "ssh", desc: "remote shell", color: "#f59e0b" },
              { cmd: "curl", desc: "HTTP requests", color: "#3ddc84" },
            ].map((item) => (
              <div
                key={item.cmd}
                className="path-badge rounded-lg p-4 font-mono text-xs cursor-default hover:border-[#3ddc84]/30 transition-all duration-200"
              >
                <div className="font-bold mb-1" style={{ color: item.color }}>
                  {item.cmd}
                </div>
                <div className="text-gray-600 text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="community" className="py-24 border-t border-[#1a2e1a]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14 track-enter">
            <h2 className="font-display text-3xl font-extrabold text-white tracking-tight">
              From the community
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 track-enter">
            {[
              {
                initials: "SK",
                accentColor: "#22d3ee",
                accentBg: "#22d3ee10",
                accentBorder: "#22d3ee20",
                quote:
                  "I went from googling every command to writing deployment scripts in 4 weeks. The terminal sandbox is what makes it click.",
                name: "Sadia K.",
                role: "Backend Dev · Took Intermediate",
              },
              {
                initials: "MT",
                accentColor: "#f59e0b",
                accentBg: "#f59e0b10",
                accentBorder: "#f59e0b20",
                quote:
                  "The expert track is genuinely hard — in the best way. By lesson 20 I was profiling kernel calls. Nothing else teaches this.",
                name: "Marcus T.",
                role: "SRE · Took Expert",
              },
              {
                initials: "AL",
                accentColor: "#3ddc84",
                accentBg: "#3ddc8410",
                accentBorder: "#3ddc8420",
                quote:
                  "As a designer learning to code, the beginner track was perfect. No assumptions, no condescension. Just clear, real tasks.",
                name: "Aiko L.",
                role: "Designer → Dev · Took Beginner",
              },
            ].map((t) => (
              <div
                key={t.initials}
                className="border border-[#1a2e1a] rounded-xl p-6 bg-[#0d120d]"
              >
                <div className="font-mono text-xs text-[#3ddc84] mb-4">
                  ★★★★★
                </div>
                <p className="text-gray-400 text-sm font-mono leading-relaxed mb-5">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold"
                    style={{
                      background: t.accentBg,
                      border: `1px solid ${t.accentBorder}`,
                      color: t.accentColor,
                    }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-display text-sm text-white font-semibold">
                      {t.name}
                    </div>
                    <div className="font-mono text-xs text-gray-600">
                      {t.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section className="py-24 border-t border-[#1a2e1a] relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[#3ddc84]/5 blur-[100px]" />
        <div className="relative z-10 max-w-2xl mx-auto px-6 text-center track-enter">
          <div className="font-mono text-xs text-gray-600 mb-4 terminal-line">
            open terminal
          </div>
          <h2 className="font-display text-5xl font-extrabold text-white tracking-tight mb-4">
            Ready to ship
            <br />
            <span className="text-[#3ddc84] glow-text">real shell skills?</span>
          </h2>
          <p className="text-gray-500 font-mono text-sm mb-10">
            Free forever on the first module. No card required.
          </p>
          <button
            onClick={scrollToTracks}
            className="bg-[#3ddc84] text-black font-display font-bold text-sm px-10 py-4 rounded hover:bg-[#3ddc84]/90 transition-all duration-200 hover:scale-[1.02] glow-green"
          >
            Pick your track →
          </button>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 font-mono text-xs text-gray-600">
            <span>✓ browser-based terminal</span>
            <span>✓ no setup required</span>
            <span>✓ free first module</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#1a2e1a] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded border border-[#3ddc84]/40 flex items-center justify-center">
              <span className="text-[#3ddc84] font-mono text-xs font-bold">
                $_
              </span>
            </div>
            <span className="font-display text-xs text-gray-600">
              LinuxMastery
            </span>
          </div>
          <div className="font-mono text-xs text-gray-700">
            built with ❤ for terminal lovers
          </div>
          <div className="flex items-center gap-5 font-mono text-xs text-gray-600">
            <a href="#" className="hover:text-gray-400 transition-colors">
              privacy
            </a>
            <a href="#" className="hover:text-gray-400 transition-colors">
              terms
            </a>
            <a href="#" className="hover:text-gray-400 transition-colors">
              github
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function TrackCard({
  delay,
  accentColor,
  number,
  level,
  title,
  description,
  topics,
  meta,
  hoverClass,
  topLineClass,
  featured,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={`track-enter group relative bg-[#0d120d] border rounded-xl p-7 cursor-pointer transition-all duration-300 ${hoverClass} ${featured ? "border-[#3ddc84]/30 scale-[1.02]" : "border-[#1a2e1a]"}`}
      style={{ transitionDelay: delay }}
    >
      {/* Top accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${topLineClass} to-transparent rounded-t-xl`}
      />

      {/* Featured badge */}
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3ddc84] text-black font-mono text-xs font-bold px-3 py-1 rounded-full">
          most popular
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            border: `1px solid ${accentColor}30`,
            background: `${accentColor}08`,
          }}
        >
          <TrackIcon level={level} color={accentColor} />
        </div>
        <span
          className="font-mono text-xs px-2.5 py-1 rounded-full"
          style={{
            color: accentColor,
            border: `1px solid ${accentColor}20`,
            background: `${accentColor}08`,
          }}
        >
          {number}
        </span>
      </div>

      <div className="mb-1">
        <span className="font-mono text-xs" style={{ color: accentColor }}>
          {level}
        </span>
      </div>
      <h3 className="font-display text-2xl font-bold text-white mb-3">
        {title}
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-6 font-mono">
        {description}
      </p>

      <div className="space-y-2 mb-7">
        {topics.map((t) => (
          <div
            key={t}
            className="flex items-center gap-2.5 font-mono text-xs text-gray-500"
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: `${accentColor}80` }}
            />
            {t}
          </div>
        ))}
      </div>

      <div
        className="flex items-center justify-between pt-5"
        style={{
          borderTop: `1px solid ${featured ? accentColor + "20" : "#1a2e1a"}`,
        }}
      >
        <div className="font-mono text-xs text-gray-600">{meta}</div>
        <button
          className="font-mono text-xs flex items-center gap-1 group-hover:gap-2 transition-all duration-200"
          style={{
            color: accentColor,
            fontWeight: featured ? "bold" : "normal",
          }}
        >
          start{" "}
          <span className="group-hover:translate-x-0.5 transition-transform duration-200">
            →
          </span>
        </button>
      </div>
    </div>
  );
}

function TrackIcon({ level, color }) {
  if (level === "beginner")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    );
  if (level === "intermediate")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function LessonRow({ status, label }) {
  const configs = {
    done: {
      badge: (
        <span className="w-5 h-5 rounded bg-[#3ddc84]/10 border border-[#3ddc84]/20 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 12 10" fill="none">
            <path
              d="M1 5l3.5 3.5L11 1"
              stroke="#3ddc84"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ),
      labelClass: "text-gray-400",
      statusEl: <span className="font-mono text-xs text-[#3ddc84]">done</span>,
      rowClass: "",
    },
    active: {
      badge: (
        <span className="w-5 h-5 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
        </span>
      ),
      labelClass: "text-white",
      statusEl: (
        <span className="font-mono text-xs text-[#f59e0b]">active</span>
      ),
      rowClass: "bg-[#3ddc84]/3 border-l-2 border-[#3ddc84]",
    },
    locked: {
      badge: (
        <span className="w-5 h-5 rounded border border-[#1a2e1a] flex items-center justify-center">
          <span className="font-mono text-xs text-gray-600">
            {label.split("—")[0].trim().replace("0", "")}
          </span>
        </span>
      ),
      labelClass: "text-gray-500",
      statusEl: <span className="font-mono text-xs text-gray-600">locked</span>,
      rowClass: "opacity-50",
    },
  };

  const c = configs[status];
  return (
    <div
      className={`px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer ${c.rowClass}`}
    >
      <div className="flex items-center gap-3">
        {c.badge}
        <span className={`font-mono text-xs ${c.labelClass}`}>{label}</span>
      </div>
      {c.statusEl}
    </div>
  );
}
