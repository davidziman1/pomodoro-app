"use client";

import styles from "./ReschedulePrompt.module.css";

interface ReschedulePromptProps {
  date: string;
  taskCount: number;
  onMoveToToday: () => void;
  onDismiss: () => void;
}

export default function ReschedulePrompt({
  date,
  taskCount,
  onMoveToToday,
  onDismiss,
}: ReschedulePromptProps) {
  const formatted = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className={styles.banner}>
      <span className={styles.message}>
        You have {taskCount} incomplete task{taskCount !== 1 ? "s" : ""} from {formatted}.
      </span>
      <button className={styles.moveBtn} onClick={onMoveToToday}>
        Move to Today
      </button>
      <button className={styles.dismissBtn} onClick={onDismiss}>
        Leave Them
      </button>
    </div>
  );
}
