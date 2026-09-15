

import { useState, useEffect, useCallback, lazy, Suspense } from "react";

import API_URL, { getToken, getUser, saveAuth, clearAuth } from "./api";
import { buildPayload, GRADE_MAP } from "./utils/payload";

const Auth          = lazy(() => import("./Auth"));
const LandingPage   = lazy(() => import("./LandingPage"));
const Dashboard     = lazy(() => import("./Dashboard"));
const ModelCompare  = lazy(() => import("./ModelCompare"));
const StudySchedule = lazy(() => import("./StudySchedule"));
const Chatbot       = lazy(() => import("./Chatbot"));

const LazyPage = ({ children }) => (
  <Suspense fallback={<div className="relative z-10 flex items-center justify-center min-h-[60vh]"><div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-400 rounded-full spinner"/></div>}>
    {children}
  </Suspense>
);

function smoothScrollTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" });
}

async function saveResponse(payload, result) {
  try {
    await fetch(`${API_URL}/save-response`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        features: payload, prediction: result.prediction, confidence: result.confidence,
        confidence_scores: result.confidence_scores, timestamp: new Date().toISOString(),
      }),
    });
  } catch (_) {}
}

function analyzeStudent(a) {
  const risks = [], strengths = [], actions = [];

  const att = a.attendance;
  if (att === "below60") {
    risks.push({ factor: "Attendance", severity: "critical", msg: "Below 60% — most colleges will bar you from exams at this level." });
    actions.push({ text: "Attend every class this week. No exceptions.", priority: 1 });
    actions.push({ text: "Meet your class coordinator TODAY to discuss your situation", priority: 1 });
  } else if (att === "60-75") {
    risks.push({ factor: "Attendance", severity: "warning", msg: "60-75% attendance — the 75% exam eligibility cutoff is at risk." });
    actions.push({ text: "Attend all remaining classes to push above 75%", priority: 2 });
  } else {
    strengths.push({ factor: "Attendance", msg: att === "above90" ? "Excellent — showing up consistently is the #1 predictor of passing." : "Solid attendance. Keep it up." });
  }

  const st = parseInt(a.studytime) || 2;
  if (st <= 1) {
    risks.push({ factor: "Study Time", severity: "critical", msg: "Under 2 hrs/week is the single biggest risk factor our model found." });
    actions.push({ text: "Start with 30 min of focused study daily — phone in another room", priority: 1 });
    actions.push({ text: "Pick your weakest subject and revise one chapter today", priority: 2 });
  } else if (st === 2) {
    risks.push({ factor: "Study Time", severity: "low", msg: "2-5 hrs/week is average. Even 1 extra hour makes a measurable difference." });
    actions.push({ text: "Add 1 extra hour of study this week — even 15 min/day helps", priority: 3 });
  } else {
    strengths.push({ factor: "Study Time", msg: st >= 4 ? "Serious study hours — that discipline directly shows in results." : "Good study routine. Consistency is your advantage." });
  }

  const fails = parseInt(a.failures) || 0;
  if (fails >= 2) {
    risks.push({ factor: "Backlogs", severity: "critical", msg: fails + " backlogs is serious. Risk of losing motivation compounds fast." });
    actions.push({ text: "Clear your oldest backlog first — it gets harder every semester", priority: 1 });
    actions.push({ text: "Ask professors for extra doubt sessions for failed subjects", priority: 2 });
  } else if (fails === 1) {
    risks.push({ factor: "Backlogs", severity: "warning", msg: "One backlog is recoverable. Don't let it become two." });
    actions.push({ text: "Set a goal to clear it this semester — schedule dedicated time for it", priority: 2 });
  } else {
    strengths.push({ factor: "Backlogs", msg: "Clean record — no backlogs. That's a strong foundation." });
  }

  const sem = parseInt(a.currentSem) || 1;
  const g1Val = sem === 1 ? GRADE_MAP[a.interGrade || "5-6"] : GRADE_MAP[a.G1 || "5-6"];
  if (g1Val <= 3.5) {
    risks.push({ factor: "Grades", severity: "critical", msg: "Low recent grades strongly predict continued struggle without intervention." });
    actions.push({ text: "Visit your professor this week — ask exactly what to focus on", priority: 1 });
    actions.push({ text: "Solve last 3 years of question papers for each subject", priority: 2 });
  } else if (g1Val <= 5.5) {
    risks.push({ factor: "Grades", severity: "warning", msg: "Average grades — the gap between you and top performers is closable with effort." });
    actions.push({ text: "Try explaining concepts to a friend — it reveals what you don't understand", priority: 3 });
  } else if (g1Val >= 7.5) {
    strengths.push({ factor: "Grades", msg: "Strong academic foundation. Your grades put you in a good position." });
  }

  if (a.schoolsup === "no") {
    risks.push({ factor: "No Coaching", severity: "low", msg: "Without extra coaching, self-study becomes your primary weapon." });
    actions.push({ text: "Check if your college offers free remedial classes or peer tutoring", priority: 3 });
  } else {
    strengths.push({ factor: "Tutoring", msg: "Coaching gives you an edge — make sure you actively use it, not just attend." });
  }

  if (a.famsup === "no") {
    risks.push({ factor: "Family Support", severity: "warning", msg: "Lack of family support makes the journey harder. Build your own network." });
    actions.push({ text: "Find a mentor — a senior, teacher, or counselor who can guide you", priority: 2 });
  } else {
    strengths.push({ factor: "Family Support", msg: "Family backing is a major predictor of success. You have that advantage." });
  }

  const hlth = parseInt(a.health) || 3;
  if (hlth <= 2) {
    risks.push({ factor: "Health", severity: "warning", msg: "Poor health impacts your ability to focus, attend class, and retain information." });
    actions.push({ text: "Sleep 7+ hours tonight — memory consolidation happens during sleep", priority: 2 });
    actions.push({ text: "Walk 20 min daily — it measurably improves focus and grades", priority: 3 });
  } else if (hlth >= 4) {
    strengths.push({ factor: "Health", msg: "Good health — you have the physical foundation to perform well." });
  }

  if (a.internet === "no") {
    risks.push({ factor: "Resources", severity: "low", msg: "No internet limits access to online study materials and resources." });
    actions.push({ text: "Use your college library — most have free WiFi and computers", priority: 3 });
  }

  actions.sort((a, b) => a.priority - b.priority);
  return { risks, strengths, actions: actions.slice(0, 6) };
}

// Grade options reused across multiple questions
const GRADE_OPTIONS = [
  {v:"0-2",l:"0 – 2",e:"😟"},{v:"3-4",l:"3 – 4",e:"😕"},
  {v:"5-6",l:"5 – 6",e:"😐"},{v:"7-8",l:"7 – 8",e:"🙂"},
  {v:"9-10",l:"9 – 10",e:"🌟"},
];

// ─── Static base questions (always shown) ─────────────────────────────────────
const BASE_QUESTIONS = [
  { id:"sex", section:"About You", icon:"👤", q:"What's your gender?",
    type:"choice", cols:2, options:[{v:"M",l:"Male",e:"👦"},{v:"F",l:"Female",e:"👧"}] },

  { id:"age", section:"About You", icon:"🎂", q:"How old are you?",
    type:"number", min:15, max:35, placeholder:"e.g. 19" },

  { id:"address", section:"About You", icon:"🏘️", q:"Do you live in a city or a smaller town/village?",
    type:"choice", cols:2, options:[{v:"U",l:"City / Urban",e:"🏙️"},{v:"R",l:"Town / Village",e:"🌾"}] },

  { id:"currentSem", section:"About You", icon:"📅",
    q:"Which year of college are you in right now?",
    type:"choice", cols:2, options:[
      {v:"1",l:"1st Year",e:"🆕"},{v:"2",l:"2nd Semester",e:"2️⃣"},
      {v:"3",l:"2nd Year",e:"3️⃣"},{v:"4",l:"4th Semester",e:"4️⃣"},
      {v:"5",l:"3rd Year",e:"5️⃣"},{v:"6",l:"6th Semester",e:"6️⃣"},
      {v:"7",l:"Final Year",e:"7️⃣"},{v:"8",l:"Last Semester",e:"🎓"},
    ]},

  { id:"Medu", section:"Your Family", icon:"👩‍🎓", q:"What's your mother's education level?",
    type:"choice", cols:2, options:[
      {v:"0",l:"No formal education",e:"—"},{v:"1",l:"Up to 5th / Primary",e:"📖"},
      {v:"2",l:"Up to 8th / Middle school",e:"📚"},{v:"3",l:"10th or 12th passed",e:"🏫"},
      {v:"4",l:"College graduate or higher",e:"🎓"}] },

  { id:"Fedu", section:"Your Family", icon:"👨‍🎓", q:"What's your father's education level?",
    type:"choice", cols:2, options:[
      {v:"0",l:"No formal education",e:"—"},{v:"1",l:"Up to 5th / Primary",e:"📖"},
      {v:"2",l:"Up to 8th / Middle school",e:"📚"},{v:"3",l:"10th or 12th passed",e:"🏫"},
      {v:"4",l:"College graduate or higher",e:"🎓"}] },

  { id:"studytime", section:"Your Studies", icon:"📖", q:"How many hours a week do you study outside class?",
    type:"choice", cols:2, options:[
      {v:"1",l:"Less than 2 hours",e:"😬"},{v:"2",l:"2 – 5 hours",e:"📚"},
      {v:"3",l:"5 – 10 hours",e:"💡"},{v:"4",l:"More than 10 hours",e:"🌟"}] },

  { id:"failures", section:"Your Studies", icon:"📚", q:"Have you ever failed a subject or had a backlog?",
    hint:"University exams only. 0 is perfectly normal.",
    type:"choice", cols:4, options:[
      {v:"0",l:"No",e:"✅"},{v:"1",l:"1 subject",e:"1️⃣"},
      {v:"2",l:"2 subjects",e:"2️⃣"},{v:"3",l:"3 or more",e:"3️⃣"}] },

  { id:"attendance", section:"Your Studies", icon:"🏫", q:"What's your attendance like this year?",
    type:"choice", cols:2, options:[
      {v:"above90",l:"Above 90%",e:"🌟"},{v:"75-90",l:"75% – 90%",e:"✅"},
      {v:"60-75",l:"60% – 75%",e:"⚠️"},{v:"below60",l:"Below 60%",e:"🚨"}] },
];

// ─── Tail questions (always shown after grades) ───────────────────────────────
const TAIL_QUESTIONS = [
  { id:"schoolsup", section:"Your Support", icon:"🎯", q:"Do you attend coaching or have a tutor?",
    hint:"Any extra academic help — tuition, coaching centre, senior mentor",
    type:"yesno" },
  { id:"famsup", section:"Your Support", icon:"👨‍👩‍👧", q:"Does your family actively support your studies?",
    hint:"Encouraging your education, helping with fees or study materials",
    type:"yesno" },
  { id:"internet", section:"Your Setup", icon:"📱", q:"Do you have internet access at home for studying?",
    type:"yesno" },
  { id:"health", section:"Your Health", icon:"💪", q:"How's your health these days?",
    hint:"Physical and mental health both affect your performance",
    type:"choice", cols:3, options:[
      {v:"1",l:"Poor",e:"🤒"},{v:"2",l:"Below avg",e:"😔"},
      {v:"3",l:"Average",e:"😐"},{v:"4",l:"Good",e:"🙂"},{v:"5",l:"Great",e:"💪"}] },
];

function buildQuestions(answers) {
  const sem = parseInt(answers.currentSem) || 0;
  const questions = [...BASE_QUESTIONS];

  if (sem === 0) return [...questions, ...TAIL_QUESTIONS];

  if (sem === 1) {
    questions.push({
      id: "interGrade", section: "Your Grades", icon: "🏫",
      q: "What was your 12th / Inter board exam average?",
      hint: "Out of 10 — pick the closest range (e.g. 75% = 7-8)",
      type: "choice", cols: 3, options: GRADE_OPTIONS,
    });
  } else {
    questions.push({
      id: "G1", section: "Your Grades", icon: "📝",
      q: "What was your average in Semester 1?",
      hint: "Out of 10 — pick the closest range",
      type: "choice", cols: 3, options: GRADE_OPTIONS,
    });

    if (sem >= 2) {
      questions.push({
        id: "G2", section: "Your Grades", icon: "📊",
        q: "What was your average in Semester 2?",
        hint: "Out of 10 — pick the closest range",
        type: "choice", cols: 3, options: GRADE_OPTIONS,
      });
    }
  }

  return [...questions, ...TAIL_QUESTIONS];
}

// ─── Small UI atoms ────────────────────────────────────────────────────────────

function Tag({ color = "blue", children }) {
  const c = {
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
    violet:  "text-violet-400 bg-violet-500/10 border-violet-500/25",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    yellow:  "text-yellow-400 bg-yellow-500/10 border-yellow-500/25",
  };
  return <span className={`inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border ${c[color]}`}>{children}</span>;
}

function PageShell({ children, onBack }) {
  return (
    <div className="relative z-10 min-h-[calc(100vh-64px)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
          ← Back to Home
        </button>
        {children}
      </div>
    </div>
  );
}

/**
 * ChoiceGrid — hover-only highlight, no persistent selected state shown.
 * Selecting auto-advances the quiz so the card never stays "marked".
 * On the BACK journey (revisiting a question), we still show a subtle
 * indicator so the user knows what they picked — but it's a soft outline, not filled.
 */
function ChoiceGrid({ options, cols = 2, value, onSelect, autoAdvance = true }) {
  const [hovered, setHovered] = useState(null);
  const grid = { 2:"grid-cols-2", 3:"grid-cols-3", 4:"grid-cols-2 sm:grid-cols-4" }[cols] || "grid-cols-2";
  const isMultiCol = cols >= 3;

  return (
    <div className={`grid ${grid} gap-2.5`}>
      {options.map(o => {
        const isHov = hovered === o.v;
        const isPrev = value === o.v; // previously selected (came back to this Q)
        return (
          <button
            key={o.v}
            onClick={() => onSelect(o.v)}
            onMouseEnter={() => setHovered(o.v)}
            onMouseLeave={() => setHovered(null)}
            className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-sm font-medium text-left transition-all duration-150
              ${isMultiCol ? "flex-col items-center text-center text-xs gap-1.5 py-3.5" : ""}
              ${isHov
                ? "border-blue-400 bg-blue-500/15 text-white shadow shadow-blue-500/20 scale-[1.02]"
                : isPrev
                  ? "border-white/20 bg-white/5 text-slate-200"   // soft re-visited indicator
                  : "border-white/8 bg-white/3 text-slate-400"
              }`}
          >
            <span className={isMultiCol ? "text-2xl" : "text-xl leading-none"}>{o.e}</span>
            <span className="leading-tight">{o.l}</span>
          </button>
        );
      })}
    </div>
  );
}

function YesNoInput({ value, onSelect }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="grid grid-cols-2 gap-3">
      {[{v:"yes",l:"Yes",e:"✅"},{v:"no",l:"No",e:"❌"}].map(o => {
        const isHov = hovered === o.v;
        const isPrev = value === o.v;
        return (
          <button key={o.v} onClick={() => onSelect(o.v)}
            onMouseEnter={() => setHovered(o.v)} onMouseLeave={() => setHovered(null)}
            className={`flex items-center justify-center gap-3 py-4 rounded-xl border text-base font-semibold transition-all
              ${isHov
                ? "border-blue-400 bg-blue-500/15 text-white scale-[1.02]"
                : isPrev ? "border-white/20 bg-white/5 text-slate-200"
                : "border-white/8 bg-white/3 text-slate-400"}`}>
            <span className="text-2xl">{o.e}</span>{o.l}
          </button>
        );
      })}
    </div>
  );
}

function NumberInput({ value, onChange, min, max, placeholder }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, (parseInt(value)||min+1)-1))}
        className="w-12 h-12 shrink-0 rounded-2xl bg-white/5 border border-white/10 text-xl font-bold hover:border-blue-400/50 hover:text-blue-400 transition-all">−</button>
      <input type="number" value={value||""} placeholder={placeholder} min={min} max={max}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-center text-2xl font-bold outline-none focus:border-blue-500 transition-colors"/>
      <button onClick={() => onChange(Math.min(max, (parseInt(value)||min-1)+1))}
        className="w-12 h-12 shrink-0 rounded-2xl bg-white/5 border border-white/10 text-xl font-bold hover:border-blue-400/50 hover:text-blue-400 transition-all">+</button>
    </div>
  );
}

// ─── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ result, analysis, onRetry, onHome, onRate }) {
  const cfg = {
    Pass:     { grad:"from-emerald-950 to-emerald-900", accent:"text-emerald-400", bar:"#34d399" },
    Fail:     { grad:"from-orange-950 to-orange-900",   accent:"text-orange-400",  bar:"#fb923c" },
    "At-Risk":{ grad:"from-red-950 to-red-900",         accent:"text-red-400",     bar:"#f87171" },
  };
  const barC = { Pass:"#34d399", Fail:"#fb923c", "At-Risk":"#f87171" };
  const c = cfg[result.prediction] || cfg["Fail"];
  const scores = result.confidence_scores || {};
  const { risks = [], strengths = [], actions = [] } = analysis || {};

  return (
    <div className="space-y-4 animate-popIn">
      <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        <div className={`bg-gradient-to-br ${c.grad} p-8 sm:p-10 text-center relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-20" style={{background:`radial-gradient(circle at 50% 60%,${c.bar},transparent 65%)`}}/>
          <span className="text-6xl block mb-4 relative z-10">{result.emoji}</span>
          <p className={`text-xs font-bold tracking-widest uppercase ${c.accent} mb-2 relative z-10`}>Your Prediction</p>
          <h2 className={`font-display text-4xl sm:text-5xl font-extrabold ${c.accent} relative z-10`}>{result.prediction}</h2>
          <p className="text-white/70 text-sm mt-2 relative z-10">AI Confidence: <strong className="text-white">{result.confidence}%</strong></p>
        </div>
        <div className="bg-[#0d1220] p-6 sm:p-8">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-4">Probability Breakdown</p>
          {Object.entries(scores).map(([label, pct]) => (
            <div key={label} className="flex items-center gap-3 mb-3.5">
              <span className="text-sm font-semibold w-16 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-white/6 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{width:`${pct}%`,background:barC[label]||"#8892a4"}}/>
              </div>
              <span className="text-xs font-bold text-slate-400 w-10 text-right">{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {risks.length > 0 && (
        <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-4">What is putting you at risk</p>
          <div className="space-y-3">
            {risks.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${r.severity === "critical" ? "border-red-500/25 bg-red-500/5" : r.severity === "warning" ? "border-yellow-500/20 bg-yellow-500/5" : "border-white/8 bg-white/3"}`}>
                <span className={`text-lg shrink-0 mt-0.5 ${r.severity === "critical" ? "text-red-400" : r.severity === "warning" ? "text-yellow-400" : "text-slate-400"}`}>
                  {r.severity === "critical" ? "\u25CF" : r.severity === "warning" ? "\u25CF" : "\u25CB"}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{r.factor}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{r.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {strengths.length > 0 && (
        <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-bold tracking-widest uppercase text-emerald-400 mb-4">What is working for you</p>
          <div className="space-y-3">
            {strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-500/15 bg-emerald-500/5">
                <span className="text-lg shrink-0 mt-0.5 text-emerald-400">+</span>
                <div>
                  <p className="text-sm font-bold text-white">{s.factor}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{s.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="bg-gradient-to-br from-blue-500/8 to-violet-500/8 border border-blue-500/20 rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-1">Your Action Plan</p>
          <p className="text-xs text-slate-500 mb-5">Do these in order — the first ones matter most</p>
          <div className="space-y-3">
            {actions.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-300 leading-relaxed">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8">
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">What this means</p>
          <p className="text-sm text-slate-300 leading-relaxed">{result.tip}</p>
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0"/>
          Model trained on {result.dataset_size||"395"} students · Accuracy: {result.model_accuracy} · Random Forest
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5">
          <button onClick={onRetry} className="py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/8 transition-all">Retry</button>
          <button onClick={onHome}  className="py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/8 transition-all">Home</button>
          <button onClick={onRate}  className="py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-bold hover:bg-yellow-500/15 transition-all">Rate Us</button>
          <button onClick={async () => { const { downloadShareableCard } = await import("./utils/shareCard"); downloadShareableCard(result); }} className="py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/15 transition-all">📥 Image</button>
          <button onClick={async () => { const { generateReport } = await import("./utils/pdfReport"); generateReport(result, analysis); }} className="py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold hover:bg-blue-500/15 transition-all">📄 PDF</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inner pages ───────────────────────────────────────────────────────────────
function RateUsPage({ onBack }) {
  const [rating,setRating]=useState(0);const[hover,setHover]=useState(0);const[msg,setMsg]=useState("");const[name,setName]=useState("");const[tags,setTags]=useState([]);const[done,setDone]=useState(false);
  const TAGS=["Accuracy","Easy to use","Question design","Speed","Result clarity","Mobile friendly"];
  if(done)return(<PageShell onBack={onBack}><div className="bg-[#0d1220] border border-white/8 rounded-3xl p-10 text-center"><div className="text-6xl mb-4">🎉</div><h2 className="font-display text-3xl font-extrabold mb-3">Thank You!</h2><p className="text-slate-400 text-sm">Your {rating}-star rating helps improve AcademicAI.</p><div className="flex justify-center gap-1 mt-4">{[1,2,3,4,5].map(s=><span key={s} className={`text-2xl ${s<=rating?"text-yellow-400":"text-slate-700"}`}>★</span>)}</div><button onClick={onBack} className="mt-8 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold transition-all">Back to Home</button></div></PageShell>);
  return(<PageShell onBack={onBack}><Tag color="yellow">Rate Us</Tag><h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 mb-2 tracking-tight">How Was Your Experience?</h1><p className="text-slate-400 text-sm mb-8">Your feedback helps us improve AcademicAI for every student.</p><div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8 space-y-6"><div><p className="text-sm font-semibold mb-3 text-slate-300">Overall Rating <span className="text-red-400">*</span></p><div className="flex gap-2">{[1,2,3,4,5].map(s=><button key={s} onClick={()=>setRating(s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} className="text-4xl transition-all hover:scale-110"><span className={(hover||rating)>=s?"text-yellow-400":"text-slate-700"}>★</span></button>)}</div>{(hover||rating)>0&&<p className="text-sm text-slate-400 mt-2">{["","Terrible 😞","Not great 😕","Okay 😐","Good 👍","Excellent 🌟"][hover||rating]}</p>}</div><div><label className="block text-sm font-semibold text-slate-300 mb-2">Name <span className="text-slate-600 text-xs">(optional)</span></label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Rohan Sharma" className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"/></div><div><p className="text-sm font-semibold text-slate-300 mb-3">What did you like? <span className="text-slate-600 text-xs">(optional)</span></p><div className="flex flex-wrap gap-2">{TAGS.map(t=><button key={t} onClick={()=>setTags(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t])} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${tags.includes(t)?"border-blue-500 bg-blue-500/10 text-blue-300":"border-white/10 text-slate-400 hover:border-white/20 bg-white/3"}`}>{t}</button>)}</div></div><div><label className="block text-sm font-semibold text-slate-300 mb-2">Feedback <span className="text-slate-600 text-xs">(optional)</span></label><textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={4} placeholder="Tell us what could be better..." className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors resize-none"/></div><button onClick={()=>rating&&setDone(true)} disabled={!rating} className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${rating?"bg-gradient-to-r from-blue-500 to-violet-600 hover:-translate-y-0.5":"bg-white/5 text-slate-600 cursor-not-allowed"}`}>{rating?`Submit ${rating}-Star Rating ★`:"Select a rating first"}</button></div></PageShell>);
}

function AboutPage({ onBack }) {
  return(<PageShell onBack={onBack}><Tag color="blue">About</Tag><h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 mb-8 tracking-tight">About AcademicAI</h1><div className="bg-[#0d1220] border border-white/8 rounded-3xl overflow-hidden"><div className="bg-gradient-to-br from-blue-950 to-violet-950 p-10 text-center"><div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-4xl mx-auto mb-5">👨‍💻</div><h2 className="font-display text-2xl sm:text-3xl font-extrabold mb-1">Mohammad Umar</h2><p className="text-blue-300 text-sm font-semibold tracking-wide">B.Tech — Computer Science & Engineering</p></div><div className="p-6 sm:p-10 space-y-7">{[["About the Creator","Hi! I'm Mohammad Umar, a B.Tech CSE student passionate about Machine Learning. AcademicAI is a full-stack ML project covering data preprocessing, model training, REST API, and a complete web interface."],["About AcademicAI","AcademicAI uses a Random Forest model trained on the UCI Student Performance dataset to classify students as Pass, Fail, or At-Risk based on academic, family, and background factors."]].map(([t,d])=><div key={t}><h3 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">{t}</h3><p className="text-slate-300 text-sm leading-relaxed">{d}</p></div>)}<div><h3 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-3">Tech Stack</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[["⚛️","React.js","Frontend"],["🎨","Tailwind CSS","Styling"],["🐍","FastAPI","Backend"],["🤖","scikit-learn","ML"],["🌲","Random Forest","Algorithm"],["📊","Python","Data Science"]].map(([e,n,r])=><div key={n} className="bg-white/4 border border-white/8 rounded-xl p-3 text-center"><div className="text-2xl mb-1">{e}</div><div className="text-sm font-bold">{n}</div><div className="text-xs text-slate-500 mt-0.5">{r}</div></div>)}</div></div><div><h3 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-3">Connect</h3><div className="flex flex-col sm:flex-row gap-3">{[["🐙","GitHub","github.com/umar24nov","https://github.com/umar24nov"],["💼","LinkedIn","mohammadumarfarook","https://www.linkedin.com/in/mohammadumarfarook"],["📧","Email","umar24nov@gmail.com","mailto:umar24nov@gmail.com"]].map(([e,l,v,h])=><a key={l} href={h} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-xl px-4 py-3 hover:border-white/20 hover:bg-white/8 transition-all"><span className="text-xl">{e}</span><div><div className="text-sm font-bold">{l}</div><div className="text-xs text-slate-500">{v}</div></div></a>)}</div></div></div></div></PageShell>);
}

function LegalPage({ onBack, title, tag, sections }) {
  return(<PageShell onBack={onBack}><Tag color="violet">{tag}</Tag><h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight">{title}</h1><p className="text-slate-500 text-xs mt-2 mb-8">Last updated: March 2025</p><div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-10">{sections.map(([t,d],i)=><div key={t} className={i>0?"border-t border-white/6 pt-6 mt-6":""}><h3 className="font-bold text-sm text-white mb-2">{t}</h3><p className="text-sm text-slate-400 leading-relaxed">{d}</p></div>)}</div></PageShell>);
}

function ContactPage({ onBack }) {
  const[form,setForm]=useState({name:"",email:"",subject:"",message:""});const[sending,setSending]=useState(false);const[done,setDone]=useState(false);
  const update=(k,v)=>setForm(p=>({...p,[k]:v}));const valid=form.name&&form.email&&form.subject&&form.message;
  async function submit(){if(!valid)return;setSending(true);await new Promise(r=>setTimeout(r,900));setDone(true);setSending(false);}
  if(done)return(<PageShell onBack={onBack}><div className="bg-[#0d1220] border border-white/8 rounded-3xl p-10 text-center"><div className="text-5xl mb-4">📬</div><h2 className="font-display text-2xl font-extrabold mb-2">Message Received!</h2><p className="text-slate-400 text-sm">I'll reply within 48 hours to <strong className="text-slate-200">{form.email}</strong>.</p><button onClick={onBack} className="mt-8 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold transition-all">Back to Home</button></div></PageShell>);
  return(<PageShell onBack={onBack}><Tag color="emerald">Contact</Tag><h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 mb-2 tracking-tight">Get in Touch</h1><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">{[{e:"📧",l:"Email",v:"umar24nov@gmail.com",h:"mailto:umar24nov@gmail.com"},{e:"🐙",l:"GitHub",v:"umar24nov",h:"https://github.com/umar24nov"},{e:"💼",l:"LinkedIn",v:"mohammadumarfarook",h:"https://www.linkedin.com/in/mohammadumarfarook"}].map(c=><a key={c.l} href={c.h} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-[#0d1220] border border-white/8 rounded-2xl px-4 py-3.5 hover:border-white/20 transition-all"><span className="text-2xl shrink-0">{c.e}</span><div><div className="text-xs font-bold uppercase tracking-wide text-slate-400">{c.l}</div><div className="text-xs text-slate-300 mt-0.5 truncate">{c.v}</div></div></a>)}</div><div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[["Name","name","text","Your name"],["Email","email","email","you@email.com"]].map(([l,k,t,p])=><div key={k}><label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{l} <span className="text-red-400">*</span></label><input type={t} value={form[k]} onChange={e=>update(k,e.target.value)} placeholder={p} className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"/></div>)}</div><div><label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Subject <span className="text-red-400">*</span></label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">{["Bug Report","Feature Request","General Query","Feedback"].map(s=><button key={s} onClick={()=>update("subject",s)} className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${form.subject===s?"border-blue-500 bg-blue-500/10 text-blue-300":"border-white/10 text-slate-400 hover:border-white/20"}`}>{s}</button>)}</div><input value={form.subject} onChange={e=>update("subject",e.target.value)} placeholder="Or type your own..." className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"/></div><div><label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Message <span className="text-red-400">*</span></label><textarea rows={5} value={form.message} onChange={e=>update("message",e.target.value)} placeholder="Write your message here..." className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors resize-none"/></div><button onClick={submit} disabled={!valid||sending} className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${valid&&!sending?"bg-gradient-to-r from-blue-500 to-violet-600 hover:-translate-y-0.5":"bg-white/5 text-slate-600 cursor-not-allowed"}`}>{sending?"Sending…":valid?"Send Message →":"Fill all required fields"}</button></div></PageShell>);
}

function ResourcePage({ onBack, tag, title, subtitle, items }) {
  return(<PageShell onBack={onBack}><Tag color="emerald">{tag}</Tag><h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 mb-2 tracking-tight">{title}</h1><p className="text-slate-400 text-sm mb-8">{subtitle}</p><div className="space-y-4">{items.map(([icon,t,desc,link])=><div key={t} className="bg-[#0d1220] border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all flex gap-4"><div className="text-2xl shrink-0">{icon}</div><div className="flex-1"><h3 className="font-bold text-sm mb-1 text-white">{t}</h3><p className="text-xs text-slate-400 leading-relaxed">{desc}</p>{link&&typeof link==="string"&&link&&<a href={link.startsWith("http")?link:`https://${link}`} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 mt-1.5 inline-block">{link.replace("https://","")} →</a>}{link&&typeof link==="number"&&<p className="text-sm font-bold text-blue-400 mt-1.5">📞 {link}</p>}</div></div>)}</div></PageShell>);
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ page, onHome, onStartQuiz, onNavigate, user, onAuthClick, onLogout }) {
  const [open, setOpen] = useState(false);
  const navClick = useCallback((id) => {
    setOpen(false);
    if (page !== "home") { onHome(); setTimeout(() => smoothScrollTo(id), 150); }
    else smoothScrollTo(id);
  }, [page, onHome]);

  return (
    <nav className="sticky top-0 z-50 bg-[#080b14]/90 backdrop-blur-xl border-b border-white/8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <button onClick={() => { setOpen(false); onHome(); window.scrollTo({top:0,behavior:"smooth"}); }}
          className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-base shrink-0">🎓</div>
          AcademicAI
        </button>
        <div className="hidden md:flex items-center gap-5">
          {[["how-it-works","How it Works"],["stats","Stats"],["reviews","Reviews"],["faq","FAQ"]].map(([id,l]) => (
            <button key={id} onClick={() => navClick(id)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">{l}</button>
          ))}
          <button onClick={() => { setOpen(false); onNavigate("models"); }} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">⚖️ Models</button>
          {user ? (
            <button onClick={() => { setOpen(false); onNavigate("dashboard"); }} className="text-sm font-medium text-violet-300 hover:text-violet-200 transition-colors">🧑‍🎓 Dashboard</button>
          ) : (
            <button onClick={() => { setOpen(false); onAuthClick(); }} className="text-sm font-medium text-violet-300 hover:text-violet-200 transition-colors">Log In</button>
          )}
          <button onClick={() => { setOpen(false); onNavigate("rateus"); }} className="text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors">★ Rate Us</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setOpen(false); onStartQuiz(); }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold hover:-translate-y-0.5 hover:shadow-lg transition-all whitespace-nowrap">
            Check My Score →
          </button>
          <button onClick={() => setOpen(o => !o)} className="md:hidden w-9 h-9 flex flex-col justify-center items-center gap-1.5">
            <span className={`block w-5 h-0.5 bg-slate-400 transition-all origin-center ${open?"rotate-45 translate-y-2":""}`}/>
            <span className={`block w-5 h-0.5 bg-slate-400 transition-all ${open?"opacity-0":""}`}/>
            <span className={`block w-5 h-0.5 bg-slate-400 transition-all origin-center ${open?"-rotate-45 -translate-y-2":""}`}/>
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-[#0d1220] border-t border-white/8 px-5 py-4 flex flex-col gap-3">
          {[["how-it-works","How it Works"],["stats","Stats"],["reviews","Reviews"],["faq","FAQ"]].map(([id,l]) => (
            <button key={id} onClick={() => navClick(id)} className="text-sm font-medium text-slate-300 hover:text-white text-left py-1 transition-colors">{l}</button>
          ))}
          <button onClick={() => { setOpen(false); onNavigate("models"); }} className="text-sm font-medium text-slate-300 text-left py-1">⚖️ Compare Models</button>
          {user ? (
            <button onClick={() => { setOpen(false); onNavigate("dashboard"); }} className="text-sm font-medium text-violet-300 text-left py-1">🧑‍🎓 Dashboard</button>
          ) : (
            <button onClick={() => { setOpen(false); onAuthClick(); }} className="text-sm font-medium text-violet-300 text-left py-1">Log In</button>
          )}
          <button onClick={() => { setOpen(false); onNavigate("rateus"); }} className="text-sm font-medium text-yellow-400 text-left py-1">★ Rate Us</button>
          {user && (
            <button onClick={() => { setOpen(false); onLogout(); }} className="text-sm font-medium text-red-400/80 text-left py-1">Log out ({user.name.split(" ")[0]})</button>
          )}
        </div>
      )}
    </nav>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer({ onNavigate, onStartQuiz, onScrollTo }) {
  const go = (p) => { onNavigate(p); window.scrollTo({top:0,behavior:"smooth"}); };
  return (
    <footer className="relative z-10 border-t border-white/8 bg-[#06080f]/90 pt-12 pb-8 mt-4">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg mb-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">🎓</div>AcademicAI
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">AI-powered student performance prediction. Know your standing, take action, succeed.</p>
          </div>
          <div><h4 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">Product</h4>
            {[["Start Prediction",()=>onStartQuiz()],["How It Works",()=>onScrollTo("how-it-works")],["Accuracy Stats",()=>onScrollTo("stats")],["FAQ",()=>onScrollTo("faq")],["★ Rate Us",()=>go("rateus"),"text-yellow-500 hover:text-yellow-400"]].map(([l,fn,cls=""]) => (
              <button key={l} onClick={fn} className={`block text-sm mb-2 transition-colors text-left w-full ${cls||"text-slate-500 hover:text-slate-300"}`}>{l}</button>
            ))}</div>
          <div><h4 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">Resources</h4>
            {[["Study Tips","studytips"],["Attendance Guide","attendance"],["Scholarship Info","scholarship"],["Counseling Help","counseling"]].map(([l,p]) => (
              <button key={l} onClick={() => go(p)} className="block text-sm text-slate-500 hover:text-slate-300 mb-2 transition-colors text-left w-full">{l}</button>
            ))}</div>
          <div><h4 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">Company</h4>
            {[["About Us","about"],["Privacy Policy","privacy"],["Terms of Use","terms"],["Contact","contact"]].map(([l,p]) => (
              <button key={l} onClick={() => go(p)} className="block text-sm text-slate-500 hover:text-slate-300 mb-2 transition-colors text-left w-full">{l}</button>
            ))}</div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/8">
          <span className="text-xs text-slate-500">
            © 2025 AcademicAI · Built by{" "}
            <a href="https://www.linkedin.com/in/mohammadumarfarook" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Mohammad Umar</a>
            {" "}(B.Tech CSE)
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {["⚡ Free Forever","🤖 AI Powered","🎓 Made for University Students"].map(b => (
              <span key={b} className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/8 text-slate-400">{b}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page,    setPage]    = useState("home");
  const [answers, setAnswers] = useState({});
  const [qIndex,  setQIndex]  = useState(0);
  const [result,  setResult]  = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [user,    setUser]    = useState(() => getUser());

  // Recompute question list whenever answers change (drives dynamic grade Qs)
  const questions = buildQuestions(answers);
  const current   = questions[qIndex];
  const isLast    = qIndex === questions.length - 1;
  const ans       = answers[current?.id];

  const canNext = current?.optional
    ? true
    : (current?.type === "number" ? (ans !== undefined && ans !== "") : !!ans);

  // Scroll to top on page change
  useEffect(() => { window.scrollTo({top:0,behavior:"smooth"}); }, [page]);

  function select(val) { setAnswers(p => ({...p, [current.id]: val})); }
  function goBack()    { if (qIndex > 0) setQIndex(i => i-1); }
  function goNext()    { if (!canNext) return; if (isLast) { submitPrediction(); return; } setQIndex(i => i+1); }

  // Enter key advances quiz (no hint shown, but still works)
  useEffect(() => {
    if (page !== "quiz") return;
    const fn = (e) => { if (e.key === "Enter") goNext(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [page, qIndex, canNext, answers]);

  async function submitPrediction() {
    setLoading(true); setError(null); setPage("quiz");
    try {
      const payload = buildPayload(answers);
      const headers = { "Content-Type": "application/json" };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST", headers, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Error ${res.status}`); }
      const data = await res.json();
      setResult(data);
      setAnalysis(analyzeStudent(answers));
      await saveResponse(payload, data);
      setPage("result");
    } catch(e) { setError(e.message); }
    finally    { setLoading(false); }
  }

  function startQuiz() { setPage("quiz"); setQIndex(0); setAnswers({}); setResult(null); setAnalysis(null); setError(null); }
  function goHome()    { setPage("home"); }
  function navigate(p){ setPage(p); }
  function handleScrollTo(id) {
    if (page !== "home") { setPage("home"); setTimeout(() => smoothScrollTo(id), 150); }
    else smoothScrollTo(id);
  }
  function handleAuth(token, u) {
    saveAuth(token, u);
    setUser(u);
    setPage("dashboard");
  }
  function handleLogout() {
    clearAuth();
    setUser(null);
    setPage("home");
  }
  function requireAuth() {
    if (user) setPage("dashboard");
    else setPage("auth");
  }

  const STATIC = ["about","privacy","terms","contact","studytips","attendance","scholarship","counseling","rateus"];

  return (
    <div className="min-h-screen bg-[#060810] text-slate-100" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        .font-display { font-family:'Syne',sans-serif; }
        button,a,[role="button"] { cursor:pointer!important; }
        @keyframes blink  { 0%,100%{opacity:1}50%{opacity:.3} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
        @keyframes popIn  { from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .animate-blink  { animation:blink 2s infinite; }
        .animate-fadeUp { animation:fadeUp .4s ease both; }
        .animate-popIn  { animation:popIn .45s cubic-bezier(.175,.885,.32,1.275) both; }
        .spinner        { animation:spin .75s linear infinite; }
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:99px;}
      `}</style>

      <div className="fixed inset-0 pointer-events-none z-0"
        style={{background:"radial-gradient(ellipse 60% 40% at 15% 0%,rgba(79,142,247,.09),transparent 60%),radial-gradient(ellipse 50% 35% at 85% 100%,rgba(139,92,246,.07),transparent 55%)"}}/>

      <Navbar page={page} onHome={goHome} onStartQuiz={startQuiz} onNavigate={navigate}
        user={user} onAuthClick={requireAuth} onLogout={handleLogout}/>

      {/* Auth */}
      {page === "auth" && <LazyPage><Auth onAuth={handleAuth} onBack={goHome}/></LazyPage>}

      {/* Feature pages */}
      {page === "models"   && <LazyPage><ModelCompare onBack={goHome}/></LazyPage>}
      {page === "schedule" && <LazyPage><StudySchedule onBack={goHome}/></LazyPage>}
      {page === "chatbot"  && <LazyPage><Chatbot onBack={goHome}/></LazyPage>}
      {page === "dashboard" && (
        user
          ? <LazyPage><Dashboard onStartQuiz={startQuiz} onPage={navigate} onBack={goHome}/></LazyPage>
          : <LazyPage><Auth onAuth={handleAuth} onBack={goHome}/></LazyPage>
      )}

      {/* Static pages */}
      {STATIC.includes(page) && (
        <div className="relative z-10">
          {page==="rateus"     && <RateUsPage onBack={goHome}/>}
          {page==="about"      && <AboutPage  onBack={goHome}/>}
          {page==="contact"    && <ContactPage onBack={goHome}/>}
          {page==="privacy"    && <LegalPage onBack={goHome} title="Privacy Policy" tag="Legal" sections={[
            ["What we collect","Your anonymised quiz responses — grades, attendance, and background. We do NOT collect your name, email, or any personal identifiers."],
            ["Why we collect it","To retrain and improve AcademicAI's ML model over time. More responses = better predictions for all students."],
            ["Storage","Responses are stored in a CSV file on our server. No identity information is ever included."],
            ["How it's used","Only for model retraining. We never sell, share, or use your data for advertising."],
            ["Third parties","We never share your data with any third party."],
            ["Contact","Questions about privacy? Reach us at umar24nov@gmail.com"],
          ]}/>}
          {page==="terms"      && <LegalPage onBack={goHome} title="Terms of Use" tag="Legal" sections={[
            ["Acceptance","By using AcademicAI you agree to these terms."],
            ["Nature of predictions","Results are AI estimates for informational purposes only — not professional academic advice."],
            ["Data consent","Submitting the quiz consents to your anonymised data being stored as per our Privacy Policy."],
            ["Accuracy","81% test accuracy — approximately 1 in 5 predictions may be incorrect. Use as a guide, not a verdict."],
            ["Free service","AcademicAI is free to use. No registration required."],
          ]}/>}
          {page==="studytips"  && <ResourcePage onBack={goHome} tag="Resources" title="Study Tips" subtitle="Evidence-based habits to help you pass and graduate." items={[["✅","Attend every class","Attendance is the #1 predictor of academic success. Showing up beats cramming every time."],["📅","Plan your semester in week 1","Map all deadlines and exam dates on day one. Students who plan ahead rarely fall behind."],["👥","Form a study group","Students in groups perform 15–20% better on average. Find 2–3 serious classmates."],["🎯","Focus on your weakest subject","Spend the most time where you're weakest, not on what you already know."],["🧠","Sleep before exams","7–8 hours beats any all-nighter. Memory consolidation happens during sleep."],["📵","Phone-free study blocks","30 focused minutes beats 2 hours of half-attention."],["🏃","Exercise 20 minutes daily","Physical activity directly improves focus and memory retention."],["🗣️","Talk to your teacher early","Don't wait until exams — ask for help early in the semester."]]}/>}
          {page==="attendance" && <ResourcePage onBack={goHome} tag="Resources" title="Attendance Guide" subtitle="Why it matters and how to recover." items={[["📊","The 75% Rule","Most colleges require 75% minimum attendance to sit for exams. Below this, you may be debarred."],["🤖","What our model found","Attendance is the most important predictor in our AI model — more than grades or family background."],["📱","Track daily","Check your attendance on your college portal daily."],["🤝","Communicate proactively","If you must miss class, message your teacher beforehand."],["🔄","Recovery formula","Required classes = (0.75 × Total − Attended) ÷ 0.25"],["🏥","Medical leave","Most colleges grant condonation for certified medical absence. Keep all documents."]]}/>}
          {page==="scholarship"&& <ResourcePage onBack={goHome} tag="Resources" title="Scholarship Info" subtitle="Major scholarships available to students." items={[["🏛️","NSP — National Scholarship Portal","India's largest scholarship platform covering pre-matric, post-matric, and merit-cum-means schemes.","scholarships.gov.in"],["🎓","AICTE Pragati Scholarship","For girl students in AICTE technical institutes. ₹50,000/year.","aicte-india.org"],["💡","Inspire Scholarship (DST)","For basic science students in top 1% of board exams. ₹80,000/year.","online-inspire.gov.in"],["🌿","PM Scholarship (Ex-Servicemen)","For children of ex-servicemen. ₹2,500–3,000/month.","ksb.gov.in"],["📚","Vidyasaarathi Portal","Industry scholarships from TCS, Infosys, HDFC and more.","vidyasaarathi.co.in"],["🏅","State Government Schemes","Every state has SC/ST/OBC/minority scholarships. Check your state social welfare portal.",""]]}/>}
          {page==="counseling" && <ResourcePage onBack={goHome} tag="Resources" title="Counseling Help" subtitle="You don't have to figure it out alone." items={[["🧠","iCall (TISS)","Free mental health helpline by Tata Institute of Social Sciences.",9152987821],["💬","Vandrevala Foundation","24x7 confidential helpline in English and Hindi.",18602662345],["🎓","Your College Counselor","All UGC colleges must have a student counseling cell.",""],["📞","iYouth","Youth helpline for career and academic guidance. Weekdays, free.",8800444888],["💡","What to talk about","Attendance issues, exam anxiety, fee problems, family pressure — all valid reasons to reach out.",""]]}/>}
          <Footer onNavigate={navigate} onStartQuiz={startQuiz} onScrollTo={handleScrollTo}/>
        </div>
      )}

      {/* Home page */}
      {page === "home" && (
        <LazyPage>
          <LandingPage onStartQuiz={startQuiz} onNavigate={navigate} onAuth={requireAuth} onScrollTo={handleScrollTo} />
          <Footer onNavigate={navigate} onStartQuiz={startQuiz} onScrollTo={handleScrollTo} />
        </LazyPage>
      )}

      {/* Quiz & Result */}
      {(page === "quiz" || page === "result") && (
        <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 py-8 pb-24 min-h-screen">
          <button onClick={goHome} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6">← Back to Home</button>

          {loading && (
            <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-12 text-center animate-fadeUp">
              <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-400 rounded-full spinner mx-auto mb-5"/>
              <p className="font-bold text-lg mb-2">Analysing your academic profile…</p>
              <p className="text-slate-400 text-sm">Our AI is crunching the numbers ✨</p>
            </div>
          )}

          {page === "result" && result && !loading && (
            <ResultCard result={result} analysis={analysis} onRetry={startQuiz} onHome={goHome} onRate={() => navigate("rateus")}/>
          )}

          {page === "quiz" && !loading && current && (
            <>
              <div className="mb-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400 font-medium">{current.section}</span>
                  <span className="text-blue-400 font-bold">{qIndex+1} / {questions.length}</span>
                </div>
                <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                    style={{width:`${Math.round((qIndex/questions.length)*100)}%`}}/>
                </div>
              </div>

              <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8 animate-fadeUp">
                <div className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-2">{current.icon} {current.section}</div>
                <p className="text-lg sm:text-xl font-bold leading-snug mb-1.5">{current.q}</p>
                {current.hint && <p className="text-sm text-slate-400 mb-5 leading-relaxed">{current.hint}</p>}
                {!current.hint && <div className="mb-5"/>}

                {current.type === "choice" && <ChoiceGrid options={current.options} cols={current.cols} value={ans} onSelect={select}/>}
                {current.type === "yesno"  && <YesNoInput value={ans} onSelect={select}/>}
                {current.type === "number" && <NumberInput value={ans} min={current.min} max={current.max} placeholder={current.placeholder} onChange={v => select(v)}/>}

                {error && <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-sm text-red-300">⚠️ {error}</div>}

                <div className="flex gap-3 mt-6">
                  {qIndex > 0 && (
                    <button onClick={goBack} className="px-5 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-bold hover:border-white/20 hover:text-white transition-all">← Back</button>
                  )}
                  <button onClick={goNext} disabled={!canNext}
                    className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all
                      ${isLast ? "bg-gradient-to-r from-emerald-500 to-violet-600" : "bg-gradient-to-r from-blue-500 to-violet-600"}
                      ${canNext ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-35 cursor-not-allowed"}`}>
                    {isLast ? "🔮 Predict My Performance" : "Continue →"}
                  </button>
                </div>

                {current.optional && (
                  <div className="text-center mt-3">
                    <button onClick={() => setQIndex(i => i+1)} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">
                      Skip this →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
