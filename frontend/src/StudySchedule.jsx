import { useState } from "react";

function Tag({ color = "blue", children }) {
  const c = {
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
    violet:  "text-violet-400 bg-violet-500/10 border-violet-500/25",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  };
  return <span className={`inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border ${c[color]}`}>{children}</span>;
}

const DEFAULT_SUBJECTS = ["Mathematics", "Programming", "DBMS", "Data Structures"];

const SLOTS_PER_DAY = 4;   // morning, afternoon, evening, night
const HOURS_PER_SLOT = 1.5;

function slotLabel(i) {
  return [["🌅", "Morning", "8:00 – 9:30 AM"], ["☀️", "Afternoon", "2:00 – 3:30 PM"], ["🌇", "Evening", "6:00 – 7:30 PM"], ["🌙", "Night", "9:00 – 10:30 PM"]][i];
}

function buildSchedule(subjects, hoursPerDay, focusSubjects) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const slots = Math.max(1, Math.min(SLOTS_PER_DAY, Math.round(hoursPerDay / HOURS_PER_SLOT)));

  const ordered = [...subjects].sort((a, b) => {
    const fa = focusSubjects.includes(a) ? -1 : 0;
    const fb = focusSubjects.includes(b) ? -1 : 0;
    return fa - fb;
  });

  const schedule = {};
  let subjIdx = 0;
  for (const day of days) {
    const daySlots = [];
    for (let s = 0; s < slots; s++) {
      daySlots.push(ordered[subjIdx % ordered.length]);
      subjIdx++;
    }
    schedule[day] = daySlots;
  }
  return { schedule, slots, totalHours: slots * 7 * HOURS_PER_SLOT };
}

export default function StudySchedule({ onBack }) {
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [newSubject, setNewSubject] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [focusSubjects, setFocusSubjects] = useState(["Mathematics"]);
  const [generated, setGenerated] = useState(null);

  function addSubject() {
    const s = newSubject.trim();
    if (!s || subjects.includes(s)) return;
    setSubjects([...subjects, s]);
    setNewSubject("");
  }

  function generate() {
    if (subjects.length === 0) return;
    setGenerated(buildSchedule(subjects, hoursPerDay, focusSubjects));
  }

  function toggleFocus(s) {
    setFocusSubjects(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  }

  return (
    <div className="relative z-10 min-h-[calc(100vh-64px)] max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">← Back to Home</button>

      <Tag color="emerald">Smart Planner</Tag>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 mb-3 tracking-tight">Weekly Study Schedule</h1>
      <p className="text-slate-400 text-sm mb-8">Tell us your subjects and available time. We'll build a balanced weekly plan that gives extra hours to your weakest subjects.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8 space-y-5">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-3">Your Subjects</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {subjects.map(s => (
                <button key={s} onClick={() => setSubjects(p => p.filter(x => x !== s))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-xs font-bold text-blue-300 hover:border-red-500/40 hover:text-red-300 transition-all">
                  {s} ✕
                </button>
              ))}
              {subjects.length === 0 && <span className="text-xs text-slate-600">Add at least one subject.</span>}
            </div>
            <div className="flex gap-2">
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addSubject(); }}
                placeholder="Add a subject (e.g. Operating Systems)"
                className="flex-1 bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors" />
              <button onClick={addSubject} className="px-4 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:border-blue-500/40 transition-all">+</button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-2">Study hours per day</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setHoursPerDay(h => Math.max(1, h - 1))} className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 text-lg font-bold hover:border-blue-500/40 transition-all">−</button>
              <div className="flex-1 text-center bg-white/4 border border-white/10 rounded-xl py-3">
                <span className="text-xl font-extrabold">{hoursPerDay}</span><span className="text-slate-400 text-xs ml-1">hrs/day</span>
              </div>
              <button onClick={() => setHoursPerDay(h => Math.min(7, h + 1))} className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 text-lg font-bold hover:border-blue-500/40 transition-all">+</button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400 mb-2">Focus subjects (get extra priority)</p>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <button key={s} onClick={() => toggleFocus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${focusSubjects.includes(s) ? "bg-violet-500/15 border-violet-500/40 text-violet-300" : "border-white/10 text-slate-400 hover:border-white/25"}`}>
                  {focusSubjects.includes(s) ? "★ " : ""}{s}
                </button>
              ))}
            </div>
          </div>

          <button onClick={generate} disabled={subjects.length === 0}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-40">
            Generate My Schedule →
          </button>
        </div>

        {generated ? (
          <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-bold tracking-widest uppercase text-emerald-400">Your Weekly Plan</p>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">{generated.totalHours} hrs / week</span>
            </div>
            <div className="space-y-2.5">
              {Object.entries(generated.schedule).map(([day, subs]) => (
                <div key={day} className="flex items-center gap-3 bg-white/3 border border-white/6 rounded-xl px-3.5 py-2.5">
                  <span className="text-xs font-bold text-slate-300 w-20 shrink-0">{day}</span>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {subs.map((s, i) => (
                      <span key={i} className={`inline-block text-[11px] font-semibold px-2 py-1 rounded-lg border ${
                        focusSubjects.includes(s)
                          ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                          : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                      }`}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 w-24 text-right shrink-0">{slotLabel(0)[0]} {slotLabel(0)[2].split(" – ")[0]}-{slotLabel(generated.slots - 1)[2].split(" – ")[1]}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 bg-white/3 border border-white/6 rounded-2xl p-4 text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">Pro tip:</strong> Rotate the time slots weekly so every subject gets some early-morning and late-night coverage. Schedule revisions the day after a subject is taught — that's when your brain consolidates best.
            </div>
          </div>
        ) : (
          <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[280px]">
            <div className="text-5xl mb-4">📅</div>
            <p className="font-bold text-sm mb-1">No schedule yet</p>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">Set your subjects and hours, then hit "Generate My Schedule".</p>
          </div>
        )}
      </div>
    </div>
  );
}