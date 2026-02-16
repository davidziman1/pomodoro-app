"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./Pomodoro.module.css";

type Mode = "focus" | "shortBreak" | "longBreak";

interface Task {
  id: number;
  text: string;
  completed: boolean;
  pomodorosSpent: number;
}

interface Stats {
  totalFocusMinutes: number;
  sessionsToday: number;
  date: string;
}

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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("pomo-tasks");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadStats(): Stats {
  const empty: Stats = { totalFocusMinutes: 0, sessionsToday: 0, date: todayStr() };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem("pomo-stats");
    if (!raw) return empty;
    const parsed: Stats = JSON.parse(raw);
    if (parsed.date !== todayStr()) return empty;
    return parsed;
  } catch {
    return empty;
  }
}

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

export default function Pomodoro() {
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({ totalFocusMinutes: 0, sessionsToday: 0, date: todayStr() });
  const [newTask, setNewTask] = useState("");
  const [mounted, setMounted] = useState(false);

  const activeTaskRef = useRef<number | null>(null);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setTasks(loadTasks());
    setStats(loadStats());
    setMounted(true);
  }, []);

  // Persist tasks
  useEffect(() => {
    if (mounted) localStorage.setItem("pomo-tasks", JSON.stringify(tasks));
  }, [tasks, mounted]);

  // Persist stats
  useEffect(() => {
    if (mounted) localStorage.setItem("pomo-stats", JSON.stringify(stats));
  }, [stats, mounted]);

  // Countdown
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setIsRunning(false);
          playBeep();

          // Update stats if focus session completed
          if (mode === "focus") {
            setStats((s) => ({
              ...s,
              totalFocusMinutes: s.totalFocusMinutes + DURATIONS.focus / 60,
              sessionsToday: s.sessionsToday + 1,
              date: todayStr(),
            }));

            // Increment pomodoros on first incomplete task
            setTasks((prev) => {
              const idx = prev.findIndex((t) => !t.completed);
              if (idx === -1) return prev;
              const copy = [...prev];
              copy[idx] = { ...copy[idx], pomodorosSpent: copy[idx].pomodorosSpent + 1 };
              return copy;
            });
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

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: Date.now(), text, completed: false, pomodorosSpent: 0 }]);
    setNewTask("");
  };

  const toggleTask = (id: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Derived values
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = 1 - timeLeft / DURATIONS[mode];
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const accent = ACCENT[mode];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Pomodoro Dashboard</h1>

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
          <div className={styles.statValue}>{mounted ? stats.sessionsToday : 0}</div>
          <div className={styles.statLabel}>Sessions</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{mounted ? stats.totalFocusMinutes : 0}m</div>
          <div className={styles.statLabel}>Focus Time</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{mounted ? tasks.filter((t) => t.completed).length : 0}</div>
          <div className={styles.statLabel}>Tasks Done</div>
        </div>
      </div>

      {/* Task List */}
      <section className={styles.taskSection}>
        <h2 className={styles.taskHeader}>Tasks</h2>
        <form className={styles.taskForm} onSubmit={addTask}>
          <input
            className={styles.taskInput}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task…"
          />
          <button type="submit" className={styles.addBtn}>
            Add
          </button>
        </form>
        <ul className={styles.taskList}>
          {tasks.map((task) => (
            <li key={task.id} className={styles.taskItem}>
              <input
                type="checkbox"
                className={styles.taskCheckbox}
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
              />
              <span className={task.completed ? styles.taskTextDone : styles.taskText}>
                {task.text}
              </span>
              {task.pomodorosSpent > 0 && (
                <span className={styles.pomCount}>{task.pomodorosSpent} pom</span>
              )}
              <button className={styles.deleteBtn} onClick={() => deleteTask(task.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.hint}>Space to start/pause · R to reset</p>
    </div>
  );
}
