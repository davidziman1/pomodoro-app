import styles from "./StreakBadge.module.css";

interface StreakBadgeProps {
  streak: number;
}

function getMilestone(streak: number): string | null {
  if (streak >= 30) return "Unstoppable!";
  if (streak >= 14) return "Legendary!";
  if (streak >= 7) return "On fire!";
  if (streak >= 3) return "Nice!";
  return null;
}

function getTier(streak: number): string {
  if (streak >= 30) return styles.tier3;
  if (streak >= 7) return styles.tier2;
  if (streak >= 3) return styles.tier1;
  return "";
}

export default function StreakBadge({ streak }: StreakBadgeProps) {
  const milestone = getMilestone(streak);
  const tier = getTier(streak);

  return (
    <div className={`${styles.badge} ${tier}`}>
      <span className={styles.fireIcon}>🔥</span>
      <span className={styles.streakNum}>{streak}</span>
      <span className={styles.streakLabel}>day streak</span>
      {milestone && <span className={styles.milestone}>{milestone}</span>}
    </div>
  );
}
