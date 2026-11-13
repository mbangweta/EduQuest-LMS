#!/usr/bin/env python3
"""
EduQuest LMS — one-time DB migration (run via Supabase REST API).

1. Re-point class/lessons/quizzes that reference legacy duplicate subjects
   (ARTS, CTS, HOME, ISCI, SOC, TECH) to the 10 standard subjects.
2. Split the legacy combined "Expressive Arts / Technology Studies / Home
   Economics" (CTS) END_OF_TERM assessment into 3 standard assessments
   (EA, TS, HE) and copy its scores to each.
3. Delete the legacy CTS assessment + its scores.
4. Delete the legacy duplicate subject rows (if now unreferenced).
"""
import json
import os
import urllib.request

BASE = "https://ocbginxzxeiivrgyypor.supabase.co/rest/v1"
# Read the Supabase service role key from the environment — never hardcode it.
# Export it before running:  export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not KEY:
    raise SystemExit("ERROR: set SUPABASE_SERVICE_ROLE_KEY in your environment before running this script.")

HDRS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# Standard subject IDs (from live DB query)
STD = {
    "MATH": "db3b2e82-96f4-418e-9150-92f9160fb0c8",
    "ENG":  "8a4b14a3-265a-4a7e-8b01-26f8a645893e",
    "SCI":  "e29d51c2-3dbd-48da-a361-4d0f27384796",
    "SS":   "9df44ba3-52c6-4926-a70b-ad82c8ed197e",
    "ZL":   "13363495-af21-4d8b-9c8a-a50d49dd0235",
    "SP1":  "36e00a3b-c3f3-4762-bf98-de34103bd409",
    "SP2":  "a94602a2-d471-4715-8af9-84724a8ae124",
    "TS":   "1a9bc1a1-9786-46f9-95ae-5e9337455b49",
    "HE":   "f0116524-47f8-4e1e-82ba-783ba65878a7",
    "EA":   "0d377486-20a2-4688-8721-becc65fd8aca",
}
# Legacy subject ID → standard code it maps to
LEGACY_MAP = {
    "0c07164b-abbf-43c9-a72b-75db58e424a7": "EA",   # ARTS
    "311c589b-3737-4a63-bdfd-cf8cc9ab1af8": "TS",   # CTS (combined; special-cased below)
    "43a7e111-adcb-451c-80dc-ee660dda689c": "HE",   # HOME
    "63a68400-99a5-4ddc-b88a-f8981457eed1": "SCI",  # ISCI
    "ac85f896-30cc-4204-ba39-e0a8384239a5": "SS",   # SOC
    "d97b10ee-cf80-49a3-9140-1a5d7a7482e6": "TS",   # TECH
}
CTS_ASSESSMENT = "68bda1ed-c6ec-41e7-97f9-6ef70b59476e"
CTS_SUBJECT = "311c589b-3737-4a63-bdfd-cf8cc9ab1af8"
CLASS_9B = "9bc55317-2cab-4906-962c-5afcbf1a9fb6"


def req(method: str, path: str, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers=HDRS)
    with urllib.request.urlopen(r) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else None


def log(msg: str):
    print(f"  {msg}")


def main():
    print("== Step 1: re-point classes / lessons / quizzes to standard subjects ==")
    for legacy_id, std_code in LEGACY_MAP.items():
        if legacy_id == CTS_SUBJECT:
            continue  # CTS handled specially in step 2
        target = STD[std_code]
        n = 0
        rows = req("PATCH", f"/classes?subject_id=eq.{legacy_id}&select=id", {"subject_id": target})
        n += len(rows or [])
        rows = req("PATCH", f"/lessons?subject_id=eq.{legacy_id}&select=id", {"subject_id": target})
        n += len(rows or [])
        rows = req("PATCH", f"/quizzes?subject_id=eq.{legacy_id}&select=id", {"subject_id": target})
        n += len(rows or [])
        log(f"legacy {legacy_id[:8]} -> {std_code}: {n} rows re-pointed")

    print("== Step 2: split legacy CTS END_OF_TERM assessment into EA / TS / HE ==")
    cts = req("GET", f"/assessments?id=eq.{CTS_ASSESSMENT}&select=*")
    if not cts:
        log("CTS assessment already gone — nothing to split")
    else:
        a = cts[0]
        scores = req("GET", f"/assessment_scores?assessment_id=eq.{CTS_ASSESSMENT}&select=learner_id,score")
        log(f"CTS assessment found, {len(scores)} scores to copy")
        for code in ("EA", "TS", "HE"):
            existing = req("GET", f"/assessments?class_id=eq.{CLASS_9B}&term=eq.1&subject_id=eq.{STD[code]}&select=id")
            if existing:
                new_id = existing[0]["id"]
                log(f"  {code}: END_OF_TERM assessment already exists ({new_id[:8]})")
            else:
                name = "Expressive Arts" if code == "EA" else "Technology Studies" if code == "TS" else "Home Economics"
                created = req("POST", "/assessments", {
                    "school_id": a["school_id"],
                    "title": f"{name} — End of Term 1",
                    "type": "END_OF_TERM",
                    "term": a["term"],
                    "subject_id": STD[code],
                    "grade": a["grade"],
                    "class_id": a["class_id"],
                    "teacher_id": a["teacher_id"],
                    "date": a["date"],
                    "max_score": a["max_score"],
                    "weight": 1.0,
                    "status": "PUBLISHED",
                })
                new_id = created[0]["id"] if isinstance(created, list) else created["id"]
                log(f"  {code}: created assessment {new_id[:8]}")
            for s in scores:
                dup = req("GET", f"/assessment_scores?assessment_id=eq.{new_id}&learner_id=eq.{s['learner_id']}&select=id")
                if dup:
                    req("PATCH", f"/assessment_scores?id=eq.{dup[0]['id']}", {"score": s["score"]})
                else:
                    req("POST", "/assessment_scores", {
                        "assessment_id": new_id,
                        "learner_id": s["learner_id"],
                        "score": s["score"],
                    })
            log(f"  {code}: {len(scores)} scores copied")

    print("== Step 3: delete legacy CTS assessment + scores ==")
    req("DELETE", f"/assessment_scores?assessment_id=eq.{CTS_ASSESSMENT}")
    req("DELETE", f"/assessments?id=eq.{CTS_ASSESSMENT}")
    log("deleted CTS assessment and its scores")

    print("== Step 4: delete legacy duplicate subjects ==")
    for legacy_id in LEGACY_MAP:
        refs = []
        for table in ("classes", "lessons", "quizzes", "assessments", "teacher_subject_assignments", "question_bank"):
            r = req("GET", f"/{table}?subject_id=eq.{legacy_id}&select=id")
            if r:
                refs.append(f"{table}:{len(r)}")
        if refs:
            log(f"subject {legacy_id[:8]} STILL REFERENCED by {', '.join(refs)} — not deleted")
        else:
            req("DELETE", f"/subjects?id=eq.{legacy_id}")
            log(f"subject {legacy_id[:8]} deleted")

    print("== Verify: remaining subjects ==")
    subs = req("GET", "/subjects?select=code,name&order=code.asc")
    for s in subs:
        log(f"{s['code']:6} {s['name']}")
    print(f"Total: {len(subs)} subjects")

    print("== Verify: END_OF_TERM coverage for class 9bc55317 term 1 ==")
    asmts = req("GET", f"/assessments?class_id=eq.{CLASS_9B}&term=eq.1&type=eq.END_OF_TERM&select=title,subject_id")
    inv = {v: k for k, v in STD.items()}
    for a in asmts:
        log(f"{inv.get(a['subject_id'], '???'):5} {a['title']}")
    print(f"Total: {len(asmts)} END_OF_TERM assessments (should be 10)")


if __name__ == "__main__":
    main()
