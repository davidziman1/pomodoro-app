"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./Timer.module.css";
import type { Stats } from "./Dashboard";

type Mode = "focus" | "shortBreak" | "longBreak";

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS: Record<Mode, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const ACCENT: Record<Mode, string> = {
  focus: "#bb9af7",
  shortBreak: "#9ece6a",
  longBreak: "#7aa2f7",
};

const RADIUS = 115;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    // second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1000;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
    osc2.start(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 1.1);
  } catch {}
}

interface TimerProps {
  stats: Stats;
  onFocusComplete: () => void;
}

export default function Timer({ stats, onFocusComplete }: TimerProps) {
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);

  const focusCompleteRef = useRef(onFocusComplete);
  focusCompleteRef.current = onFocusComplete;

  // Countdown
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setIsRunning(false);
          playBeep();

          if (mode === "focus") {
            focusCompleteRef.current();
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, mode]);

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setTimeLeft(DURATIONS[m]);
    setIsRunning(false);
  }, []);

  const toggleTimer = useCallback(() => {
    if (timeLeft === 0) {
      setTimeLeft(DURATIONS[mode]);
    }
    setIsRunning((r) => !r);
  }, [timeLeft, mode]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(DURATIONS[mode]);
  }, [mode]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        toggleTimer();
      } else if (e.code === "KeyR") {
        resetTimer();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleTimer, resetTimer]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = 1 - timeLeft / DURATIONS[mode];
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const accent = ACCENT[mode];

  return (
    <div className={styles.timerContainer}>
      {/* Mode Tabs */}
      <div className={styles.modes}>
        {(["focus", "shortBreak", "longBreak"] as Mode[]).map((m) => (
          <button
            key={m}
            data-mode={m}
            className={mode === m ? styles.modeBtnActive : styles.modeBtn}
            onClick={() => switchMode(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer */}
      <div className={styles.timerWrapper}>
        <svg className={styles.timerSvg} viewBox="0 0 260 260">
          <circle className={styles.trackRing} cx="130" cy="130" r={RADIUS} />
          <circle
            className={styles.progressRing}
            cx="130"
            cy="130"
            r={RADIUS}
            stroke={accent}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className={styles.timerDisplay}>
          <span className={styles.time}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <span className={styles.modeLabel} style={{ color: accent }}>
            {MODE_LABELS[mode]}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button
          className={styles.startBtn}
          style={{ background: accent }}
          onClick={toggleTimer}
        >
          {isRunning ? "Pause" : timeLeft === 0 ? "Restart" : "Start"}
        </button>
        <button className={styles.resetBtn} onClick={resetTimer}>
          Reset
        </button>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.sessionsCompleted}</div>
          <div className={styles.statLabel}>Sessions</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.totalFocusMinutes}m</div>
          <div className={styles.statLabel}>Focus Time</div>
        </div>
      </div>

      <p className={styles.hint}>Space to start/pause · R to reset</p>
    </div>
  );
}
