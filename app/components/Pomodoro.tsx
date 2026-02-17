"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./Pomodoro.module.css";
import type { Task, Stats, Section } from "./Dashboard";
import TaskNotes from "./TaskNotes";
import SectionColorPicker from "./SectionColorPicker";

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
  sections: Section[];
  onAddTask: (text: string, sectionId?: number | null) => void;
  onToggleTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onReorderTasks: (fromIndex: number, toIndex: number) => void;
  onRenameTask: (id: number, text: string) => void;
  onUpdateDescription: (id: number, description: string) => void;
  onFocusComplete: () => void;
  onAddSection: (name: string) => void;
  onRenameSection: (id: number, name: string) => void;
  onUpdateSectionColor: (id: number, color: string) => void;
  onDeleteSection: (id: number) => void;
  onUpdateTaskSection: (taskId: number, sectionId: number | null) => void;
  onReorderSections: (fromIndex: number, toIndex: number) => void;
}

export default function Pomodoro({
  tasks,
  stats,
  selectedDate,
  sections,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onReorderTasks,
  onRenameTask,
  onUpdateDescription,
  onFocusComplete,
  onAddSection,
  onRenameSection,
  onUpdateSectionColor,
  onDeleteSection,
  onUpdateTaskSection,
  onReorderSections,
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
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [sectionTasks, setSectionTasks] = useState<Record<number, string>>({});
  const [renamingSectionId, setRenamingSectionId] = useState<number | null>(null);
  const [renamingSectionText, setRenamingSectionText] = useState("");
  const [colorPickerSectionId, setColorPickerSectionId] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [dragOverSectionId, setDragOverSectionId] = useState<number | null | undefined>(undefined);
  const [dragSectionIndex, setDragSectionIndex] = useState<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);
  const [uncategorizedName, setUncategorizedName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pomo-uncategorized-name") || "Uncategorized";
    }
    return "Uncategorized";
  });

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

  const addTask = (e: React.FormEvent, sectionId?: number | null) => {
    e.preventDefault();
    if (sectionId != null) {
      const text = (sectionTasks[sectionId] || "").trim();
      if (!text) return;
      onAddTask(text, sectionId);
      setSectionTasks((prev) => ({ ...prev, [sectionId]: "" }));
    } else {
      const text = newTask.trim();
      if (!text) return;
      onAddTask(text);
      setNewTask("");
    }
  };

  const toggleSectionCollapse = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

        {/* Uncategorized Section */}
        {(() => {
          const uncategorized = incompleteTasks.filter((t) => t.sectionId == null);
          const isCollapsed = collapsedSections.has("uncategorized");
          return (
            <div
              className={[styles.sectionGroup, dragOverSectionId === null ? styles.sectionDragOver : ""].filter(Boolean).join(" ")}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/pomo-task")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverSectionId(null);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverSectionId(undefined);
                }
              }}
              onDrop={(e) => {
                if (e.dataTransfer.types.includes("application/pomo-task")) {
                  e.preventDefault();
                  const taskId = Number(e.dataTransfer.getData("application/pomo-task"));
                  const task = tasks.find((t) => t.id === taskId);
                  if (task && task.sectionId !== null) {
                    onUpdateTaskSection(taskId, null);
                  }
                  setDragOverSectionId(undefined);
                  setDragIndex(null);
                  setDragOverIndex(null);
                }
              }}
            >
              <div className={styles.sectionHeader}>
                <button
                  className={styles.sectionCollapseBtn}
                  onClick={() => toggleSectionCollapse("uncategorized")}
                >
                  <span className={isCollapsed ? styles.completedArrow : styles.completedArrowOpen}>▶</span>
                </button>
                <span className={styles.sectionDot} style={{ background: "var(--text-muted)" }} />
                {renamingSectionId === -1 ? (
                  <input
                    className={styles.sectionNameInput}
                    value={renamingSectionText}
                    onChange={(e) => setRenamingSectionText(e.target.value)}
                    onBlur={() => {
                      const trimmed = renamingSectionText.trim() || "Uncategorized";
                      setUncategorizedName(trimmed);
                      localStorage.setItem("pomo-uncategorized-name", trimmed);
                      setRenamingSectionId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      else if (e.key === "Escape") setRenamingSectionId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className={styles.sectionName}
                    onClick={() => { setRenamingSectionId(-1); setRenamingSectionText(uncategorizedName); }}
                    title="Click to rename"
                  >
                    {uncategorizedName}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <>
                  <form className={styles.taskForm} onSubmit={(e) => addTask(e)}>
                    <input
                      className={styles.taskInput}
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      placeholder="Add a task…"
                    />
                    <button type="submit" className={styles.addBtn}>Add</button>
                  </form>
                  <ul className={styles.taskList}>
                    {uncategorized.map((task) => {
                      const originalIndex = tasks.indexOf(task);
                      const isExpanded = expandedTaskId === task.id;
                      return (
                        <li key={task.id} className={styles.taskItemWrapper}>
                          <div
                            className={[
                              styles.taskItem,
                              dragIndex === originalIndex ? styles.taskItemDragging : "",
                              dragOverIndex === originalIndex ? styles.taskItemDragOver : "",
                            ].filter(Boolean).join(" ")}
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
                            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                          >
                            <span className={styles.dragHandle}>⠿</span>
                            <input type="checkbox" className={styles.taskCheckbox} checked={task.completed} onChange={() => onToggleTask(task.id)} />
                            {editingTaskId === task.id ? (
                              <input
                                className={styles.taskEditInput}
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onBlur={() => {
                                  const trimmed = editingText.trim();
                                  if (trimmed && trimmed !== task.text) onRenameTask(task.id, trimmed);
                                  setEditingTaskId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  else if (e.key === "Escape") setEditingTaskId(null);
                                }}
                                autoFocus
                              />
                            ) : (
                              <span className={styles.taskText} onClick={() => { setEditingTaskId(task.id); setEditingText(task.text); }}>{task.text}</span>
                            )}
                            {task.pomodorosSpent > 0 && <span className={styles.pomCount}>{task.pomodorosSpent} pom</span>}
                            <button className={isExpanded ? styles.notesToggleActive : styles.notesToggle} onClick={() => setExpandedTaskId(isExpanded ? null : task.id)} title="Toggle notes">
                              {isExpanded ? "▾" : "✎"}
                            </button>
                            <button className={styles.deleteBtn} onClick={() => onDeleteTask(task.id)}>×</button>
                          </div>
                          {isExpanded && (
                            <div className={styles.notesPanel}>
                              <TaskNotes description={task.description} onSave={(html) => onUpdateDescription(task.id, html)} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          );
        })()}

        {/* Named Sections */}
        {sections.map((section, sectionIdx) => {
          const sectionIncompleteTasks = incompleteTasks.filter((t) => t.sectionId === section.id);
          const isCollapsed = collapsedSections.has(`section-${section.id}`);
          return (
            <div
              key={section.id}
              className={[styles.sectionGroup, dragOverSectionId === section.id ? styles.sectionDragOver : ""].filter(Boolean).join(" ")}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/pomo-task")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverSectionId(section.id);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverSectionId(undefined);
                }
              }}
              onDrop={(e) => {
                if (e.dataTransfer.types.includes("application/pomo-task")) {
                  e.preventDefault();
                  const taskId = Number(e.dataTransfer.getData("application/pomo-task"));
                  const task = tasks.find((t) => t.id === taskId);
                  if (task && task.sectionId !== section.id) {
                    onUpdateTaskSection(taskId, section.id);
                  }
                  setDragOverSectionId(undefined);
                  setDragIndex(null);
                  setDragOverIndex(null);
                }
              }}
            >
              <div
                className={[
                  styles.sectionHeader,
                  dragSectionIndex === sectionIdx ? styles.sectionHeaderDragging : "",
                  dragOverSectionIndex === sectionIdx ? styles.sectionHeaderDragOver : "",
                ].filter(Boolean).join(" ")}
                draggable
                onDragStart={(e) => {
                  setDragSectionIndex(sectionIdx);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/pomo-section", String(sectionIdx));
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("application/pomo-section")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverSectionIndex(sectionIdx);
                  }
                }}
                onDragLeave={() => setDragOverSectionIndex(null)}
                onDrop={(e) => {
                  if (e.dataTransfer.types.includes("application/pomo-section")) {
                    e.preventDefault();
                    e.stopPropagation();
                    const fromIdx = Number(e.dataTransfer.getData("application/pomo-section"));
                    if (fromIdx !== sectionIdx) {
                      onReorderSections(fromIdx, sectionIdx);
                    }
                    setDragSectionIndex(null);
                    setDragOverSectionIndex(null);
                  }
                }}
                onDragEnd={() => { setDragSectionIndex(null); setDragOverSectionIndex(null); }}
              >
                <span className={styles.sectionDragHandle}>⠿</span>
                <button
                  className={styles.sectionCollapseBtn}
                  onClick={() => toggleSectionCollapse(`section-${section.id}`)}
                >
                  <span className={isCollapsed ? styles.completedArrow : styles.completedArrowOpen}>▶</span>
                </button>
                <div style={{ position: "relative" }}>
                  <button
                    className={styles.sectionDot}
                    style={{ background: section.color }}
                    onClick={() => setColorPickerSectionId(colorPickerSectionId === section.id ? null : section.id)}
                    title="Change color"
                  />
                  {colorPickerSectionId === section.id && (
                    <SectionColorPicker
                      currentColor={section.color}
                      onSelectColor={(hex) => onUpdateSectionColor(section.id, hex)}
                      onClose={() => setColorPickerSectionId(null)}
                    />
                  )}
                </div>
                {renamingSectionId === section.id ? (
                  <input
                    className={styles.sectionNameInput}
                    value={renamingSectionText}
                    onChange={(e) => setRenamingSectionText(e.target.value)}
                    onBlur={() => {
                      const trimmed = renamingSectionText.trim();
                      if (trimmed && trimmed !== section.name) onRenameSection(section.id, trimmed);
                      setRenamingSectionId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      else if (e.key === "Escape") setRenamingSectionId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className={styles.sectionName}
                    onClick={() => { setRenamingSectionId(section.id); setRenamingSectionText(section.name); }}
                    title="Click to rename"
                  >
                    {section.name}
                  </span>
                )}
                <button className={styles.sectionDeleteBtn} onClick={() => onDeleteSection(section.id)} title="Delete section">×</button>
              </div>
              {!isCollapsed && (
                <>
                  <form className={styles.taskForm} onSubmit={(e) => addTask(e, section.id)}>
                    <input
                      className={styles.taskInput}
                      value={sectionTasks[section.id] || ""}
                      onChange={(e) => setSectionTasks((prev) => ({ ...prev, [section.id]: e.target.value }))}
                      placeholder={`Add task to ${section.name}…`}
                    />
                    <button type="submit" className={styles.addBtn}>Add</button>
                  </form>
                  <ul className={styles.taskList}>
                    {sectionIncompleteTasks.map((task) => {
                      const originalIndex = tasks.indexOf(task);
                      const isExpanded = expandedTaskId === task.id;
                      return (
                        <li key={task.id} className={styles.taskItemWrapper}>
                          <div
                            className={[
                              styles.taskItem,
                              dragIndex === originalIndex ? styles.taskItemDragging : "",
                              dragOverIndex === originalIndex ? styles.taskItemDragOver : "",
                            ].filter(Boolean).join(" ")}
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
                            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                          >
                            <span className={styles.dragHandle}>⠿</span>
                            <input type="checkbox" className={styles.taskCheckbox} checked={task.completed} onChange={() => onToggleTask(task.id)} />
                            {editingTaskId === task.id ? (
                              <input
                                className={styles.taskEditInput}
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onBlur={() => {
                                  const trimmed = editingText.trim();
                                  if (trimmed && trimmed !== task.text) onRenameTask(task.id, trimmed);
                                  setEditingTaskId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  else if (e.key === "Escape") setEditingTaskId(null);
                                }}
                                autoFocus
                              />
                            ) : (
                              <span className={styles.taskText} onClick={() => { setEditingTaskId(task.id); setEditingText(task.text); }}>{task.text}</span>
                            )}
                            {task.pomodorosSpent > 0 && <span className={styles.pomCount}>{task.pomodorosSpent} pom</span>}
                            <button className={isExpanded ? styles.notesToggleActive : styles.notesToggle} onClick={() => setExpandedTaskId(isExpanded ? null : task.id)} title="Toggle notes">
                              {isExpanded ? "▾" : "✎"}
                            </button>
                            <button className={styles.deleteBtn} onClick={() => onDeleteTask(task.id)}>×</button>
                          </div>
                          {isExpanded && (
                            <div className={styles.notesPanel}>
                              <TaskNotes description={task.description} onSave={(html) => onUpdateDescription(task.id, html)} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          );
        })}

        {/* Add Section Button */}
        <button
          className={styles.addSectionBtn}
          onClick={() => onAddSection("New Section")}
        >
          + Add Section
        </button>

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
                  const taskSection = sections.find((s) => s.id === task.sectionId);
                  return (
                    <li key={task.id} className={styles.taskItemWrapper}>
                      <div className={styles.completedTaskItem}>
                        <input
                          type="checkbox"
                          className={styles.taskCheckbox}
                          checked={task.completed}
                          onChange={() => onToggleTask(task.id)}
                        />
                        {editingTaskId === task.id ? (
                          <input
                            className={styles.taskEditInput}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => {
                              const trimmed = editingText.trim();
                              if (trimmed && trimmed !== task.text) onRenameTask(task.id, trimmed);
                              setEditingTaskId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              else if (e.key === "Escape") setEditingTaskId(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className={styles.taskTextDone}
                            onClick={() => { setEditingTaskId(task.id); setEditingText(task.text); }}
                          >
                            {task.text}
                          </span>
                        )}
                        {taskSection && (
                          <span className={styles.sectionLabel} style={{ color: taskSection.color }}>
                            {taskSection.name}
                          </span>
                        )}
                        {task.pomodorosSpent > 0 && (
                          <span className={styles.pomCount}>{task.pomodorosSpent} pom</span>
                        )}
                        <button
                          className={isExpanded ? styles.notesToggleActive : styles.notesToggle}
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          title="Toggle notes"
                        >
                          {isExpanded ? "▾" : "✎"}
                        </button>
                        <button className={styles.deleteBtn} onClick={() => onDeleteTask(task.id)}>×</button>
                      </div>
                      {isExpanded && (
                        <div className={styles.notesPanel}>
                          <TaskNotes description={task.description} onSave={(html) => onUpdateDescription(task.id, html)} />
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
