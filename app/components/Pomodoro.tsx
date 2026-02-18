"use client";

import { useState } from "react";
import styles from "./Pomodoro.module.css";
import type { Task, Section } from "./Dashboard";
import TaskNotes from "./TaskNotes";
import SectionColorPicker from "./SectionColorPicker";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PomodoroProps {
  tasks: Task[];
  selectedDate: string;
  sections: Section[];
  onAddTask: (text: string, sectionId?: number | null) => void;
  onToggleTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onReorderTasks: (fromIndex: number, toIndex: number) => void;
  onRenameTask: (id: number, text: string) => void;
  onUpdateDescription: (id: number, description: string) => void;
  onAddSection: (name: string) => Promise<number | null>;
  onRenameSection: (id: number, name: string) => void;
  onUpdateSectionColor: (id: number, color: string) => void;
  onDeleteSection: (id: number) => void;
  onUpdateTaskSection: (taskId: number, sectionId: number | null) => void;
  onReorderSections: (fromIndex: number, toIndex: number) => void;
}

export default function Pomodoro({
  tasks,
  selectedDate,
  sections,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onReorderTasks,
  onRenameTask,
  onUpdateDescription,
  onAddSection,
  onRenameSection,
  onUpdateSectionColor,
  onDeleteSection,
  onUpdateTaskSection,
  onReorderSections,
}: PomodoroProps) {
  const [newTask, setNewTask] = useState("");
  const [newTaskSection, setNewTaskSection] = useState<string>("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
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

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTask.trim();
    if (!text) return;

    if (newTaskSection === "__new__") {
      const name = window.prompt("New section name:");
      if (!name || !name.trim()) return;
      const newId = await onAddSection(name.trim());
      if (newId != null) {
        onAddTask(text, newId);
        setNewTaskSection(String(newId));
      }
    } else {
      const sectionId = newTaskSection === "" ? null : Number(newTaskSection);
      onAddTask(text, sectionId);
    }
    setNewTask("");
  };

  const toggleSectionCollapse = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  // Only show sections that have tasks on the current date
  const activeSectionIds = new Set(tasks.map((t) => t.sectionId).filter(Boolean));
  const visibleSections = sections.filter((s) => activeSectionIds.has(s.id));

  return (
    <div className={styles.container}>
      {/* Date Heading */}
      <div className={styles.dateRow}>
        <h2 className={styles.dateHeading}>{dateHeading}</h2>
      </div>

      {/* Task List */}
      <section className={styles.taskSection}>
        <h2 className={styles.taskHeader}>Tasks</h2>

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

        {/* Unified Add Task Form */}
        <form className={styles.taskForm} onSubmit={addTask}>
          <input
            className={styles.taskInput}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task…"
          />
          <select
            className={styles.taskFormSelect}
            value={newTaskSection}
            onChange={(e) => {
              setNewTaskSection(e.target.value);
            }}
          >
            <option value="">{uncategorizedName}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new__">+ New Section</option>
          </select>
          <button type="submit" className={styles.addBtn}>Add</button>
        </form>

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
              )}
            </div>
          );
        })()}

        {/* Named Sections (only those with tasks on current date) */}
        {visibleSections.map((section, sectionIdx) => {
          const actualIdx = sections.indexOf(section);
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
                  dragSectionIndex === actualIdx ? styles.sectionHeaderDragging : "",
                  dragOverSectionIndex === actualIdx ? styles.sectionHeaderDragOver : "",
                ].filter(Boolean).join(" ")}
                draggable
                onDragStart={(e) => {
                  setDragSectionIndex(actualIdx);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/pomo-section", String(actualIdx));
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("application/pomo-section")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverSectionIndex(actualIdx);
                  }
                }}
                onDragLeave={() => setDragOverSectionIndex(null)}
                onDrop={(e) => {
                  if (e.dataTransfer.types.includes("application/pomo-section")) {
                    e.preventDefault();
                    e.stopPropagation();
                    const fromIdx = Number(e.dataTransfer.getData("application/pomo-section"));
                    if (fromIdx !== actualIdx) {
                      onReorderSections(fromIdx, actualIdx);
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
              )}
            </div>
          );
        })}

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
    </div>
  );
}
