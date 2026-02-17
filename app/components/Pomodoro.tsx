"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./Pomodoro.module.css";
import type { Task, Stats } from "./Dashboard";
import TaskNotes from "./TaskNotes";

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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PomodoroProps {
  tasks: Task[];
  stats: Stats;
  selectedDate: string;
  onAddTask: (text: string) => void;
  onToggleTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onReorderTasks: (fromIndex: number, toIndex: number) => void;
  onUpdateDescription: (id: number, description: string) => void;
  onFocusComplete: () => void;
}

export default function Pomodoro({
  tasks,
  stats,
  selectedDate,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onReorderTasks,
  onUpdateDescription,
  onFocusComplete,
}: PomodoroProps) {
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [timerVisible, setTimerVisible] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

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

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    onAddTask(text);
    setNewTask("");
  };

  // Derived values
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = 1 - timeLeft / DURATIONS[mode];
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const accent = ACCENT[mode];

  // Split tasks into incomplete and completed
  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const completedCount = completedTasks.length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Format selected date for display
  const isToday = selectedDate === todayStr();
  const dateHeading = isToday
    ? "Today"
    : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

  // Short date label for task header
  const dateLabel = isToday
    ? "Today"
    : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

  return (
    <div className={styles.container}>
      {/* Date Heading + Timer Toggle */}
      <div className={styles.dateRow}>
        <h2 className={styles.dateHeading}>{dateHeading}</h2>
        <button
          className={styles.timerToggle}
          onClick={() => setTimerVisible((v) => !v)}
          title={timerVisible ? "Hide timer" : "Show timer"}
        >
          {timerVisible ? "Hide Timer" : "Show Timer"}
        </button>
      </div>

      {timerVisible && <>
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
        <div className={styles.stat}>
          <div className={styles.statValue}>{completedCount}</div>
          <div className={styles.statLabel}>Tasks Done</div>
        </div>
      </div>
      </>}

      {/* Task List */}
      <section className={styles.taskSection}>
        <h2 className={styles.taskHeader}>
          Tasks
        </h2>
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

        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className={styles.progressWrapper}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className={styles.progressLabel}>
              {completedCount} of {totalCount} done
            </div>
          </div>
        )}

        {/* Incomplete Tasks */}
        <ul className={styles.taskList}>
          {incompleteTasks.map((task) => {
            const originalIndex = tasks.indexOf(task);
            const isExpanded = expandedTaskId === task.id;
            return (
              <li key={task.id} className={styles.taskItemWrapper}>
                <div
                  className={[
                    styles.taskItem,
                    dragIndex === originalIndex ? styles.taskItemDragging : "",
                    dragOverIndex === originalIndex ? styles.taskItemDragOver : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(originalIndex);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("application/pomo-task", String(task.id));
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverIndex(originalIndex);
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null && dragIndex !== originalIndex) {
                      onReorderTasks(dragIndex, originalIndex);
                    }
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                >
                  <span className={styles.dragHandle}>⠿</span>
                  <input
                    type="checkbox"
                    className={styles.taskCheckbox}
                    checked={task.completed}
                    onChange={() => onToggleTask(task.id)}
                  />
                  <span className={styles.taskText}>{task.text}</span>
                  {task.pomodorosSpent > 0 && (
                    <span className={styles.pomCount}>{task.pomodorosSpent} pom</span>
                  )}
                  <button
                    className={isExpanded ? styles.notesToggleActive : styles.notesToggle}
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    title="Toggle notes"
                  >
                    ▼
                  </button>
                  <button className={styles.deleteBtn} onClick={() => onDeleteTask(task.id)}>
                    ×
                  </button>
                </div>
                {isExpanded && (
                  <div className={styles.notesPanel}>
                    <TaskNotes
                      description={task.description}
                      onSave={(html) => onUpdateDescription(task.id, html)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className={styles.completedSection}>
            <div className={styles.completedHeader}>
              <button
                className={styles.completedToggle}
                onClick={() => setCompletedOpen((o) => !o)}
              >
                <span className={completedOpen ? styles.completedArrowOpen : styles.completedArrow}>
                  ▶
                </span>
                Completed ({completedTasks.length})
              </button>
            </div>
            {completedOpen && (
              <ul className={styles.completedList}>
                {completedTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id;
                  return (
                    <li key={task.id} className={styles.taskItemWrapper}>
                      <div className={styles.completedTaskItem}>
                        <input
                          type="checkbox"
                          className={styles.taskCheckbox}
                          checked={task.completed}
                          onChange={() => onToggleTask(task.id)}
                        />
                        <span className={styles.taskTextDone}>{task.text}</span>
                        {task.pomodorosSpent > 0 && (
                          <span className={styles.pomCount}>{task.pomodorosSpent} pom</span>
                        )}
                        <button
                          className={isExpanded ? styles.notesToggleActive : styles.notesToggle}
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          title="Toggle notes"
                        >
                          ▼
                        </button>
                        <button className={styles.deleteBtn} onClick={() => onDeleteTask(task.id)}>
                          ×
                        </button>
                      </div>
                      {isExpanded && (
                        <div className={styles.notesPanel}>
                          <TaskNotes
                            description={task.description}
                            onSave={(html) => onUpdateDescription(task.id, html)}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      <p className={styles.hint}>Drag tasks to calendar dates to reschedule</p>
      <p className={styles.hint}>Space to start/pause · R to reset</p>
    </div>
  );
}
