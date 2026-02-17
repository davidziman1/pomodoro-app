"use client";

import { useState } from "react";
import styles from "./NamePrompt.module.css";

interface NamePromptProps {
  onSave: (firstName: string, lastName: string) => void;
}

export default function NamePrompt({ onSave }: NamePromptProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    onSave(firstName.trim(), lastName.trim());
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2 className={styles.title}>What&apos;s your name?</h2>
        <p className={styles.subtitle}>
          We&apos;ll use this to personalize your dashboard.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.nameRow}>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={styles.input}
              required
              autoFocus
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={styles.input}
              required
            />
          </div>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
