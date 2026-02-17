"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import Pomodoro from "./Pomodoro";
import Calendar from "./Calendar";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";
import PlanMyDay from "./PlanMyDay";
import ReschedulePrompt from "./ReschedulePrompt";
import NamePrompt from "./NamePrompt";
import styles from "./Dashboard.module.css";

export interface Task {
  id: number;
  text: string;
  completed: boolean;
  pomodorosSpent: number;
  scheduledDate: string;
  completedAt: string | null;
  sortOrder: number;
  description: string;
  sectionId: number | null;
}

export interface Section {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
}

export interface Stats {
  totalFocusMinutes: number;
  sessionsCompleted: number;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const supabase = createClient();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({ totalFocusMinutes: 0, sessionsCompleted: 0 });
  const [taskCountsByDate, setTaskCountsByDate] = useState<Record<string, { total: number; completed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [carryoverTasks, setCarryoverTasks] = useState<Task[]>([]);
  const [reschedulePrompt, setReschedulePrompt] = useState<{ date: string; incompleteTasks: Task[] } | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const prevDateRef = useRef(selectedDate);
  const migrationDone = useRef(false);
  const hasSortOrder = useRef(true);

  // Migrate localStorage data on first load
  const migrateLocalStorage = useCallback(async () => {
    if (migrationDone.current || !user) return;
    migrationDone.current = true;

    try {
      const localTasks = localStorage.getItem("pomo-tasks");
      const localStats = localStorage.getItem("pomo-stats");

      if (!localTasks && !localStats) return;

      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (count && count > 0) {
        localStorage.removeItem("pomo-tasks");
        localStorage.removeItem("pomo-stats");
        return;
      }

      if (localTasks) {
        const parsed = JSON.parse(localTasks) as Array<{
          id: number;
          text: string;
          completed: boolean;
          pomodorosSpent: number;
        }>;
        if (parsed.length > 0) {
          const rows = parsed.map((t) => ({
            user_id: user.id,
            text: t.text,
            completed: t.completed,
            pomodoros_spent: t.pomodorosSpent,
            scheduled_date: todayStr(),
            completed_at: t.completed ? new Date().toISOString() : null,
          }));
          await supabase.from("tasks").insert(rows);
        }
      }

      if (localStats) {
        const parsed = JSON.parse(localStats) as {
          totalFocusMinutes: number;
          sessionsToday: number;
          date: string;
        };
        if (parsed.date === todayStr()) {
          await supabase.from("daily_stats").upsert({
            user_id: user.id,
            date: todayStr(),
            total_focus_minutes: parsed.totalFocusMinutes,
            sessions_completed: parsed.sessionsToday,
          }, { onConflict: "user_id,date" });
        }
      }

      localStorage.removeItem("pomo-tasks");
      localStorage.removeItem("pomo-stats");
    } catch (err) {
      console.error("Migration error:", err);
    }
  }, [user, supabase]);

  // Fetch tasks for selected date
  const fetchTasks = useCallback(async () => {
    if (!user) return;
    const { data, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("scheduled_date", selectedDate)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Fetch tasks error:", fetchError.message);
      setError("Failed to load tasks: " + fetchError.message);
      return;
    }

    if (data) {
      // Check if sort_order column exists
      hasSortOrder.current = data.length === 0 || data[0].sort_order !== undefined;

      const mapped = data.map((t) => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        pomodorosSpent: t.pomodoros_spent,
        scheduledDate: t.scheduled_date,
        completedAt: t.completed_at,
        sortOrder: t.sort_order ?? 0,
        description: t.description ?? "",
        sectionId: t.section_id ?? null,
      }));

      if (hasSortOrder.current) {
        mapped.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      }

      setTasks(mapped);
    }
  }, [user, selectedDate, supabase]);

  // Fetch stats for selected date
  const fetchStats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("daily_stats")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", selectedDate)
      .single();

    if (data) {
      setStats({
        totalFocusMinutes: data.total_focus_minutes,
        sessionsCompleted: data.sessions_completed,
      });
    } else {
      setStats({ totalFocusMinutes: 0, sessionsCompleted: 0 });
    }
  }, [user, selectedDate, supabase]);

  // Fetch task counts for the visible month (for calendar dots)
  const fetchTaskCounts = useCallback(
    async (year: number, month: number) => {
      if (!user) return;
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = new Date(year, month + 2, 0).toISOString().slice(0, 10);

      const { data } = await supabase
        .from("tasks")
        .select("scheduled_date, completed")
        .eq("user_id", user.id)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);

      if (data) {
        const counts: Record<string, { total: number; completed: number }> = {};
        data.forEach((t) => {
          if (!counts[t.scheduled_date]) {
            counts[t.scheduled_date] = { total: 0, completed: 0 };
          }
          counts[t.scheduled_date].total++;
          if (t.completed) counts[t.scheduled_date].completed++;
        });
        setTaskCountsByDate(counts);
      }
    },
    [user, supabase]
  );

  // Fetch sections
  const fetchSections = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sections")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (data) {
      setSections(
        data.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          sortOrder: s.sort_order,
        }))
      );
    }
  }, [user, supabase]);

  // Initial load: migrate then fetch, check for Plan My Day
  useEffect(() => {
    if (!user) return;
    (async () => {
      await migrateLocalStorage();
      await Promise.all([fetchTasks(), fetchStats(), fetchSections()]);
      setLoading(false);

      // Check if user is missing a name
      if (!user.user_metadata?.full_name) {
        setShowNamePrompt(true);
      }

      // Plan My Day: check for yesterday's incomplete tasks
      if (selectedDate === todayStr() && sessionStorage.getItem("pomo-planned-today") !== todayStr()) {
        const { data: yesterdayTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("scheduled_date", yesterdayStr())
          .eq("completed", false);

        if (yesterdayTasks && yesterdayTasks.length > 0) {
          setCarryoverTasks(
            yesterdayTasks.map((t) => ({
              id: t.id,
              text: t.text,
              completed: t.completed,
              pomodorosSpent: t.pomodoros_spent,
              scheduledDate: t.scheduled_date,
              completedAt: t.completed_at,
              sortOrder: t.sort_order ?? 0,
              description: t.description ?? "",
              sectionId: t.section_id ?? null,
            }))
          );
          setShowPlanModal(true);
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Refetch when selected date changes (skip initial) + auto-reschedule check
  const initialLoad = useRef(true);
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }

    // Check if navigating away from a past date with incomplete tasks
    const prevDate = prevDateRef.current;
    if (prevDate < todayStr()) {
      setTasks((currentTasks) => {
        const incomplete = currentTasks.filter((t) => !t.completed);
        if (incomplete.length > 0) {
          setReschedulePrompt({ date: prevDate, incompleteTasks: incomplete });
        }
        return currentTasks;
      });
    }
    prevDateRef.current = selectedDate;

    fetchTasks();
    fetchStats();
  }, [selectedDate, fetchTasks, fetchStats]);

  // --- Task CRUD ---

  const addTask = useCallback(
    async (text: string, sectionId?: number | null) => {
      if (!user) return;

      const insertObj: Record<string, unknown> = {
        user_id: user.id,
        text,
        scheduled_date: selectedDate,
      };

      if (sectionId != null) {
        insertObj.section_id = sectionId;
      }

      if (hasSortOrder.current) {
        insertObj.sort_order = tasks.length > 0
          ? Math.max(...tasks.map((t) => t.sortOrder)) + 1
          : 0;
      }

      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert(insertObj)
        .select()
        .single();

      if (insertError) {
        // If sort_order column doesn't exist, retry without it
        if (insertError.message.includes("sort_order")) {
          hasSortOrder.current = false;
          const { data: retryData, error: retryError } = await supabase
            .from("tasks")
            .insert({
              user_id: user.id,
              text,
              scheduled_date: selectedDate,
            })
            .select()
            .single();

          if (retryError) {
            setError("Failed to add task: " + retryError.message);
            return;
          }
          if (retryData) {
            setTasks((prev) => [
              ...prev,
              {
                id: retryData.id,
                text: retryData.text,
                completed: retryData.completed,
                pomodorosSpent: retryData.pomodoros_spent,
                scheduledDate: retryData.scheduled_date,
                completedAt: retryData.completed_at,
                sortOrder: 0,
                description: retryData.description ?? "",
                sectionId: retryData.section_id ?? null,
              },
            ]);
            setTaskCountsByDate((prev) => {
              const existing = prev[selectedDate] || { total: 0, completed: 0 };
              return { ...prev, [selectedDate]: { ...existing, total: existing.total + 1 } };
            });
          }
          return;
        }

        setError("Failed to add task: " + insertError.message);
        return;
      }

      if (data) {
        setTasks((prev) => [
          ...prev,
          {
            id: data.id,
            text: data.text,
            completed: data.completed,
            pomodorosSpent: data.pomodoros_spent,
            scheduledDate: data.scheduled_date,
            completedAt: data.completed_at,
            sortOrder: data.sort_order ?? 0,
            description: data.description ?? "",
            sectionId: data.section_id ?? null,
          },
        ]);
        setTaskCountsByDate((prev) => {
          const existing = prev[selectedDate] || { total: 0, completed: 0 };
          return { ...prev, [selectedDate]: { ...existing, total: existing.total + 1 } };
        });
      }
    },
    [user, selectedDate, tasks, supabase]
  );

  const toggleTask = useCallback(
    async (id: number) => {
      const task = tasks.find((t) => t.id === id);
      if (!task || !user) return;
      const nowCompleted = !task.completed;
      const completedAt = nowCompleted ? new Date().toISOString() : null;

      await supabase
        .from("tasks")
        .update({ completed: nowCompleted, completed_at: completedAt })
        .eq("id", id)
        .eq("user_id", user.id);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, completed: nowCompleted, completedAt } : t
        )
      );
      setTaskCountsByDate((prev) => {
        const existing = prev[selectedDate] || { total: 0, completed: 0 };
        return {
          ...prev,
          [selectedDate]: {
            ...existing,
            completed: existing.completed + (nowCompleted ? 1 : -1),
          },
        };
      });
    },
    [tasks, user, selectedDate, supabase]
  );

  const deleteTask = useCallback(
    async (id: number) => {
      if (!user) return;
      const task = tasks.find((t) => t.id === id);
      await supabase.from("tasks").delete().eq("id", id).eq("user_id", user.id);

      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (task) {
        setTaskCountsByDate((prev) => {
          const existing = prev[selectedDate] || { total: 0, completed: 0 };
          return {
            ...prev,
            [selectedDate]: {
              total: Math.max(0, existing.total - 1),
              completed: task.completed
                ? Math.max(0, existing.completed - 1)
                : existing.completed,
            },
          };
        });
      }
    },
    [user, tasks, selectedDate, supabase]
  );

  const reorderTasks = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!user || !hasSortOrder.current) return;
      const reordered = [...tasks];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      const updated = reordered.map((t, i) => ({ ...t, sortOrder: i }));
      setTasks(updated);

      await Promise.all(
        updated.map((t) =>
          supabase
            .from("tasks")
            .update({ sort_order: t.sortOrder })
            .eq("id", t.id)
            .eq("user_id", user.id)
        )
      );
    },
    [user, tasks, supabase]
  );

  const renameTask = useCallback(
    async (id: number, text: string) => {
      if (!user) return;
      await supabase
        .from("tasks")
        .update({ text })
        .eq("id", id)
        .eq("user_id", user.id);

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, text } : t))
      );
    },
    [user, supabase]
  );

  const updateTaskDescription = useCallback(
    async (id: number, description: string) => {
      if (!user) return;
      await supabase
        .from("tasks")
        .update({ description })
        .eq("id", id)
        .eq("user_id", user.id);

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, description } : t))
      );
    },
    [user, supabase]
  );

  // --- Section CRUD ---

  const addSection = useCallback(
    async (name: string) => {
      if (!user) return;
      const nextOrder = sections.length > 0
        ? Math.max(...sections.map((s) => s.sortOrder)) + 1
        : 0;

      const { data, error: insertError } = await supabase
        .from("sections")
        .insert({ user_id: user.id, name, sort_order: nextOrder })
        .select()
        .single();

      if (insertError) {
        setError("Failed to add section: " + insertError.message);
        return;
      }
      if (data) {
        setSections((prev) => [
          ...prev,
          { id: data.id, name: data.name, color: data.color, sortOrder: data.sort_order },
        ]);
      }
    },
    [user, sections, supabase]
  );

  const renameSection = useCallback(
    async (id: number, name: string) => {
      if (!user) return;
      await supabase.from("sections").update({ name }).eq("id", id).eq("user_id", user.id);
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    },
    [user, supabase]
  );

  const updateSectionColor = useCallback(
    async (id: number, color: string) => {
      if (!user) return;
      await supabase.from("sections").update({ color }).eq("id", id).eq("user_id", user.id);
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
    },
    [user, supabase]
  );

  const deleteSection = useCallback(
    async (id: number) => {
      if (!user) return;
      await supabase.from("sections").delete().eq("id", id).eq("user_id", user.id);
      setSections((prev) => prev.filter((s) => s.id !== id));
      // Tasks with this section_id get set to null via ON DELETE SET NULL
      setTasks((prev) => prev.map((t) => (t.sectionId === id ? { ...t, sectionId: null } : t)));
    },
    [user, supabase]
  );

  const reorderSections = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!user) return;
      const reordered = [...sections];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      const updated = reordered.map((s, i) => ({ ...s, sortOrder: i }));
      setSections(updated);

      await Promise.all(
        updated.map((s) =>
          supabase
            .from("sections")
            .update({ sort_order: s.sortOrder })
            .eq("id", s.id)
            .eq("user_id", user.id)
        )
      );
    },
    [user, sections, supabase]
  );

  const updateTaskSection = useCallback(
    async (taskId: number, sectionId: number | null) => {
      if (!user) return;
      await supabase
        .from("tasks")
        .update({ section_id: sectionId })
        .eq("id", taskId)
        .eq("user_id", user.id);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, sectionId } : t)));
    },
    [user, supabase]
  );

  const handleCarryForward = useCallback(
    async (ids: number[]) => {
      if (!user || ids.length === 0) return;
      const today = todayStr();
      const yesterday = yesterdayStr();

      await supabase
        .from("tasks")
        .update({ scheduled_date: today })
        .in("id", ids)
        .eq("user_id", user.id);

      setTaskCountsByDate((prev) => {
        const updated = { ...prev };
        const old = updated[yesterday] || { total: 0, completed: 0 };
        updated[yesterday] = { ...old, total: Math.max(0, old.total - ids.length) };
        const target = updated[today] || { total: 0, completed: 0 };
        updated[today] = { ...target, total: target.total + ids.length };
        return updated;
      });

      sessionStorage.setItem("pomo-planned-today", today);
      setShowPlanModal(false);
      setCarryoverTasks([]);
      if (selectedDate === today) {
        fetchTasks();
      }
    },
    [user, selectedDate, supabase, fetchTasks]
  );

  const handleDismissPlan = useCallback(() => {
    sessionStorage.setItem("pomo-planned-today", todayStr());
    setShowPlanModal(false);
    setCarryoverTasks([]);
  }, []);

  const handleMoveToToday = useCallback(async () => {
    if (!user || !reschedulePrompt) return;
    const ids = reschedulePrompt.incompleteTasks.map((t) => t.id);
    const today = todayStr();
    const fromDate = reschedulePrompt.date;

    await supabase
      .from("tasks")
      .update({ scheduled_date: today })
      .in("id", ids)
      .eq("user_id", user.id);

    setTaskCountsByDate((prev) => {
      const updated = { ...prev };
      const old = updated[fromDate] || { total: 0, completed: 0 };
      updated[fromDate] = { ...old, total: Math.max(0, old.total - ids.length) };
      const target = updated[today] || { total: 0, completed: 0 };
      updated[today] = { ...target, total: target.total + ids.length };
      return updated;
    });

    setReschedulePrompt(null);
    if (selectedDate === today) {
      fetchTasks();
    }
  }, [user, reschedulePrompt, selectedDate, supabase, fetchTasks]);

  const handleDismissReschedule = useCallback(() => {
    setReschedulePrompt(null);
  }, []);

  const rescheduleTask = useCallback(
    async (taskId: number, newDate: string) => {
      if (!user) return;
      await supabase
        .from("tasks")
        .update({ scheduled_date: newDate })
        .eq("id", taskId)
        .eq("user_id", user.id);

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setTaskCountsByDate((prev) => {
        const updated = { ...prev };
        const old = updated[selectedDate] || { total: 0, completed: 0 };
        updated[selectedDate] = { ...old, total: Math.max(0, old.total - 1) };
        const target = updated[newDate] || { total: 0, completed: 0 };
        updated[newDate] = { ...target, total: target.total + 1 };
        return updated;
      });
    },
    [user, selectedDate, supabase]
  );

  const onFocusComplete = useCallback(async () => {
    if (!user) return;

    const newStats = {
      totalFocusMinutes: stats.totalFocusMinutes + 25,
      sessionsCompleted: stats.sessionsCompleted + 1,
    };
    setStats(newStats);

    await supabase.from("daily_stats").upsert(
      {
        user_id: user.id,
        date: selectedDate,
        total_focus_minutes: newStats.totalFocusMinutes,
        sessions_completed: newStats.sessionsCompleted,
      },
      { onConflict: "user_id,date" }
    );

    const firstIncomplete = tasks.find((t) => !t.completed);
    if (firstIncomplete) {
      const newCount = firstIncomplete.pomodorosSpent + 1;
      await supabase
        .from("tasks")
        .update({ pomodoros_spent: newCount })
        .eq("id", firstIncomplete.id)
        .eq("user_id", user.id);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === firstIncomplete.id
            ? { ...t, pomodorosSpent: newCount }
            : t
        )
      );
    }
  }, [user, stats, selectedDate, tasks, supabase]);

  const handleSaveName = useCallback(
    async (firstName: string, lastName: string) => {
      const fullName = (firstName + " " + lastName).trim();
      await supabase.auth.updateUser({
        data: { full_name: fullName, display_name: firstName },
      });
      setShowNamePrompt(false);
      window.location.reload();
    },
    [supabase]
  );

  const displayName = (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Pomodoro"
  ).split(" ")[0];

  const handleNameClick = useCallback(() => {
    setEditName(user?.user_metadata?.full_name || "");
    setEditingName(true);
  }, [user]);

  const handleNameSave = useCallback(async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    await supabase.auth.updateUser({
      data: {
        full_name: trimmed,
        display_name: trimmed.split(" ")[0],
      },
    });
    setEditingName(false);
    window.location.reload();
  }, [editName, supabase]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div>
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          {editingName ? (
            <form
              className={styles.logoEditForm}
              onSubmit={(e) => { e.preventDefault(); handleNameSave(); }}
            >
              <input
                className={styles.logoEditInput}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameSave}
                autoFocus
                placeholder="Your name"
              />
            </form>
          ) : (
            <h1
              className={styles.logo}
              onClick={handleNameClick}
              title="Click to edit your name"
            >
              {displayName}&apos;s Dashboard
            </h1>
          )}
          <ThemeToggle />
        </div>
        <UserMenu />
      </header>
      {error && (
        <div className={styles.errorBar}>
          {error}
          <button onClick={() => setError("")} className={styles.errorClose}>×</button>
        </div>
      )}
      <div className={styles.content}>
        <main className={styles.pomodoroPane}>
          <Pomodoro
            tasks={tasks}
            stats={stats}
            selectedDate={selectedDate}
            sections={sections}
            onAddTask={addTask}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            onReorderTasks={reorderTasks}
            onRenameTask={renameTask}
            onUpdateDescription={updateTaskDescription}
            onFocusComplete={onFocusComplete}
            onAddSection={addSection}
            onRenameSection={renameSection}
            onUpdateSectionColor={updateSectionColor}
            onDeleteSection={deleteSection}
            onUpdateTaskSection={updateTaskSection}
            onReorderSections={reorderSections}
          />
        </main>
        <aside className={styles.calendarPane}>
          <Calendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            taskCountsByDate={taskCountsByDate}
            onMonthChange={fetchTaskCounts}
            onDropTask={rescheduleTask}
          />
        </aside>
      </div>
      {showPlanModal && carryoverTasks.length > 0 && (
        <PlanMyDay
          tasks={carryoverTasks}
          onCarryForward={handleCarryForward}
          onDismiss={handleDismissPlan}
        />
      )}
      {reschedulePrompt && (
        <ReschedulePrompt
          date={reschedulePrompt.date}
          taskCount={reschedulePrompt.incompleteTasks.length}
          onMoveToToday={handleMoveToToday}
          onDismiss={handleDismissReschedule}
        />
      )}
      {showNamePrompt && <NamePrompt onSave={handleSaveName} />}
    </div>
  );
}
