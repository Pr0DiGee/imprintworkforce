import os

target_files = [
    r"c:\Users\USER\Documents\dev\impwrk\church-app\app\dashboard\notes\NotesClient.tsx",
    r"c:\Users\USER\Documents\dev\impwrk\church-app\components\AssignTaskModal.tsx"
]

for filepath in target_files:
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        new_content = content.replace("error(", "toast.error(")
        # Just in case this replaces console.error or toast.error
        new_content = new_content.replace("console.toast.error(", "console.error(")
        new_content = new_content.replace("toast.toast.error(", "toast.error(")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
