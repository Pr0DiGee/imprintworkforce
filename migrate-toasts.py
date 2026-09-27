import os
import re

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

                if "useToast" in content:
                    # Replace import
                    content = re.sub(
                        r'import\s+{\s*useToast\s*}\s+from\s+"@/context/ToastContext";',
                        'import { toast } from "sonner";',
                        content
                    )
                    
                    # Remove destructuring like `const { success, error } = useToast();`
                    content = re.sub(
                        r'const\s+{\s*success\s*,\s*error\s*}\s*=\s*useToast\(\);?\s*',
                        '',
                        content
                    )
                    
                    # Remove `const toast = useToast();` because we already import `toast` directly from "sonner"
                    content = re.sub(
                        r'const\s+toast\s*=\s*useToast\(\);?\s*',
                        '',
                        content
                    )
                    
                    # Also replace `success("msg")` with `toast.success("msg")`
                    # Since we removed `success`, we must replace its calls
                    content = re.sub(r'(?<!\w)success\(', 'toast.success(', content)
                    # Also replace `error("msg")` with `toast.error("msg")` (careful not to break console.error)
                    content = re.sub(r'(?<!\.)(?<!\w)error\(', 'toast.error(', content)
                    
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(content)
