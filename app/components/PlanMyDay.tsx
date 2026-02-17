"use client";

import { useState } from "react";
import type { Task } from "./Dashboard";
import styles from "./PlanMyDay.module.css";

interface PlanMyDayProps {
  tasks: Task[];
  onCarryForward: (ids: number[]) => void;
  onDismiss: () => void;
}

export default function PlanMyDay({ tasks, onCarryForward, onDismiss }: PlanMyDayProps) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(tasks.map((t) => t.id)));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2 className={styles.title}>Plan My Day</h2>
        <p className={styles.subtitle}>
          You have {tasks.length} incomplete task{tasks.length !== 1 ? "s" : ""} from yesterday.
          Select which to carry forward.
        </p>
        <ul className={styles.taskList}>
          {tasks.map((task) => (
            <li key={task.id} className={styles.taskRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selected.has(task.id)}
                onChange={() => toggle(task.id)}
              />
              <span className={styles.taskText}>{task.text}</span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <button
            className={styles.carryBtn}
            onClick={() => onCarryForward(Array.from(selected))}
            disabled={selected.size === 0}
          >
            Carry Forward ({selected.size})
          </button>
          <button className={styles.freshBtn} onClick={onDismiss}>
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
}
