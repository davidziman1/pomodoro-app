"use client";

import { useEffect, useRef } from "react";
import styles from "./SectionColorPicker.module.css";

const PRESET_COLORS = [
  "#bb9af7", // purple
  "#7aa2f7", // blue
  "#9ece6a", // green
  "#f7768e", // red
  "#ff9e64", // orange
  "#e0af68", // yellow
  "#f5c2e7", // pink
  "#73daca", // teal
];

interface SectionColorPickerProps {
  currentColor: string;
  onSelectColor: (hex: string) => void;
  onClose: () => void;
}

export default function SectionColorPicker({
  currentColor,
  onSelectColor,
  onClose,
}: SectionColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div className={styles.popover} ref={ref}>
      <div className={styles.swatches}>
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            className={
              color === currentColor
                ? styles.swatchActive
                : styles.swatch
            }
            style={{ background: color }}
            onClick={() => {
              onSelectColor(color);
              onClose();
            }}
          />
        ))}
      </div>
    </div>
  );
}
