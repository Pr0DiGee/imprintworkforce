"use client";

import { useState, useCallback } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useToast } from "@/context/ToastContext";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ToolbarBtn } from "@/components/ToolbarBtn";
import type { UserProfile, NoteFolder, Note } from "@/types";
import {
  FolderPlus,
  ChevronLeft,
  Plus,
  Trash2,
  Pencil,
  FolderOpen,
  StickyNote,
  MoreHorizontal,
  Check,
  X,
} from "lucide-react";

// ─── Folder Colors ──────────────────────────────────────────────────────────────

const FOLDER_COLORS = [
  "#b91c1c", // red
  "#c2410c", // orange
  "#a16207", // amber
  "#15803d", // green
  "#0e7490", // cyan
  "#1d4ed8", // blue
  "#7c3aed", // violet
  "#a21caf", // fuchsia
  "#64748b", // slate
];

// ─── Types ──────────────────────────────────────────────────────────────────────

type View = "folders" | "notes" | "editor";

interface NotesClientProps {
  user: UserProfile;
  initialFolders: NoteFolder[];
  initialNoteCounts: Record<string, number>;
}

// ─── Note Editor ────────────────────────────────────────────────────────────────

function NoteEditor({
  note,
  onSave,
  onCancel,
  saving,
}: {
  note: Note | null;
  onSave: (title: string, content: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(note?.title || "");

  const getInitial = () => {
    if (!note?.content) return "";
    try {
      return JSON.parse(note.content);
    } catch {
      return note.content;
    }
  };

  const editor = useEditor({
    extensions: [StarterKit],
    content: getInitial(),
    editorProps: {
      attributes: {
        class:
          "tiptap-content min-h-[400px] px-5 py-4 focus:outline-none text-sm",
        "data-placeholder": "Start writing…",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Title input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title…"
        className="text-xl font-bold px-5 py-4 border-none focus:outline-none bg-transparent w-full"
        style={{ color: "var(--text-primary)" }}
        autoFocus
      />

      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-0.5 px-3 py-2"
        style={{
          background: "var(--bg-elevated)",
          borderTop: "1px solid var(--border-primary)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <ToolbarBtn
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
        >
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
        >
          <em>I</em>
        </ToolbarBtn>
        <span
          className="w-px h-5 mx-1"
          style={{ background: "var(--border-primary)" }}
        />
        <ToolbarBtn
          title="Heading 2"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
        >
          H2
        </ToolbarBtn>
        <ToolbarBtn
          title="Heading 3"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
        >
          H3
        </ToolbarBtn>
        <span
          className="w-px h-5 mx-1"
          style={{ background: "var(--border-primary)" }}
        />
        <ToolbarBtn
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
        >
          • List
        </ToolbarBtn>
        <ToolbarBtn
          title="Ordered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
        >
          1. List
        </ToolbarBtn>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Actions */}
      <div
        className="flex items-center justify-end gap-2 px-4 py-3"
        style={{
          background: "var(--bg-elevated)",
          borderTop: "1px solid var(--border-primary)",
        }}
      >
        <button type="button" onClick={onCancel} disabled={saving} className="btn">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(title, JSON.stringify(editor.getJSON()))}
          disabled={saving || !title.trim()}
          className="btn"
          style={{
            background: "var(--accent)",
            color: "var(--text-inverse)",
            opacity: !title.trim() ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save Note"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function NotesClient({
  user,
  initialFolders,
  initialNoteCounts,
}: NotesClientProps) {
  const { success, error } = useToast();

  // Navigation state
  const [view, setView] = useState<View>("folders");
  const [activeFolder, setActiveFolder] = useState<NoteFolder | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isNewNote, setIsNewNote] = useState(false);

  // Data state
  const [folders, setFolders] = useState<NoteFolder[]>(initialFolders);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>(initialNoteCounts);
  const [notes, setNotes] = useState<Note[]>([]);
  const [fetchingNotes, setFetchingNotes] = useState(false);

  // Folder creation/editing state
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  // Saving state
  const [saving, setSaving] = useState(false);

  // ── Folder CRUD ───────────────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setSaving(true);
    try {
      const ref = doc(collection(db, "note_folders"));
      const folder: Omit<NoteFolder, "id"> = {
        user_id: user.uid,
        name: newFolderName.trim(),
        color: newFolderColor,
        created_at: serverTimestamp() as any,
        updated_at: serverTimestamp() as any,
      };
      await setDoc(ref, folder);
      setFolders((prev) => [{ id: ref.id, ...folder } as NoteFolder, ...prev]);
      setNoteCounts((prev) => ({ ...prev, [ref.id]: 0 }));
      setNewFolderName("");
      setShowNewFolder(false);
      success("Folder created");
    } catch {
      error("Failed to create folder");
    } finally {
      setSaving(false);
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editFolderName.trim()) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "note_folders", folderId),
        { name: editFolderName.trim(), updated_at: serverTimestamp() },
        { merge: true }
      );
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId ? { ...f, name: editFolderName.trim() } : f
        )
      );
      setEditingFolderId(null);
      success("Folder renamed");
    } catch {
      error("Failed to rename folder");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async (folder: NoteFolder) => {
    const count = noteCounts[folder.id!] || 0;
    const msg =
      count > 0
        ? `Delete "${folder.name}" and its ${count} note${count > 1 ? "s" : ""}? This can't be undone.`
        : `Delete "${folder.name}"? This can't be undone.`;
    if (!confirm(msg)) return;

    setSaving(true);
    try {
      // Delete all notes in the folder first
      const notesSnap = await getDocs(
        query(
          collection(db, "notes"),
          where("user_id", "==", user.uid),
          where("folder_id", "==", folder.id)
        )
      );
      const batch = writeBatch(db);
      notesSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "note_folders", folder.id!));
      await batch.commit();

      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      const { [folder.id!]: _, ...rest } = noteCounts;
      setNoteCounts(rest);
      success("Folder deleted");
    } catch {
      error("Failed to delete folder");
    } finally {
      setSaving(false);
    }
  };

  // ── Notes CRUD ────────────────────────────────────────────────────────────────

  const openFolder = useCallback(
    async (folder: NoteFolder) => {
      setActiveFolder(folder);
      setView("notes");
      setFetchingNotes(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "notes"),
            where("user_id", "==", user.uid),
            where("folder_id", "==", folder.id),
            orderBy("updated_at", "desc")
          )
        );
        setNotes(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Note)
          )
        );
      } catch {
        error("Failed to load notes");
      } finally {
        setFetchingNotes(false);
      }
    },
    [user.uid, error]
  );

  const handleSaveNote = async (title: string, content: string) => {
    if (!activeFolder) return;
    setSaving(true);
    try {
      if (isNewNote) {
        const ref = doc(collection(db, "notes"));
        const note: Omit<Note, "id"> = {
          user_id: user.uid,
          folder_id: activeFolder.id!,
          title: title.trim(),
          content,
          created_at: serverTimestamp() as any,
          updated_at: serverTimestamp() as any,
        };
        await setDoc(ref, note);
        setNotes((prev) => [{ id: ref.id, ...note } as Note, ...prev]);
        setNoteCounts((prev) => ({
          ...prev,
          [activeFolder.id!]: (prev[activeFolder.id!] || 0) + 1,
        }));
      } else if (activeNote) {
        await setDoc(
          doc(db, "notes", activeNote.id!),
          { title: title.trim(), content, updated_at: serverTimestamp() },
          { merge: true }
        );
        setNotes((prev) =>
          prev.map((n) =>
            n.id === activeNote.id
              ? { ...n, title: title.trim(), content }
              : n
          )
        );
      }
      setView("notes");
      setActiveNote(null);
      setIsNewNote(false);
      success("Note saved");
    } catch {
      error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (!confirm(`Delete "${note.title}"? This can't be undone.`)) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "notes", note.id!));
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      setNoteCounts((prev) => ({
        ...prev,
        [note.folder_id]: Math.max(0, (prev[note.folder_id] || 1) - 1),
      }));
      success("Note deleted");
    } catch {
      error("Failed to delete note");
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const formatDate = (ts: any) => {
    if (!ts) return "";
    try {
      const date =
        typeof ts === "string"
          ? new Date(ts)
          : ts.toDate
            ? ts.toDate()
            : new Date(ts.seconds * 1000);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const getPreview = (content: string): string => {
    try {
      const parsed = JSON.parse(content);
      const extractText = (node: any): string => {
        if (node.text) return node.text;
        if (node.content)
          return node.content.map(extractText).join(" ");
        return "";
      };
      return extractText(parsed).slice(0, 120);
    } catch {
      return content?.slice(0, 120) || "";
    }
  };

  // ─── RENDER: Editor View ──────────────────────────────────────────────────────

  if (view === "editor") {
    return (
      <div className="max-w-4xl">
        <button
          onClick={() => {
            setView("notes");
            setActiveNote(null);
            setIsNewNote(false);
          }}
          className="flex items-center gap-1.5 text-sm font-medium mb-4 hover:opacity-80 transition-opacity"
          style={{ color: "var(--accent)" }}
        >
          <ChevronLeft size={16} />
          {activeFolder?.name}
        </button>

        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <NoteEditor
            note={isNewNote ? null : activeNote}
            onSave={handleSaveNote}
            onCancel={() => {
              setView("notes");
              setActiveNote(null);
              setIsNewNote(false);
            }}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  // ─── RENDER: Notes List View ──────────────────────────────────────────────────

  if (view === "notes" && activeFolder) {
    return (
      <div className="max-w-4xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setView("folders");
              setActiveFolder(null);
            }}
            className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: "var(--accent)" }}
          >
            <ChevronLeft size={16} />
            Folders
          </button>
          <button
            onClick={() => {
              setIsNewNote(true);
              setActiveNote(null);
              setView("editor");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
          >
            <Plus size={16} />
            New Note
          </button>
        </div>

        <div>
          <h2
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <FolderOpen
              size={22}
              style={{ color: activeFolder.color || "var(--accent)" }}
            />
            {activeFolder.name}
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Notes list */}
        {fetchingNotes ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <StickyNote
              size={40}
              className="mx-auto mb-3"
              style={{ color: "var(--text-muted)" }}
            />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              No notes yet
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Tap "New Note" to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-primary)",
                  boxShadow: "var(--shadow-sm)",
                }}
                onClick={() => {
                  setActiveNote(note);
                  setIsNewNote(false);
                  setView("editor");
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold text-sm truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {note.title || "Untitled"}
                    </h3>
                    <p
                      className="text-xs mt-1 line-clamp-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {getPreview(note.content) || "No content"}
                    </p>
                    <p
                      className="text-[11px] mt-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatDate(note.updated_at || note.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all hover:bg-red-50 dark:hover:bg-red-950"
                    style={{ color: "var(--danger)" }}
                    title="Delete note"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── RENDER: Folders View (default) ───────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            My Notes
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Organize your notes into folders
          </p>
        </div>
        <button
          onClick={() => setShowNewFolder(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
        >
          <FolderPlus size={16} />
          New Folder
        </button>
      </div>

      {/* New folder form */}
      {showNewFolder && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--accent)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name…"
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{
              background: "var(--bg-input)",
              borderColor: "var(--border-primary)",
              color: "var(--text-primary)",
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") setShowNewFolder(false);
            }}
          />
          {/* Color picker */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Color:
            </span>
            <div className="flex gap-1.5">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewFolderColor(color)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: color,
                    borderColor:
                      newFolderColor === color
                        ? "var(--text-primary)"
                        : "transparent",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName("");
              }}
              className="btn text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateFolder}
              disabled={saving || !newFolderName.trim()}
              className="btn text-sm"
              style={{
                background: "var(--accent)",
                color: "var(--text-inverse)",
                opacity: !newFolderName.trim() ? 0.5 : 1,
              }}
            >
              {saving ? "Creating…" : "Create Folder"}
            </button>
          </div>
        </div>
      )}

      {/* Folders grid */}
      {folders.length === 0 && !showNewFolder ? (
        <div
          className="text-center py-20 rounded-xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <FolderOpen
            size={48}
            className="mx-auto mb-4"
            style={{ color: "var(--text-muted)" }}
          />
          <p
            className="text-base font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            No folders yet
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Create a folder to start organizing your notes
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="group rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-primary)",
                boxShadow: "var(--shadow-sm)",
              }}
              onClick={() => {
                if (editingFolderId !== folder.id) openFolder(folder);
              }}
            >
              {editingFolderId === folder.id ? (
                /* Inline rename */
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-md border text-sm"
                    style={{
                      background: "var(--bg-input)",
                      borderColor: "var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameFolder(folder.id!);
                      if (e.key === "Escape") setEditingFolderId(null);
                    }}
                  />
                  <button
                    onClick={() => handleRenameFolder(folder.id!)}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: "var(--success)" }}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditingFolderId(null)}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                      style={{
                        background: `${folder.color || "var(--accent)"}18`,
                      }}
                    >
                      <FolderOpen
                        size={20}
                        style={{ color: folder.color || "var(--accent)" }}
                      />
                    </div>

                    {/* Actions menu */}
                    <div
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setEditingFolderId(folder.id!);
                          setEditFolderName(folder.name);
                        }}
                        className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        title="Rename"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder)}
                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        style={{ color: "var(--danger)" }}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h3
                    className="font-semibold text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {folder.name}
                  </h3>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {noteCounts[folder.id!] || 0} note
                    {(noteCounts[folder.id!] || 0) !== 1 ? "s" : ""}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
