"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import styles from "./UserMenu.module.css";

export default function UserMenu() {
  const { user } = useAuth();

  if (!user) return null;

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "User";

  const avatarUrl = user.user_metadata?.avatar_url;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className={styles.menu}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className={styles.avatar}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={styles.avatarFallback}>
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <span className={styles.name}>{displayName}</span>
      <button className={styles.signOutBtn} onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  );
}
