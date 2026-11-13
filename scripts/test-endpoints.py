#!/usr/bin/env python3
"""End-to-end API tests for the mark schedule / mark sheet flow."""
import json
import subprocess
import urllib.request
import urllib.error

BASE = "http://localhost:3000"
COOKIE = open("/tmp/cookie.txt").read().strip()
CLASS_ID = "9bc55317-2cab-4906-962c-5afcbf1a9fb6"  # Grade 6 Science


def api_get(path):
    req = urllib.request.Request(BASE + path, headers={"Cookie": COOKIE})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"__http": e.code, **json.loads(e.read().decode() or "{}")}


def api_post_multipart(path, fields, filename, filebytes):
    boundary = "----EduQuestTestBoundary42"
    body = b""
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + filebytes + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        BASE + path, data=body, method="POST",
        headers={"Cookie": COOKIE, "Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"__http": e.code, **json.loads(e.read().decode() or "{}")}


print("=" * 70)
print("TEST 1: Mark schedule — 10 subject columns")
print("=" * 70)
d = api_get(f"/api/mark-schedule?classId={CLASS_ID}")
if "error" in d:
    print("FAIL:", d["error"])
else:
    subs = d.get("subjects", [])
    print(f"PASS — {len(subs)} subject columns")
    for s in subs:
        flag = "has-assessment" if s["assessmentId"] else "NO ASSESSMENT (shows —)"
        print(f"  {s['code']:5} {s['name']:22} maxScore={s['maxScore']:4} {flag}")
    print(f"Rows:")
    for r in d.get("rows", []):
        sbs = r["scoresBySubject"]
        nonnull = {k: v for k, v in sbs.items() if v is not None}
        print(f"  {r['learner']['name']:30} scores={nonnull} avg={r['averageScore']} grade={r['grade']} rank={r['rank']}")

print()
print("=" * 70)
print("TEST 2: Assessments API without status filter (DRAFT visible)")
print("=" * 70)
d = api_get(f"/api/assessments?classId={CLASS_ID}&term=1")
if "error" in d:
    print("FAIL:", d["error"])
else:
    for a in d["assessments"]:
        print(f"  {a['type']:12} {a['status']:9} {a['title'][:52]:54} subject={a['subject']['name'] if a['subject'] else 'All subjects'}")

print()
print("=" * 70)
print("TEST 3: Mark sheet upload (xlsx with all 10 subject columns)")
print("=" * 70)
# Build the xlsx exactly like the frontend template does
code = """
const XLSX = require('xlsx');
const SUBJECT_COLUMNS = ['MATHEMATICS','ENGLISH','SCIENCE','SOCIAL STUDIES','ZAMBIAN LANGUAGE','SPECIAL PAPER 1','SPECIAL PAPER 2','TECHNOLOGY STUDIES','HOME ECONOMICS','EXPRESSIVE ARTS'];
const learners = [['Chanda Mwansa','45','52','48','50','47','49','44','46','51'],
                  ['Bupe Phiri','38','41','35','40','39','42','37','40','36']];
const headers = ['S/N','NAME',...SUBJECT_COLUMNS,'TOTAL','POSITION'];
const rows = [headers];
learners.forEach((l, i) => {
  const rowNum = i + 2;
  rows.push([i+1, l[0], ...l.slice(1), {f:`SUM(C${rowNum}:L${rowNum})`}, '']);
});
const last = learners.length + 1;
const avg = ['', 'Average'];
for (let j = 0; j < 10; j++) {
  const col = String.fromCharCode(67 + j);
  avg.push({f:`IFERROR(AVERAGE(${col}2:${col}${last}),0)`});
}
avg.push('',''); rows.push(avg);
const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Term 1');
XLSX.writeFile(wb, '/tmp/test-mark-sheet.xlsx');
console.log('xlsx written');
"""
open("/tmp/build-xlsx.js", "w").write(code)
r = subprocess.run(["node", "/home/z/my-project/scripts/build-xlsx.js"], capture_output=True, text=True, cwd="/home/z/my-project")
print(r.stdout.strip(), r.stderr.strip()[:200])
data = open("/tmp/test-mark-sheet.xlsx", "rb").read()
d = api_post_multipart(
    "/api/mark-sheet/upload",
    {"classId": CLASS_ID, "term": "1"},
    "grade-6-science-term-1-mark-sheet.xlsx",
    data,
)
print(json.dumps(d, indent=1)[:1500])

print()
print("=" * 70)
print("TEST 4: Mark schedule AFTER upload (SCI column should now have scores)")
print("=" * 70)
d = api_get(f"/api/mark-schedule?classId={CLASS_ID}&term=1")
if "error" in d:
    print("FAIL:", d["error"])
else:
    subs = d.get("subjects", [])
    print(f"subjects: {len(subs)} — all with assessments: {all(s['assessmentId'] for s in subs)}")
    for r in d.get("rows", []):
        sbs = r["scoresBySubject"]
        nonnull = {k: v for k, v in sbs.items() if v is not None}
        print(f"  {r['learner']['name']:30} avg={r['averageScore']} grade={r['grade']} rank={r['rank']}")
        print(f"    scores: {nonnull}")
