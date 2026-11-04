"""Extract numbered reading translations from the supplied answer DOCX files."""
import json
import re
import subprocess
from pathlib import Path

from docx import Document
import pdfplumber

ROOT = Path(__file__).parent
SOURCE = Path(r'path/to/source')
PDF_SOURCE = Path(r'path/to/source')
YEARS = [*range(2009, 2017), 2024, 2025, 2026]
PASSAGE = {'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4}

js = """const fs=require('fs'),vm=require('vm'),c={window:{}};
for(const f of ['articles2026.js','articles2025.js','articlesArchive.js','articlesArchive2.js','papers2021_2024.js'])
  vm.runInNewContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const w=c.window,a=[w.TEM8_2026_ARTICLES,w.TEM8_2025_ARTICLES,w.TEM8_ARCHIVE_ARTICLES,w.TEM8_ARCHIVE_ARTICLES2,w.TEM8_MID_ARTICLES].flat();
process.stdout.write(JSON.stringify(Object.fromEntries(a.map(x=>[x.id,x.segments.length]))));"""
article_sizes = json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT, text=True, encoding='utf-8'))
translations = {}

for year in YEARS:
    source = next((p for p in SOURCE.glob('*.docx') if str(year) in p.name and '解析' in p.name), None)
    if not source:
        continue
    paragraphs = [p.text.strip() for p in Document(source).paragraphs]
    for index, heading in enumerate(paragraphs):
        match = re.match(r'^PASSAGE\s+(ONE|TWO|THREE|FOUR)\b', heading)
        if not match or not ('全文翻译' in heading or year == 2026 and heading == f'PASSAGE {match.group(1)}'):
            continue
        article_id = f'{year}-{PASSAGE[match.group(1)]}'
        size = article_sizes.get(article_id, 0)
        if not size:
            continue
        values = [''] * size
        for line in paragraphs[index + 1:]:
            if line.startswith('答案与详解') or line.startswith('PASSAGE ') or line.startswith('PART III'):
                break
            numbered = re.match(r'^[（(\[]\s*(\d+)\s*[）)\]]\s*', line)
            if not numbered:
                continue
            number = int(numbered.group(1))
            if not 1 <= number <= size or values[number - 1]:
                continue
            text = line[numbered.end():].strip()
            text = re.sub(r'\[(?:\d{1,2}[A-D]?)(?:/\d{1,2}[A-D]?)*\]', '', text).strip()
            if re.search(r'[\u3400-\u9fff]', text):
                values[number - 1] = text
        if any(values):
            translations[article_id] = values

for year in [2017, 2018, 2019, 2021, 2023]:
    source = next((p for p in PDF_SOURCE.glob(f'*{year}*解析*.pdf') if p.name.startswith(str(year))), None)
    if not source:
        continue
    # pdfplumber preserves the reading order of lines in the supplied PDFs.
    # pypdf interleaves parts of adjacent paragraphs in the 2023 answer PDF.
    with pdfplumber.open(source) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
    headings = list(re.finditer('全文翻译画线点评', text))
    for passage, heading in enumerate(headings, 1):
        article_id = f'{year}-{passage}'
        size = article_sizes.get(article_id, 0)
        if not size:
            continue
        end = headings[passage].start() if passage < len(headings) else len(text)
        section = text[heading.end():end]
        markers = list(re.finditer(r'(?m)^\s*[（(]\s*(\d{1,2})\s*[）)]', section))
        values = [''] * size
        for i, marker in enumerate(markers):
            number = int(marker.group(1))
            if not 1 <= number <= size or values[number - 1]:
                continue
            stop = markers[i + 1].start() if i + 1 < len(markers) else len(section)
            raw = section[marker.end():stop]
            raw = re.split(r'(?m)^\s*\d{1,2}\s*\.\s*\[[A-D]\]', raw, maxsplit=1)[0]
            raw = re.split(r'(?m)^\s*(?:答案|重点词汇|难句分析)', raw, maxsplit=1)[0]
            raw = re.sub(r'(?m)^\s*华研外语[^\n]*\n', '', raw)
            raw = re.sub(r'\[\d{1,2}[A-D]?\]', '', raw)
            raw = re.sub(r'专八2021\s*-\s*\d+\s*微信公众号：本初学社', '', raw)
            raw = re.sub(r'[「\[]\s*\d+(?:/\d+)?[〗\]]', '', raw)
            raw = re.sub(r'(?<=[\u3400-\u9fff])\n(?=[\u3400-\u9fff])', '', raw)
            raw = ' '.join(raw.split())
            if len(raw) >= 20 and re.search(r'[\u3400-\u9fff]', raw):
                values[number - 1] = raw
        if any(values):
            translations[article_id] = values

out = 'window.TEM8_ZH = {...(window.TEM8_ZH || {}), ...' + json.dumps(translations, ensure_ascii=False, separators=(',', ':')) + '};\n'
(ROOT / 'readingTranslations.js').write_text(out, encoding='utf-8')
for year in [*YEARS, 2017, 2018, 2019, 2021, 2023]:
    articles = [key for key in translations if key.startswith(f'{year}-')]
    print(year, ', '.join(f'{key}: {sum(bool(x) for x in translations[key])}/{len(translations[key])}' for key in articles))
