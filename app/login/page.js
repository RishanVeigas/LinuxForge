"use client";
import { useState, useEffect, useRef } from "react";

// ── Password strength checker ─────────────────────────────────────────────────
function getStrength(pw) {
  return {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
  };
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StrengthMeter({ password }) {
  const checks = getStrength(password);
  const score = Object.values(checks).filter(Boolean).length;
  const colors = ["#ef4444", "#f59e0b", "#3ddc84"];
  const barColor = password ? colors[score - 1] : "#1a2e1a";

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 2,
              borderRadius: 2,
              background: password && i < score ? barColor : "#1a2e1a",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { key: "length", label: "8+ chars" },
          { key: "uppercase", label: "uppercase" },
          { key: "number", label: "number" },
        ].map(({ key, label }) => (
          <span
            key={key}
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: checks[key] ? "#3ddc84" : "#374151",
              transition: "color 0.2s",
            }}
          >
            {checks[key] ? "✓" : "○"} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  onEnter,
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontFamily: "monospace",
          fontSize: 10,
          color: "#6b7280",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          style={{
            width: "100%",
            background: "#080c08",
            border: "1px solid #1a2e1a",
            borderRadius: 5,
            padding: isPassword ? "9px 44px 9px 12px" : "9px 12px",
            color: "#e5e7eb",
            fontSize: 12,
            fontFamily: "monospace",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#3ddc8450")}
          onBlur={(e) => (e.target.style.borderColor = "#1a2e1a")}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "#4b5563",
              fontSize: 10,
              fontFamily: "monospace",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {show ? "hide" : "show"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Redirect / loading screen ─────────────────────────────────────────────────
function RedirectScreen({ username, progress }) {
  const steps = [
    { label: "verifying credentials", done: progress >= 25 },
    { label: "loading user profile", done: progress >= 55 },
    { label: "initialising workspace", done: progress >= 80 },
    { label: "redirecting...", done: progress >= 100 },
  ];

  return (
    <div style={{ padding: "32px 24px" }}>
      {/* Icon */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#3ddc8412",
          border: "1px solid #3ddc8425",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 18px",
          color: "#3ddc84",
          fontSize: 18,
        }}
      >
        ✓
      </div>

      <div
        style={{
          fontFamily: "monospace",
          fontSize: 13,
          color: "#fff",
          textAlign: "center",
          marginBottom: 4,
        }}
      >
        Welcome back, {username}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "#4b5563",
          textAlign: "center",
          marginBottom: 22,
        }}
      >
        session established
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 2,
          background: "#1a2e1a",
          borderRadius: 2,
          marginBottom: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #3ddc84, #22d3ee)",
            borderRadius: 2,
            transition: "width 0.4s ease",
            boxShadow: "0 0 8px #3ddc8480",
          }}
        />
      </div>

      {/* Step list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map(({ label, done }, i) => {
          const active = !done && steps.slice(0, i).every((s) => s.done);
          return (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "monospace",
                fontSize: 10,
                color: done ? "#3ddc84" : active ? "#e5e7eb" : "#1f2937",
                transition: "color 0.3s",
              }}
            >
              <span style={{ width: 12, textAlign: "center" }}>
                {done ? "✓" : active ? "›" : "·"}
              </span>
              {label}
              {active && (
                <span
                  style={{
                    display: "inline-block",
                    animation: "blink 0.7s step-end infinite",
                  }}
                >
                  ▊
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

// ── Session success screen ────────────────────────────────────────────────────
function SessionView({ username, email, onLogout }) {
  return (
    <div style={{ padding: "28px 24px", textAlign: "center" }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#3ddc8412",
          border: "1px solid #3ddc8425",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
          color: "#3ddc84",
          fontSize: 18,
        }}
      >
        ✓
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 15,
          color: "#fff",
          marginBottom: 3,
        }}
      >
        {username}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "#4b5563",
          marginBottom: 20,
        }}
      >
        {email}
      </div>
      <div
        style={{
          border: "1px solid #1a2e1a",
          borderRadius: 6,
          padding: "12px 14px",
          textAlign: "left",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "#3ddc84",
            marginBottom: 8,
          }}
        >
          $ ls ~/.session
        </div>
        {[
          ["access_token", "15m TTL"],
          ["refresh_token", "httpOnly cookie"],
          ["rotation", "enabled"],
          ["bcrypt_rounds", "12"],
        ].map(([k, v]) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "monospace",
              fontSize: 10,
              padding: "3px 0",
              borderBottom: "1px solid #0f1f0f",
            }}
          >
            <span style={{ color: "#4b5563" }}>{k}</span>
            <span style={{ color: "#22d3ee" }}>{v}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onLogout}
        style={{
          width: "100%",
          background: "transparent",
          border: "1px solid #1a2e1a",
          borderRadius: 5,
          padding: "9px",
          color: "#6b7280",
          fontFamily: "monospace",
          fontSize: 11,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#ef444435";
          e.currentTarget.style.color = "#ef4444";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#1a2e1a";
          e.currentTarget.style.color = "#6b7280";
        }}
      >
        $ logout
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LinuxForgeAuth() {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // "auth" | "redirecting" | "dashboard"
  const [phase, setPhase] = useState("auth");
  const [redirectProgress, setRedirectProgress] = useState(0);
  const [user, setUser] = useState(null);
  const cursorRef = useRef(null);

  // Blinking cursor
  useEffect(() => {
    const id = setInterval(() => {
      if (cursorRef.current)
        cursorRef.current.style.opacity =
          cursorRef.current.style.opacity === "0" ? "1" : "0";
    }, 530);
    return () => clearInterval(id);
  }, []);

  // Redirect progress animation
  useEffect(() => {
    if (phase !== "redirecting") return;

    setRedirectProgress(0);
    const steps = [
      { target: 30, delay: 200 },
      { target: 60, delay: 700 },
      { target: 85, delay: 1300 },
      { target: 100, delay: 1900 },
    ];

    const timers = steps.map(({ target, delay }) =>
      setTimeout(() => setRedirectProgress(target), delay),
    );

    // Redirect to main page after animation completes
    const done = setTimeout(() => {
      window.location.href = "/";
    }, 2700);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [phase]);

  const switchTab = (t) => {
    setTab(t);
    setEmail("");
    setUsername("");
    setPassword("");
    setError("");
  };

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Enter a valid email address.";
    if (tab === "register") {
      if (!/^[a-zA-Z0-9_\-]{3,32}$/.test(username))
        return "Username: 3–32 chars — letters, numbers, _ or -.";
      const s = getStrength(password);
      if (!s.length || !s.uppercase || !s.number)
        return "Password needs 8+ chars, an uppercase letter, and a number.";
    } else {
      if (!password) return "Password is required.";
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();

    if (err) {
      setError(err);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const endpoint =
        tab === "login"
          ? "http://localhost:5000/auth/login"
          : "http://localhost:5000/auth/register";

      const body =
        tab === "login"
          ? {
              email,
              password,
            }
          : {
              email,
              password,
              username,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        // IMPORTANT for sessions/cookies
        credentials: "include",

        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Authentication failed");
        setLoading(false);
        return;
      }

      const loggedInUser = {
        username: tab === "register" ? username : data.email.split("@")[0],

        email: data.email,
      };

      setUser(loggedInUser);

      setLoading(false);

      setPhase("redirecting");
    } catch (err) {
      console.error(err);

      if (err.name === "TypeError") {
        setError("Cannot connect to backend");
      } else {
        setError(err.message || "Server error");
      }

      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPhase("auth");
    setTab("login");
    setEmail("");
    setUsername("");
    setPassword("");
    setError("");
    setRedirectProgress(0);
  };

  // ── Auth / redirect card ────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: "100vh",
      background: "#080c08",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
      padding: "32px 16px",
    },
    card: {
      width: "100%",
      maxWidth: 400,
      border: "1px solid #1a2e1a",
      borderRadius: 12,
      background: "#0d120d",
      overflow: "hidden",
      position: "relative",
    },
    chrome: {
      borderBottom: "1px solid #1a2e1a",
      padding: "9px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    tab: (active) => ({
      flex: 1,
      padding: "10px",
      background: "transparent",
      border: "none",
      borderBottom: active ? "2px solid #3ddc84" : "2px solid transparent",
      color: active ? "#3ddc84" : "#4b5563",
      fontSize: 11,
      fontFamily: "monospace",
      cursor: "pointer",
      transition: "all 0.2s",
      marginBottom: -1,
    }),
    submitBtn: {
      width: "100%",
      background: loading ? "#3ddc8440" : "#3ddc84",
      border: "none",
      borderRadius: 5,
      padding: "10px",
      color: loading ? "#0008" : "#000",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "monospace",
      cursor: loading ? "not-allowed" : "pointer",
      transition: "background 0.2s",
      letterSpacing: "0.03em",
      marginTop: 4,
    },
  };

  return (
    <div style={S.page}>
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          height: 300,
          borderRadius: "50%",
          background: "#3ddc8406",
          filter: "blur(100px)",
          pointerEvents: "none",
        }}
      />

      {/* Logo — hidden during redirect */}
      {phase === "auth" && (
        <div
          style={{
            textAlign: "center",
            marginBottom: 28,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                border: "1px solid #3ddc8450",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#3ddc84",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              $_
            </div>
            <span
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              LinuxForge
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#374151" }}>
            authenticate to continue
            <span ref={cursorRef} style={{ color: "#3ddc84", marginLeft: 2 }}>
              ▊
            </span>
          </div>
        </div>
      )}

      {/* Card */}
      <div style={S.card}>
        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, #3ddc8435, transparent)",
          }}
        />

        {/* Terminal chrome */}
        <div style={S.chrome}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#ef444470", "#f59e0b70", "#3ddc8470"].map((bg) => (
              <div
                key={bg}
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: bg,
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 10, color: "#374151" }}>
            bash — {phase === "redirecting" ? user?.username : "auth"}
            @linuxforge:~
          </span>
          <span />
        </div>

        {phase === "redirecting" ? (
          <RedirectScreen
            username={user?.username}
            progress={redirectProgress}
          />
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #1a2e1a" }}>
              <button
                style={S.tab(tab === "login")}
                onClick={() => switchTab("login")}
              >
                sign in
              </button>
              <button
                style={S.tab(tab === "register")}
                onClick={() => switchTab("register")}
              >
                register
              </button>
            </div>

            {/* Form */}
            <div style={{ padding: "24px" }}>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "#3ddc84",
                  marginBottom: 18,
                }}
              >
                $ auth --{tab === "login" ? "login" : "register"}
              </div>

              {error && (
                <div
                  style={{
                    background: "#ef444408",
                    border: "1px solid #ef444425",
                    borderRadius: 5,
                    padding: "8px 12px",
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "#ef4444",
                    marginBottom: 14,
                  }}
                >
                  ✗ {error}
                </div>
              )}

              <Field
                label="email"
                type="email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setError("");
                }}
                placeholder="you@example.com"
                autoComplete="email"
                onEnter={handleSubmit}
              />

              {tab === "register" && (
                <Field
                  label="username"
                  value={username}
                  onChange={(v) => {
                    setUsername(v);
                    setError("");
                  }}
                  placeholder="your_handle"
                  autoComplete="username"
                  onEnter={handleSubmit}
                />
              )}

              <Field
                label="password"
                type="password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setError("");
                }}
                placeholder="••••••••"
                autoComplete={
                  tab === "login" ? "current-password" : "new-password"
                }
                onEnter={handleSubmit}
              />
              {tab === "register" && <StrengthMeter password={password} />}

              <button
                style={{
                  ...S.submitBtn,
                  marginTop: tab === "register" ? 14 : 4,
                }}
                onClick={handleSubmit}
                disabled={loading}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = "#3ddc84dd";
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.background = "#3ddc84";
                }}
              >
                {loading
                  ? tab === "login"
                    ? "authenticating..."
                    : "creating account..."
                  : tab === "login"
                    ? "$ sign in →"
                    : "$ create account →"}
              </button>

              <p
                style={{
                  textAlign: "center",
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "#4b5563",
                  marginTop: 12,
                }}
              >
                {tab === "login" ? "No account? " : "Have an account? "}
                <button
                  onClick={() =>
                    switchTab(tab === "login" ? "register" : "login")
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "#3ddc84",
                    fontFamily: "monospace",
                    fontSize: 10,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {tab === "login" ? "register" : "sign in"}
                </button>
              </p>
            </div>
          </>
        )}

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #1a2e1a",
            padding: "8px 14px",
            display: "flex",
            justifyContent: "center",
            gap: 18,
          }}
        >
          {["httpOnly cookies", "JWT rotation", "bcrypt"].map((f) => (
            <span
              key={f}
              style={{ fontFamily: "monospace", fontSize: 9, color: "#1f2937" }}
            >
              ✓ {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
