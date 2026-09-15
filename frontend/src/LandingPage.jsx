import { useState, useEffect, useRef } from "react";
import API_URL, { getToken } from "./api";
import { buildPayload } from "./utils/payload";

/* ─── Shared atoms ─────────────────────────────────────────────────────────── */

const COLORS = {
  blue:   "text-blue-400",
  violet: "text-violet-400",
  emerald:"text-emerald-400",
  yellow: "text-yellow-400",
};
const STAT_GRADIENTS = {
  blue:   "from-blue-400 to-violet-400",
  violet: "from-violet-400 to-blue-400",
  emerald:"from-emerald-400 to-blue-400",
};
const TOOLKIT_STYLES = {
  blue:   { grad: "from-blue-500/5",    txt: "text-blue-400" },
  violet: { grad: "from-violet-500/5",  txt: "text-violet-400" },
  emerald:{ grad: "from-emerald-500/5", txt: "text-emerald-400" },
};
function Tag({ color = "blue", children }) {
  const c = {
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
    violet:  "text-violet-400 bg-violet-500/10 border-violet-500/25",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    yellow:  "text-yellow-400 bg-yellow-500/10 border-yellow-500/25",
  };
  return <span className={`inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border ${c[color]}`}>{children}</span>;
}

function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}>
      {children}
    </div>
  );
}

function Counter({ target, suffix = "", duration = 1400 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min((now - t0) / duration, 1);
          setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick); obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(ref.current); return () => obs.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ─── Quick Predict (3-question teaser) ────────────────────────────────────── */

const Q_STEPS = [
  { id: "attendance", icon: "🏫", q: "What's your attendance like?", opts: [
    { v:"above90",l:"Above 90%"},{"v":"75-90",l:"75 – 90%"},{"v":"60-75",l:"60 – 75%"},{"v":"below60",l:"Below 60%"} ]},
  { id: "studytime", icon: "📖", q: "Weekly study outside class?", opts: [
    { v:"1",l:"< 2 hrs"},{"v":"2",l:"2 – 5 hrs"},{"v":"3",l:"5 – 10 hrs"},{"v":"4",l:"10+ hrs"} ]},
  { id: "health", icon: "💪", q: "How's your health these days?", opts: [
    { v:"1",l:"Poor"},{"v":"2",l:"Below avg"},{"v":"3",l:"Average"},{"v":"4",l:"Good"},{"v":"5",l:"Great"} ]},
];

function QuickPredict({ onFullQuiz }) {
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cur = Q_STEPS[step];
  const barC = { Pass:"#34d399", Fail:"#fb923c", "At-Risk":"#f87171" };

  function pick(v) {
    const next = { ...ans, [cur.id]: v };
    setAns(next);
    if (step < Q_STEPS.length - 1) setStep(step + 1);
    else run(next);
  }
  async function run(a) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(buildPayload(a)),
      });
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).detail||"Failed");
      setResult(await res.json());
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }
  function reset() { setStep(0); setAns({}); setResult(null); setError(null); }

  return (
    <Reveal className="max-w-2xl mx-auto">
      <div className="relative group">
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-emerald-500/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
        <div className="relative bg-[#0d1220] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {!result && !loading && (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold tracking-widest uppercase text-violet-400">⚡ Quick Predict</p>
                {step > 0 && <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-300">Reset</button>}
              </div>
              <p className="text-xs text-slate-500 mb-5">3 questions · 20 seconds</p>
              <div className="h-1 bg-white/6 rounded-full overflow-hidden mb-6">
                <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500" style={{width:`${((step+1)/Q_STEPS.length)*100}%`}}/>
              </div>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">{cur.icon}</span>
                <p className="font-bold text-base">{cur.q}</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {cur.opts.map(o => (
                  <button key={o.v} onClick={() => pick(o.v)}
                    className="py-3.5 px-4 rounded-xl border border-white/10 bg-white/3 text-sm font-semibold text-slate-300 hover:border-violet-500/40 hover:text-white hover:bg-violet-500/10 transition-all duration-150">
                    {o.l}
                  </button>
                ))}
              </div>
            </>
          )}
          {loading && (
            <div className="py-14 text-center">
              <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-400 rounded-full spinner mx-auto mb-4"/>
              <p className="text-slate-400 text-sm">Analysing your profile… ✨</p>
            </div>
          )}
          {result && !loading && (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-bold tracking-widest uppercase text-emerald-500">Your Quick Result</p>
                <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-300">Re-take →</button>
              </div>
              <div className="flex items-center gap-5 mb-6">
                <span className="text-5xl">{result.emoji}</span>
                <div>
                  <p className="font-display text-4xl font-extrabold" style={{color: barC[result.prediction]}}>{result.prediction}</p>
                  <p className="text-xs text-slate-400 mt-1">AI confidence: <strong className="text-slate-200">{result.confidence}%</strong></p>
                </div>
              </div>
              <div className="space-y-2.5 mb-6">
                {Object.entries(result.confidence_scores||{}).map(([l,p]) => (
                  <div key={l} className="flex items-center gap-3">
                    <span className="text-xs font-semibold w-16 shrink-0">{l}</span>
                    <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${p}%`, background: barC[l]}}/>
                    </div>
                    <span className="text-xs text-slate-400 w-8 text-right">{p}%</span>
                  </div>
                ))}
              </div>
              {error && <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300">⚠️ {error}</div>}
              <button onClick={onFullQuiz}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold hover:-translate-y-0.5 hover:shadow-lg transition-all">
                Get my full personalised plan →
              </button>
            </>
          )}
        </div>
      </div>
    </Reveal>
  );
}

/* ─── Landing Page ─────────────────────────────────────────────────────────── */

export default function LandingPage({ onStartQuiz, onNavigate, onAuth }) {
  const [apiStats, setApiStats] = useState(null);
  const [faqOpen, setFaqOpen] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/stats`).then(r=>r.json()).then(setApiStats).catch(()=>{});
  }, []);

  const faqs = [
    ["Is this free?", "Yes, 100% free. No sign-up required. Predictions work instantly."],
    ["How accurate is it?", "81% test accuracy on real student data — approximately 1 in 5 predictions may be incorrect."],
    ["What does At-Risk mean?", "Students critically at risk of failing or withdrawing — the most urgent category."],
    ["How do grade questions work?", "They adapt by semester. 1st-year students get 12th/Inter board questions instead."],
    ["Do I need to create an account?", "No — predictions are instant. Accounts let you save and compare results over time."],
    ["Can I retake the quiz?", "Yes — click Retry on the result page, or start fresh from the home page."],
  ];

  return (
    <div className="relative z-10">
      <style>{`
        @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        .hero-glow { background: linear-gradient(-45deg, rgba(59,130,246,.12), rgba(139,92,246,.08), rgba(16,185,129,.06), rgba(59,130,246,.10)); background-size:400% 400%; animation: gradientShift 8s ease infinite; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .float-chip { animation: float 4s ease-in-out infinite; }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.5);opacity:0} }
        .pulse-dot { position:relative; }
        .pulse-dot::after { content:''; position:absolute; inset:-4px; border-radius:50%; background:rgba(52,211,153,.3); animation:pulse-ring 2s ease-out infinite; }
      `}</style>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden pt-16 sm:pt-24 pb-20 sm:pb-28">
        <div className="absolute inset-0 hero-glow opacity-60 pointer-events-none"/>
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"/>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 rounded-full bg-blue-400 pulse-dot"/>
                <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">AI-Powered · Free · Instant</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight mb-5">
                Will You<br/>
                <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent bg-[length:200%_200%] animate-[gradientShift_4s_ease_infinite]">
                  Pass This Year?
                </span>
              </h1>
              <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
                Answer a few honest questions about your grades, attendance, and habits.
                Our AI tells you if you're on track to <strong className="text-white">Pass</strong>, at risk of <strong className="text-orange-400">Failing</strong>, or need urgent help — with a personalised action plan.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <button onClick={onStartQuiz}
                  className="group relative px-7 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 font-bold text-base hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/30 transition-all overflow-hidden">
                  <span className="relative z-10">🔮 Predict My Performance</span>
                </button>
                <button onClick={onAuth}
                  className="px-7 py-4 rounded-2xl border border-white/15 font-bold text-base text-slate-300 hover:border-white/30 hover:text-white transition-all">
                  Log In / Sign Up
                </button>
              </div>
              <div className="flex items-center gap-6 flex-wrap text-xs text-slate-500">
                {[
                  { n:395, s:"+", l:"Students" },
                  { n:81,  s:"%", l:"Accuracy" },
                  { n:5,   s:"",  l:"ML Models" },
                ].map(({n,s,l}) => (
                  <div key={l} className="flex items-baseline gap-1">
                    <span className="text-lg font-extrabold text-white"><Counter target={n} suffix={s}/></span>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Right: Sample prediction card */}
          <Reveal delay={200} className="hidden lg:block">
            <div className="relative">
              <div className="absolute -top-5 right-4 float-chip bg-[#0d1220] border border-emerald-500/30 rounded-xl px-4 py-2 text-sm font-semibold text-emerald-400 shadow-xl shadow-emerald-500/10 z-10">
                🎓 Pass · 88% confidence
              </div>
              <div className="relative bg-[#0d1220] border border-white/12 rounded-3xl p-7 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <span className="font-bold text-sm">Performance Report</span>
                  <span className="text-xs font-bold bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot"/>
                    Live
                  </span>
                </div>
                {[
                  ["Pass","#34d399",88],
                  ["Fail","#fb923c",9],
                  ["At-Risk","#f87171",3],
                ].map(([l,c,p]) => (
                  <div key={l} className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-slate-400 w-14 shrink-0">{l}</span>
                    <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${p}%`, background:c}}/>
                    </div>
                    <span className="text-xs font-bold text-slate-400 w-8 text-right">{p}%</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/8 text-xs">
                  <span className="text-emerald-400 font-bold">🎓 Predicted: Pass</span>
                  <span className="text-slate-500">RF · 81% acc</span>
                </div>
              </div>
              <div className="absolute -bottom-4 left-4 float-chip bg-[#0d1220] border border-blue-500/30 rounded-xl px-4 py-2 text-sm font-semibold text-blue-400 shadow-xl" style={{animationDelay:"1s"}}>
                ⚡ Powered by Machine Learning
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ MARQUEE STRIP ═══ */}
      <div className="border-y border-white/6 bg-white/[0.02] py-4 overflow-hidden">
        <div className="flex gap-10 animate-[scroll_30s_linear_infinite] whitespace-nowrap text-xs font-bold tracking-widest uppercase text-slate-500">
          {Array.from({length:2}).map((_,i) => (
            <div key={i} className="flex gap-10 px-5">
              {["🤖 AI Powered","🎓 Free Forever","📊 81% Accuracy","⚡ Instant Results","🔒 Privacy First","🏫 Made for Students","🌍 395+ Students Trained"].map(s => (
                <span key={s}>{s}</span>
              ))}
            </div>
          ))}
        </div>
        <style>{`@keyframes scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }`}</style>
      </div>

      {/* ═══ QUICK PREDICT ═══ */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-10">
            <Tag color="emerald">Try it Now</Tag>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight">Get Your Answer in 20 Seconds</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">No sign-up needed. 3 quick questions → instant AI prediction.</p>
          </Reveal>
          <QuickPredict onFullQuiz={onStartQuiz}/>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-20 border-t border-white/6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-16">
            <Tag color="violet">How It Works</Tag>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight">Three Steps. One Minute.</h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-blue-500/40 via-violet-500/40 to-emerald-500/40"/>
            {[
              ["1","Answer","Tell us about your grades, attendance, and study habits — 13 quick questions.", "📝","blue","from-blue-500 to-blue-600"],
              ["2","AI Analyses","Our Random Forest model, trained on 395 students, processes your answers instantly.", "🧠","violet","from-violet-500 to-violet-600"],
              ["3","Get Your Plan","See your prediction with confidence scores, risk factors, and a personalised action plan.", "🎯","emerald","from-emerald-500 to-emerald-600"],
            ].map(([n,t,d,e,clr,grad]) => (
              <Reveal key={n} delay={Number(n)*120}>
                <div className="relative bg-[#0d1220] border border-white/8 rounded-3xl p-7 text-center hover:border-white/15 hover:-translate-y-1 transition-all duration-300">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-2xl mx-auto mb-5 shadow-lg`}>{e}</div>
                  <div className={`absolute top-5 right-5 ${COLORS[clr]} text-xs font-extrabold opacity-40`}>0{n}</div>
                  <h3 className="font-bold text-base mb-2">{t}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TOOLKIT ═══ */}
      <section className="py-20 border-t border-white/6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <Tag color="emerald">Student Toolkit</Tag>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight">More Than a Prediction</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">Tools to help you understand, plan, and improve — not just guess.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["🔐","Track Progress","Save every prediction, build history, and see how you improve over time.", onAuth, "blue"],
              ["⚖️","Compare 5 Models","See how Random Forest stacks up against other algorithms — real numbers, no hype.", () => onNavigate("models"), "violet"],
              ["📅","Study Scheduler","Feed it your subjects and hours. Get a balanced plan that targets your weak spots.", () => onNavigate("schedule"), "emerald"],
              ["🤖","Academic Assistant","Instant answers on attendance, scholarships, backlogs, and exam prep.", () => onNavigate("chatbot"), "blue"],
            ].map(([e,t,d,fn,clr],i) => (
              <Reveal key={t} delay={i*80}>
                <button onClick={fn}
                  className={`group relative bg-[#0d1220] border border-white/8 rounded-3xl p-6 text-left hover:-translate-y-1 hover:shadow-xl transition-all duration-300 overflow-hidden h-full`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${TOOLKIT_STYLES[clr].grad} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}/>
                  <div className="relative">
                    <div className="text-3xl mb-4">{e}</div>
                    <h3 className="font-bold text-sm mb-2">{t}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{d}</p>
                    <span className={`text-xs font-bold ${TOOLKIT_STYLES[clr].txt} group-hover:translate-x-1 transition-transform inline-block`}>Open →</span>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS BAND ═══ */}
      <section className="py-20 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-emerald-500/5 border-y border-white/6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { n:395, s:"+", l:"Students in dataset", c:"blue" },
            { n:81,  s:"%", l:"Test accuracy",      c:"violet" },
            { n:5,   s:"",  l:"ML models trained",   c:"emerald" },
            { n:3,   s:"",  l:"Outcome classes",     c:"blue" },
          ].map(({n,s,l,c}) => (
            <Reveal key={l}>
              <div className={`font-display text-3xl sm:text-4xl font-extrabold bg-gradient-to-r ${STAT_GRADIENTS[c]} bg-clip-text text-transparent mb-1`}>
                <Counter target={n} suffix={s}/>
              </div>
              <div className="text-xs text-slate-400">{l}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <Tag color="blue">Student Reviews</Tag>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight">What Students Say</h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { t:"Predicted At-Risk — I had skipped too many classes. Wake-up call I needed.", n:"Arjun K.", r:"B.Tech 2nd Year", e:"👦", grad:"from-blue-900/50" },
              { t:"Predicted Pass with 88% confidence. Questions felt accurate. Really well designed.", n:"Sneha P.", r:"BSc 3rd Year", e:"👧", grad:"from-violet-900/50" },
              { t:"Free ML tool that actually works. Showed me attendance matters more than I thought.", n:"Priya S.", r:"MBA 1st Year", e:"👧", grad:"from-emerald-900/40" },
              { t:"The Pass/Fail/At-Risk breakdown with percentages was clear and actionable.", n:"Rahul M.", r:"BBA 2nd Year", e:"👦", grad:"from-blue-900/40" },
              { t:"Free and genuinely useful. Impressive that a student built this.", n:"Vikram R.", r:"B.Com Final Year", e:"👦", grad:"from-violet-900/40" },
              { t:"Asked the right questions — study time, attendance, parent education. Felt relevant.", n:"Meera T.", r:"BCA 2nd Year", e:"👧", grad:"from-emerald-900/40" },
            ].map((r,i) => (
              <Reveal key={i} delay={i*60}>
                <div className={`bg-gradient-to-b ${r.grad} to-[#0d1220] border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-all duration-300`}>
                  <div className="text-yellow-400 text-sm mb-3">★★★★★</div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-4">"{r.t}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-white/6">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-base shrink-0">{r.e}</div>
                    <div>
                      <div className="text-sm font-bold">{r.n}</div>
                      <div className="text-xs text-slate-500">{r.r}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ COMPARISON TABLE ═══ */}
      <section className="py-20 border-t border-white/6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <Tag color="yellow">Why AcademicAI</Tag>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight">Compare. Realize. Act.</h2>
          </Reveal>
          <Reveal>
            <div className="bg-[#0d1220] border border-white/8 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="bg-white/4 text-left text-xs font-bold uppercase tracking-widest border-b border-white/8">
                      <th className="py-4 px-5 text-slate-400">Feature</th>
                      <th className="py-4 px-5 text-emerald-400"><span className="bg-emerald-500/15 px-3 py-1 rounded-full">AcademicAI</span></th>
                      <th className="py-4 px-5 text-slate-500">Wing it</th>
                      <th className="py-4 px-5 text-slate-500">Ask a friend</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {[
                      ["Know your risk early","✅","❌","🤷"],
                      ["Confidence percentages","✅","❌","❌"],
                      ["Personalised action plan","✅","❌","Sometimes"],
                      ["Track your progress","✅","❌","❌"],
                      ["Trained on real data","✅ 395 students","❌","Bias"],
                      ["Free & private","✅","—","Awkward"],
                    ].map(([f,a,b,c],i) => (
                      <tr key={f} className={i>0?"border-t border-white/5":""}>
                        <td className="py-3.5 px-5 font-semibold">{f}</td>
                        <td className="py-3.5 px-5 text-emerald-400">{a}</td>
                        <td className="py-3.5 px-5 text-slate-600">{b}</td>
                        <td className="py-3.5 px-5 text-slate-500">{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-20 border-t border-white/6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <Tag color="emerald">FAQ</Tag>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight">Common Questions</h2>
          </Reveal>
          <div className="space-y-2.5">
            {faqs.map(([q,a],i) => (
              <Reveal key={i} delay={i*40}>
                <div className={`bg-[#0d1220] border rounded-2xl overflow-hidden transition-all duration-300 ${faqOpen===i ? "border-blue-500/30 shadow-lg shadow-blue-500/5" : "border-white/8 hover:border-white/15"}`}>
                  <button onClick={() => setFaqOpen(faqOpen===i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left">
                    <span className="font-bold text-sm pr-4">{q}</span>
                    <span className={`text-slate-400 text-lg shrink-0 transition-transform duration-300 ${faqOpen===i?"rotate-45":""}`}>+</span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${faqOpen===i?"max-h-40":"max-h-0"}`}>
                    <p className="text-sm text-slate-400 leading-relaxed px-5 pb-5 pt-0">{a}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="relative bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-emerald-500/10 border border-blue-500/20 rounded-3xl p-12 sm:p-16 text-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none"/>
              <div className="relative">
                <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
                  Ready to Know<br/>Where You Stand?
                </h2>
                <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto mb-10">
                  Free, takes a few minutes, and might change how you approach your studies.
                </p>
                <button onClick={onStartQuiz}
                  className="group px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 font-bold text-lg hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/30 transition-all relative overflow-hidden">
                  <span className="relative z-10">🔮 Start My Prediction</span>
                </button>
                <div className="flex justify-center gap-6 mt-8 text-xs text-slate-500">
                  <span>✓ Free forever</span>
                  <span>✓ No sign-up required</span>
                  <span>✓ Instant results</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}