"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import styles from "./Calendar.module.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEAR_MIN = new Date().getFullYear() - 5;
const YEAR_MAX = new Date().getFullYear() + 5;

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

function daysInMonthCount(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  const [dragOverArrow, setDragOverArrow] = useState<"prev" | "next" | null>(null);
  const flipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [view, setView] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));

  // Parse selectedDate for the day dropdown
  const selParts = selectedDate.split("-").map(Number);
  const selYear = selParts[0];
  const selMonth = selParts[1] - 1;
  const selDay = selParts[2];

  const today = new Date();
  const isCurrentMonth =
    view.year === today.getFullYear() && view.month === today.getMonth();

  const days = getDaysInMonth(view.year, view.month);
  const maxDay = daysInMonthCount(view.year, view.month);

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
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
    onSelectDate(formatDateStr(now.getFullYear(), now.getMonth(), now.getDate()));
  }, [onSelectDate]);

  // Dropdown handlers
  const handleYearChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newYear = Number(e.target.value);
      setView((v) => ({ ...v, year: newYear }));
      const maxD = daysInMonthCount(newYear, selMonth);
      const clampedDay = Math.min(selDay, maxD);
      onSelectDate(formatDateStr(newYear, selMonth, clampedDay));
    },
    [selMonth, selDay, onSelectDate]
  );

  const handleMonthChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMonth = Number(e.target.value);
      setView((v) => ({ ...v, month: newMonth }));
      const maxD = daysInMonthCount(selYear, newMonth);
      const clampedDay = Math.min(selDay, maxD);
      onSelectDate(formatDateStr(selYear, newMonth, clampedDay));
    },
    [selYear, selDay, onSelectDate]
  );

  const handleDayChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newDay = Number(e.target.value);
      onSelectDate(formatDateStr(view.year, view.month, newDay));
    },
    [view.year, view.month, onSelectDate]
  );

  // Drag-to-arrow: flip months while dragging
  const clearFlipInterval = useCallback(() => {
    if (flipIntervalRef.current) {
      clearInterval(flipIntervalRef.current);
      flipIntervalRef.current = null;
    }
  }, []);

  const handleArrowDragOver = useCallback(
    (e: React.DragEvent, direction: "prev" | "next") => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverArrow !== direction) {
        setDragOverArrow(direction);
        clearFlipInterval();
        // Flip once immediately
        if (direction === "prev") goPrev();
        else goNext();
        // Then flip every 800ms while hovering
        flipIntervalRef.current = setInterval(() => {
          if (direction === "prev") goPrev();
          else goNext();
        }, 800);
      }
    },
    [dragOverArrow, clearFlipInterval, goPrev, goNext]
  );

  const handleArrowDragLeave = useCallback(() => {
    setDragOverArrow(null);
    clearFlipInterval();
  }, [clearFlipInterval]);

  const handleArrowDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverArrow(null);
      clearFlipInterval();
    },
    [clearFlipInterval]
  );

  // Clean up interval on unmount
  useEffect(() => {
    return () => clearFlipInterval();
  }, [clearFlipInterval]);

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

  // Build day options for the dropdown based on the viewed month
  const dayOptions = [];
  for (let d = 1; d <= maxDay; d++) {
    dayOptions.push(d);
  }

  // The day dropdown should show the selected day if it's in the viewed month,
  // otherwise show 1
  const dropdownDay =
    selYear === view.year && selMonth === view.month
      ? Math.min(selDay, maxDay)
      : 1;

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
          className={`${styles.navBtn} ${dragOverArrow === "prev" ? styles.navBtnDragOver : ""}`}
          aria-label="Previous month"
          onDragOver={(e) => handleArrowDragOver(e, "prev")}
          onDragLeave={handleArrowDragLeave}
          onDrop={handleArrowDrop}
        >
          ‹
        </button>

        <div className={styles.selectors}>
          <select
            className={styles.selector}
            value={view.year}
            onChange={handleYearChange}
            aria-label="Year"
          >
            {Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i).map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            )}
          </select>
          <select
            className={styles.selector}
            value={view.month}
            onChange={handleMonthChange}
            aria-label="Month"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          {selectedDate !== formatDateStr(today.getFullYear(), today.getMonth(), today.getDate()) && (
            <button
              type="button"
              onClick={goToday}
              className={styles.todayBtn}
            >
              Today
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={goNext}
          className={`${styles.navBtn} ${dragOverArrow === "next" ? styles.navBtnDragOver : ""}`}
          aria-label="Next month"
          onDragOver={(e) => handleArrowDragOver(e, "next")}
          onDragLeave={handleArrowDragLeave}
          onDrop={handleArrowDrop}
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
