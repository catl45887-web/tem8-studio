"""Build small prefix files from the original per-letter dictionary files."""

import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).parent / "dictionary"
OUTPUT = ROOT / "prefix"
OUTPUT.mkdir(exist_ok=True)

groups = defaultdict(dict)
for path in sorted(ROOT.glob("?.js")):
    source = path.read_text(encoding="utf-8")
    entries = json.loads(source[source.index("{") : source.rindex("}") + 1])
    for word, entry in entries.items():
        groups[word[:2]][word] = entry

for prefix, entries in groups.items():
    payload = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    (OUTPUT / f"{prefix}.js").write_text(
        f"Object.assign(window.TEM8_DICTIONARY, {payload});\n", encoding="utf-8"
    )

manifest = json.dumps(sorted(groups), separators=(",", ":"))
(ROOT / "prefixes.js").write_text(
    f"window.TEM8_DICTIONARY_PREFIXES = new Set({manifest});\n", encoding="utf-8"
)
print(f"Created {len(groups)} prefix files for {sum(map(len, groups.values()))} words")
