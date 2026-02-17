"use client";

import { useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import styles from "./TaskNotes.module.css";

interface TaskNotesProps {
  description: string;
  onSave: (html: string) => void;
}

export default function TaskNotes({ description, onSave }: TaskNotesProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: description,
    onBlur({ editor }) {
      onSave(editor.getHTML());
    },
  });

  const handleSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!editor) return;
      const val = e.target.value;
      if (val === "p") {
        editor.chain().focus().setParagraph().run();
      } else {
        editor
          .chain()
          .focus()
          .toggleHeading({ level: Number(val) as 1 | 2 | 3 })
          .run();
      }
    },
    [editor]
  );

  if (!editor) return null;

  const currentLevel = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : "p";

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={editor.isActive("bold") ? styles.toolBtnActive : styles.toolBtn}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={editor.isActive("italic") ? styles.toolBtnActive : styles.toolBtn}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={editor.isActive("underline") ? styles.toolBtnActive : styles.toolBtn}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          className={editor.isActive("bulletList") ? styles.toolBtnActive : styles.toolBtn}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          •&thinsp;List
        </button>
        <button
          type="button"
          className={editor.isActive("orderedList") ? styles.toolBtnActive : styles.toolBtn}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          1.&thinsp;List
        </button>
        <select
          className={styles.sizeSelect}
          value={currentLevel}
          onChange={handleSizeChange}
          title="Font Size"
        >
          <option value="p">Normal</option>
          <option value="3">Large</option>
          <option value="2">Larger</option>
          <option value="1">Largest</option>
        </select>
      </div>
      <div className={styles.editor}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
