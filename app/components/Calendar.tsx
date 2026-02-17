"use client";

import { useState, useCallback, useEffect } from "react";
import styles from "./Calendar.module.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DayInfo {
  date: number;
  currentMonth: boolean;
  isToday: boolean;
  fullDate: string; // YYYY-MM-DD
}

function getDaysInMonth(year: number, month: number): DayInfo[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const prevMonthLast = new Date(year, month, 0).getDate();

  const days: DayInfo[] = [];
  const today = new Date();

  // Previous month padding
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  for (let i = 0; i < startPad; i++) {
    const d = prevMonthLast - startPad + i + 1;
    days.push({
      date: d,
      currentMonth: false,
      isToday: false,
      fullDate: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: d,
      currentMonth: true,
      isToday:
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === d,
      fullDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  // Next month padding
  const remaining = 42 - days.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  for (let d = 1; d <= remaining; d++) {
    days.push({
      date: d,
      currentMonth: false,
      isToday: false,
      fullDate: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  return days;
}

interface CalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  taskCountsByDate: Record<string, { total: number; completed: number }>;
  onMonthChange: (year: number, month: number) => void;
  onDropTask: (taskId: number, targetDate: string) => void;
}

export default function Calendar({
  selectedDate,
  onSelectDate,
  taskCountsByDate,
  onMonthChange,
  onDropTask,
}: CalendarProps) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const [view, setView] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));

  const today = new Date();
  const isCurrentMonth =
    view.year === today.getFullYear() && view.month === today.getMonth();

  const days = getDaysInMonth(view.year, view.month);
  const monthLabel = `${MONTHS[view.month]} ${view.year}`;

  // Notify parent when month changes so it can fetch task counts
  useEffect(() => {
    onMonthChange(view.year, view.month);
  }, [view.year, view.month, onMonthChange]);

  const goPrev = useCallback(() => {
    setView((v) =>
      v.month === 0
        ? { year: v.year - 1, month: 11 }
        : { ...v, month: v.month - 1 }
    );
  }, []);

  const goNext = useCallback(() => {
    setView((v) =>
      v.month === 11
        ? { year: v.year + 1, month: 0 }
        : { ...v, month: v.month + 1 }
    );
  }, []);

  const goToday = useCallback(() => {
    setView({ year: new Date().getFullYear(), month: new Date().getMonth() });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    },
    [goPrev, goNext]
  );

  return (
    <div
      className={styles.card}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="Calendar"
    >
      <header className={styles.header}>
        <button
          type="button"
          onClick={goPrev}
          className={styles.navBtn}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className={styles.title}>{monthLabel}</h2>
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={goToday}
            className={styles.todayBtn}
          >
            Today
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          className={styles.navBtn}
          aria-label="Next month"
        >
          ›
        </button>
      </header>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((d) => (
          <div key={d} className={styles.weekday}>
            {d}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {days.map((day) => {
          const isSelected = day.fullDate === selectedDate;
          const counts = taskCountsByDate[day.fullDate];
          const hasTasks = counts && counts.total > 0;
          const allDone = hasTasks && counts.completed === counts.total;

          return (
            <button
              key={day.fullDate}
              type="button"
              className={[
                styles.day,
                day.currentMonth ? styles.dayCurrent : styles.dayOther,
                day.isToday ? styles.dayToday : "",
                isSelected ? styles.daySelected : "",
                dragOverDate === day.fullDate ? styles.dayDragOver : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDate(day.fullDate)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverDate(day.fullDate);
              }}
              onDragLeave={() => setDragOverDate(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDate(null);
                const taskId = e.dataTransfer.getData("application/pomo-task");
                if (taskId) {
                  onDropTask(Number(taskId), day.fullDate);
                }
              }}
            >
              {day.date}
              {hasTasks && (
                <span
                  className={
                    allDone ? styles.taskDotDone : styles.taskDot
                  }
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
