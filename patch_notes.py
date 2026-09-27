import re

with open('app/dashboard/notes/NotesClient.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add URL Sync useEffect inside NotesClient
url_sync_code = """
  // ── URL State Sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folderId = params.get("folder");
    const noteId = params.get("note");
    
    if (folderId) {
      const folder = displayFolders.find(f => f.id === folderId);
      if (folder) {
        setActiveFolder(folder);
        setView(noteId ? "editor" : "notes");
        if (noteId) {
          // Note will be fetched and set later by another effect if needed, 
          // or we just rely on user clicking. To keep it simple, we just set the folder.
          // Fetching the note specifically requires knowing its content.
        }
      }
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (activeFolder) {
      url.searchParams.set("folder", activeFolder.id || "");
    } else {
      url.searchParams.delete("folder");
    }
    if (activeNote && view === "editor") {
      url.searchParams.set("note", activeNote.id || "");
    } else {
      url.searchParams.delete("note");
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeFolder, activeNote, view]);
"""

# Insert URL Sync
content = content.replace(
    '// ── Folder CRUD ───────────────────────────────────────────────────────────────',
    f'{url_sync_code}\n\n  // ── Folder CRUD ───────────────────────────────────────────────────────────────'
)
# Add useEffect to NotesClient imports
if 'useEffect' not in content:
    content = content.replace('import { useState, useCallback } from "react";', 'import { useState, useCallback, useEffect, useRef } from "react";')
else:
    content = content.replace('import { useState, useCallback } from "react";', 'import { useState, useCallback, useEffect, useRef } from "react";')

# Now add Auto-save to NoteEditor
auto_save_code = """
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!editor || !initialTitle) return; // Only auto-save existing notes (initialTitle exists)

    const handleUpdate = () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        onSave(title, JSON.stringify(editor.getJSON()));
      }, 1500); // Debounce 1.5s
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [editor, title, onSave, initialTitle]);
"""

content = content.replace(
    'const [title, setTitle] = useState(initialTitle || "");',
    f'const [title, setTitle] = useState(initialTitle || "");\n{auto_save_code}'
)

with open('app/dashboard/notes/NotesClient.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("NotesClient patched.")
