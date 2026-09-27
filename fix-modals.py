import glob
import re

for f in glob.glob('**/*.tsx', recursive=True):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to find <div className="fixed inset-0... or similar that acts as overlay/modal
    # and add role="dialog" aria-modal="true" to it.
    
    # Let's just do a naive replace for `className="fixed inset-0`
    if 'className="fixed inset-0' in content and 'role="dialog"' not in content:
        content = content.replace('className="fixed inset-0', 'role="dialog" aria-modal="true" className="fixed inset-0')
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
            print(f"Updated {f}")
