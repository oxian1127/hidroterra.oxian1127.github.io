import os
import re

errors = []
dirs_to_check = ['src', 'tests']

for base in dirs_to_check:
    for dirpath, _, filenames in os.walk(base):
        for f in filenames:
            if f.endswith('.js'):
                filepath = os.path.join(dirpath, f)
                with open(filepath, 'r', encoding='utf-8') as fp:
                    content = fp.read()
                imports = re.findall(r'from\s+[\'"]([^\'"]+)[\'"]', content)
                for imp in imports:
                    if imp.startswith('.'):
                        target = os.path.normpath(os.path.join(dirpath, imp))
                        if not os.path.exists(target):
                            errors.append(f"{filepath} -> import '{imp}' could not be found at {target}")

if errors:
    print(f"FAILED: Found {len(errors)} broken import paths:")
    for e in errors:
        print("  -", e)
    exit(1)
else:
    print("SUCCESS: 100% of ES Module imports in src/ and tests/ resolve correctly to physical files!")
