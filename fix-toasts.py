import os

target_dirs = [
    r"c:\Users\USER\Documents\dev\impwrk\church-app\app",
    r"c:\Users\USER\Documents\dev\impwrk\church-app\components"
]

for d in target_dirs:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith(".tsx") or file.endswith(".ts"):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

                new_content = content.replace("toast.toast.success(", "toast.success(")
                new_content = new_content.replace("toast.toast.error(", "toast.error(")
                
                # Some files had `catch (error)` and then `error("Failed...")`
                # which was replaced with `toast.error("Failed...")`. 
                # Let's fix anywhere someone calls `error("` that might still be left
                new_content = new_content.replace(' error("', ' toast.error("')
                
                if new_content != content:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_content)
