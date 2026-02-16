"use client";

import { useState, useCallback } from "react";
import styles from "./Calendar.module.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const prevMonthLast = new Date(year, month, 0).getDate();

  const days: { date: number; currentMonth: boolean; isToday: boolean }[] = [];

  for (let i = 0; i < startPad; i++) {
    days.push({
      date: prevMonthLast - startPad + i + 1,
      currentMonth: false,
      isToday: false,
    });
  }

  const today = new Date();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: d,
      currentMonth: true,
      isToday:
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === d,
    });
  }

  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: d, currentMonth: false, isToday: false });
  }

  return days;
}

export default function Calendar() {
  const [view, setView] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));

  const today = new Date();
  const isCurrentMonth =
    view.year === today.getFullYear() && view.month === today.getMonth();

  const days = getDaysInMonth(view.year, view.month);
  const monthLabel = `${MONTHS[view.month]} ${view.year}`;

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
    <main className={styles.main}>
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
          <h1 className={styles.title}>{monthLabel}</h1>
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
          {days.map((day) => (
            <div
              key={`${day.currentMonth}-${day.date}`}
              className={[
                styles.day,
                day.currentMonth ? styles.dayCurrent : styles.dayOther,
                day.isToday ? styles.dayToday : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {day.date}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
