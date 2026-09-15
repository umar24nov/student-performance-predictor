"""
AcademicAI — Rule-based Academic Chatbot
========================================
Keyword-matching engine that answers common student questions:
  - attendance rules & recovery
  - study tips
  - scholarship info (India)
  - counseling / mental health helplines
  - backlogs / failures
  - doing well in exams
  - about the app itself

No external NLP dependencies required.
"""

import re


def _score(text: str, keywords):
    text = text.lower()
    return sum(1 for kw in keywords if kw in text)


def respond(message: str):
    m = message.lower().strip()
    if not m:
        return "Hi! Ask me anything about attendance, study tips, scholarships, backlogs, or exam prep."

    replies = [
        (
            ["attendance", "present", "debar", "75%", "75 percent", "missing class", "skip class"],
            [
                "📊 Most colleges require 75% attendance to sit for exams. If you're below it:",
                "1. Attend every class from today — no exceptions",
                "2. Message your teacher BEFORE you miss class (attendance is often lenient then)",
                "3. Keep medical certificates if you were genuinely sick",
                "4. Ask your coordinator about condonation options",
                "Recovery needs = (0.75 x total classes - attended) / weeks remaining."
            ],
        ),
        (
            ["study", "revision", "read", "focus", "concentrate", "procrastinate"],
            [
                "🧠 Science-backed study tips:",
                "1. 25-30 min focused blocks, phone in another room",
                "2. Active recall beats re-reading — quiz yourself, don't just read",
                "3. Teach a friend — it exposes what you don't understand",
                "4. 7+ hours of sleep does more for memory than an all-nighter",
                "5. Start with your weakest subject when your energy is highest (morning)."
            ],
        ),
        (
            ["scholarship", "financial", "fee", "stipend", "fund"],
            [
                "🎓 India scholarships you should check:",
                "1. NSP (scholarships.gov.in) — national merit + means schemes",
                "2. AICTE Pragati (₹50k/yr) for girl students in AICTE colleges",
                "3. INSPIRE (DST) — top 1% in boards, gives ₹80k/yr",
                "4. Vidyasaarathi (vidyasaarathi.co.in) — industry scholarships",
                "5. Also check your state's social welfare portal for SC/ST/OBC/Minority schemes."
            ],
        ),
        (
            ["backlog", "fail", "failed", "arrear", "kts", "atkt", "improve"],
            [
                "📚 Backlogs feel heavy but they're fixable:",
                "1. Clear your OLDEST backlog first — it compounds fast",
                "2. Focus on previous-year question papers (exam patterns repeat)",
                "3. Ask professors for doubt sessions — they usually help serious students",
                "4. Don't let one backlog stop you from passing other subjects",
                "5. Many colleges offer re-exams within weeks — check your exam cell."
            ],
        ),
        (
            ["stress", "anxiety", "depressed", "depression", "counsel", "mental", "scared", "nervous", "help"],
            [
                "💚 You're not alone — reaching out is a strength, not weakness:",
                "1. iCall (TISS): 9152987821 — free, Mon-Sat",
                "2. Vandrevala Foundation: 1860-2662-345 — 24x7, English & Hindi",
                "3. iYouth: 8800444888 — career & academic guidance",
                "4. Every UGC college has a counseling cell — walk in, it's confidential.",
                "5. Talking about it early prevents it from becoming a crisis."
            ],
        ),
        (
            ["exam", "test", "paper", "semester"],
            [
                "📝 Exam prep that works:",
                "1. Solve the last 3 years of papers — patterns repeat",
                "2. Revise in batches, test yourself, then fix weak spots",
                "3. A clean 8-10 day plan beats last-minute cramming",
                "4. Sleep properly before the exam — the day is a recall test, not a stamina test.",
            ],
        ),
        (
            ["app", "predict", "model", "accuracy", "work", "who built", "ai"],
            [
                "📊 About AcademicAI:",
                "Random Forest model trained on 395 real students → ~81% accuracy.",
                "It looks at grades, attendance, study hours, family support, and health.",
                "Turn your answers into a personalized action plan so you know exactly what to fix."
            ],
        ),
        (
            ["hello", "hi", "hey", "yo", "namaste"],
            [
                "👋 Hi! I'm your AcademicAI assistant.",
                "Ask me about: attendance • study tips • scholarships • backlogs • stress/exam help"
            ],
        ),
        (
            ["thank"],
            ["🙌 You're welcome! Wishing you a great semester. Anything else?"],
        ),
    ]

    best = None
    best_score = 0
    for keywords, reply in replies:
        s = _score(m, keywords)
        if s > best_score:
            best_score = s
            best = reply

    if best is None:
        return (
            "🤔 I can help with: attendance rules, study techniques, scholarships, "
            "backlog advice, exam prep, and mental-health resources. "
            "Try asking about 'attendance' or 'study tips'."
        )

    return "\n".join(best)


if __name__ == "__main__":
    test = ["hi", "my attendance is 60%, what do i do?", "give me scholarship options", "i failed a subject", "i feel very stressed"]
    for t in test:
        print("Q:", t)
        print(respond(t))
        print()