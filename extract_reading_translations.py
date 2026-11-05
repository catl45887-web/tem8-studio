"""Extract numbered reading translations from the supplied answer DOCX files."""
import json
import re
import subprocess
from pathlib import Path

from docx import Document
import pdfplumber

ROOT = Path(__file__).parent
# 资料放在本机，路径不写进仓库。运行前设置环境变量：
#   TEM8_SRC        解析 docx 所在文件夹
#   TEM8_SRC_2022   2022 年解析 docx 的完整路径（可选）
#   TEM8_SRC_PDF    PDF 解析所在文件夹（可选）
import os
SOURCE = Path(os.environ.get('TEM8_SRC', 'sources/output'))
EXTRA_DOCX = {2022: Path(os.environ['TEM8_SRC_2022'])} if os.environ.get('TEM8_SRC_2022') else {}
PDF_SOURCE = Path(os.environ.get('TEM8_SRC_PDF', 'sources/pdf'))
YEARS = [*range(2009, 2017), 2022, 2024, 2025, 2026]
PASSAGE = {'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4}

js = """const fs=require('fs'),vm=require('vm'),c={window:{}};
for(const f of ['articles2026.js','articles2025.js','articlesArchive.js','articlesArchive2.js','papers2021_2024.js'])
  vm.runInNewContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const w=c.window,a=[w.TEM8_2026_ARTICLES,w.TEM8_2025_ARTICLES,w.TEM8_ARCHIVE_ARTICLES,w.TEM8_ARCHIVE_ARTICLES2,w.TEM8_MID_ARTICLES].flat();
process.stdout.write(JSON.stringify(Object.fromEntries(a.map(x=>[x.id,x.segments.length]))));"""
article_sizes = json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT, text=True, encoding='utf-8'))
translations = {}

def strip_annotations(text):
    # Question-location marks appear inside the printed translations, and
    # several OCR files have a damaged closing bracket (for example [30]).
    return re.sub(r'[\[【「『丨]\s*\d{1,3}(?:\s*[A-D])?(?:\s*/\s*\d{1,3})?\s*[\]】〗）)]?', '', text)

for year in YEARS:
    source = EXTRA_DOCX.get(year) or next((p for p in SOURCE.glob('*.docx') if str(year) in p.name and '解析' in p.name), None)
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
        section = []
        for line in paragraphs[index + 1:]:
            if line.startswith('答案与详解') or line.startswith('PASSAGE ') or line.startswith('PART III'):
                break
            section.append(line)
        first_number = next((int(m.group(1)) for line in section if (m := re.match(r'^[（(\[]\s*(\d+)\s*[）)\]]', line))), None)
        # The 2009–2014 converted DOCX files number their first translated
        # paragraph (2), while the source PDFs and site articles start at (1).
        offset = 1 if year <= 2014 and first_number == 2 else 0
        for line in section:
            numbered = re.match(r'^[（(\[]\s*(\d+)\s*[）)\]]\s*', line)
            if not numbered:
                continue
            number = int(numbered.group(1)) - offset
            if not 1 <= number <= size or values[number - 1]:
                continue
            text = line[numbered.end():].strip()
            text = strip_annotations(text).strip()
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
    # The 2021 PDF OCR renders 画 as 圓 in the second passage heading.
    headings = list(re.finditer(r'全文翻译[^\n]{0,4}线点评', text))
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
            raw = strip_annotations(raw)
            raw = re.sub(r'专八2021\s*-\s*\d+\s*微信公众号：本初学社', '', raw)
            raw = re.sub(r'(?<=[\u3400-\u9fff])\n(?=[\u3400-\u9fff])', '', raw)
            raw = ' '.join(raw.split())
            if raw and re.search(r'[\u3400-\u9fff]', raw):
                values[number - 1] = raw
        if any(values):
            translations[article_id] = values

translations['2014-1'] = json.loads((ROOT / 'reading-2014-1.json').read_text(encoding='utf-8'))
assert len(translations['2014-1']) == article_sizes['2014-1']

# Correct clearly misrecognized words in the supplied 2022 DOCX against the
# scanned answer PDF, page 6, and omit its source credit from the last segment.
fixes_2022 = {
    '果米勒地': '果园地',
    '圣伯纳德德犬': '圣伯纳德大犬',
    '捕捉小狗中间': '捕狐猎犬中间',
}
for article_id in ('2022-1', '2022-2', '2022-3'):
    for i, paragraph in enumerate(translations.get(article_id, [])):
        for wrong, right in fixes_2022.items():
            paragraph = paragraph.replace(wrong, right)
        if article_id == '2022-1':
            paragraph = re.sub(r'注：译文选自.*$', '', paragraph).strip()
        translations[article_id][i] = paragraph

translations['2021-2'][0] = translations['2021-2'][0].replace('有雨个哑巴', '有两个哑巴').replace('速迷糊糊', '迷迷糊糊')

out = 'window.TEM8_ZH = {...(window.TEM8_ZH || {}), ...' + json.dumps(translations, ensure_ascii=False, separators=(',', ':')) + '};\n'
(ROOT / 'readingTranslations.js').write_text(out, encoding='utf-8')
for year in [*YEARS, 2017, 2018, 2019, 2021, 2023]:
    articles = [key for key in translations if key.startswith(f'{year}-')]
    print(year, ', '.join(f'{key}: {sum(bool(x) for x in translations[key])}/{len(translations[key])}' for key in articles))
