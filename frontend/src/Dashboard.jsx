import { useState, useEffect } from "react";
import { apiFetch, getUser } from "./api";

function Tag({ color = "blue", children }) {
  const c = {
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
    violet:  "text-violet-400 bg-violet-500/10 border-violet-500/25",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    yellow:  "text-yellow-400 bg-yellow-500/10 border-yellow-500/25",
  };
  return <span className={`inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border ${c[color]}`}>{children}</span>;
}

const PRED_STYLE = {
  Pass:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  Fail:    "text-orange-400 bg-orange-500/10 border-orange-500/25",
  "At-Risk": "text-red-400 bg-red-500/10 border-red-500/25",
};
const PRED_EMOJI = { Pass: "🎓", Fail: "📉", "At-Risk": "⚠️" };

export default function Dashboard({ onStartQuiz, onPage, onBack }) {
  const user = getUser() || { name: "Student" };
  const [history, setHistory] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [h, s, m] = await Promise.all([
          apiFetch("/history", { auth: true }).catch(() => null),
          apiFetch("/stats").catch(() => null),
          apiFetch("/models").catch(() => null),
        ]);
        setHistory(h ? h.history : []);
        setStats({ anon: s, models: m });
      } catch (e) { setError(e.message); }
    })();
  }, []);

  const primaryModel = stats?.models?.primary_model || "Random Forest";

  return (
    <div className="relative z-10 min-h-[calc(100vh-64px)] max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">← Back to Home</button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <Tag color="blue">My Dashboard</Tag>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight">Welcome back, {user.name.split(" ")[0]} 👋</h1>
          <p className="text-slate-400 text-sm mt-2">Track your academic health, review past predictions, and take action.</p>
        </div>
        <button onClick={onStartQuiz} className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold hover:-translate-y-0.5 hover:shadow-lg transition-all whitespace-nowrap">
          🔮 New Prediction
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ["🎯", "Primary Model", primaryModel],
          ["📊", "Model Accuracy", stats?.models ? (() => { const m = stats.models.models?.find(x => x.is_primary); return m?.accuracy ? `${(m.accuracy * 100).toFixed(1)}%` : "81.0%"; })() : "—"],
          ["🧾", "My Predictions", Array.isArray(history) ? history.length : "—"],
          ["🌍", "Anonymous Users", stats?.anon?.total_responses ?? "—"],
        ].map(([e, l, v]) => (
          <div key={l} className="bg-[#0d1220] border border-white/8 rounded-2xl p-4">
            <div className="text-xl mb-1.5">{e}</div>
            <div className="text-xs text-slate-500 mb-0.5">{l}</div>
            <div className="font-extrabold text-sm truncate">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <button onClick={() => onPage("models")} className="group bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-3xl p-6 text-left hover:border-violet-500/40 transition-all">
          <div className="text-3xl mb-3">⚖️</div>
          <div className="font-bold text-sm mb-1">Compare 5 Models</div>
          <div className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">See how Random Forest stacks up against the other algorithms →</div>
        </button>
        <button onClick={() => onPage("schedule")} className="group bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-3xl p-6 text-left hover:border-emerald-500/40 transition-all">
          <div className="text-3xl mb-3">📅</div>
          <div className="font-bold text-sm mb-1">Study Schedule</div>
          <div className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">Generate a balanced weekly study plan →</div>
        </button>
        <button onClick={() => onPage("chatbot")} className="group bg-gradient-to-br from-blue-500/10 to-emerald-500/10 border border-blue-500/20 rounded-3xl p-6 text-left hover:border-blue-500/40 transition-all">
          <div className="text-3xl mb-3">🤖</div>
          <div className="font-bold text-sm mb-1">Ask the Assistant</div>
          <div className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">Attendance, scholarships, backlogs — get answers →</div>
        </button>
      </div>

      <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-bold tracking-widest uppercase text-blue-400">Prediction History</p>
          {Array.isArray(history) && history.length > 0 && <span className="text-xs text-slate-500">{history.length} saved</span>}
        </div>

        {!history && <p className="text-sm text-slate-500">Loading your history…</p>}
        {Array.isArray(history) && history.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🗂️</div>
            <p className="font-bold text-sm mb-1">No predictions yet</p>
            <p className="text-xs text-slate-400 mb-4">Take the quiz and your results will be saved here automatically.</p>
            <button onClick={onStartQuiz} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-xs font-bold transition-all hover:-translate-y-0.5">🔮 Take the Quiz</button>
          </div>
        )}

        {Array.isArray(history) && history.length > 0 && (
          <div className="space-y-3">
            {history.slice(0, 10).map(p => {
              const scores = p.confidence_scores || {};
              const entries = Object.keys(scores).length ? Object.entries(scores) : null;
              return (
                <div key={p.id} className="bg-white/3 border border-white/6 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${PRED_STYLE[p.prediction] || "text-slate-400 border-white/10"}`}>
                      {PRED_EMOJI[p.prediction] || ""} {p.prediction}
                      <span className="ml-1.5 opacity-80">· {p.confidence ? `${p.confidence}%` : ""}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-slate-400">{p.model}</span>
                      <span className="text-[11px] text-slate-500">{p.created_at}</span>
                    </div>
                  </div>
                  {entries && (
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map(([k, v]) => (
                        <span key={k} className="text-[11px] px-2 py-0.5 rounded-md bg-white/4 border border-white/8 text-slate-300">{k}: <strong>{v}%</strong></span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}