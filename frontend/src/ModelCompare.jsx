import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { apiFetch } from "./api";

function Tag({ color = "blue", children }) {
  const c = {
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
    violet:  "text-violet-400 bg-violet-500/10 border-violet-500/25",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  };
  return <span className={`inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border ${c[color]}`}>{children}</span>;
}

const MODEL_EMOJI = { "Random Forest":"🌲", "Logistic Regression":"📈", "K-Nearest Neighbors":"📍", "Gradient Boosting":"🚀", "Neural Network":"🧠" };

function card(title, children, extra = "") {
  return (
    <div className={`bg-[#0d1220] border border-white/8 rounded-3xl p-6 sm:p-8 ${extra}`}>
      <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">{title}</p>
      {children}
    </div>
  );
}

export default function ModelCompare({ onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/models");
        setData(res.models || []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const chartData = (data || []).map(m => ({
    name: m.name.replace("Regression", "").replace("Neighbors", "Neigh.").replace("Boosting", "Boost").replace("Neural Network", "Neural"),
    fullName: m.name,
    "Test Accuracy": m.accuracy ? +(m.accuracy * 100).toFixed(1) : null,
    "CV Accuracy": m.cv_accuracy ? +(m.cv_accuracy * 100).toFixed(1) : null,
    isPrimary: m.is_primary,
  }));

  return (
    <div className="relative z-10 min-h-[calc(100vh-64px)] max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">← Back to Home</button>

      <Tag color="violet">Model Dashboard</Tag>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 mb-3 tracking-tight">Model Comparison</h1>
      <p className="text-slate-400 text-sm mb-8">We trained 5 ML algorithms on the same 395 students. Random Forest won, so it powers your predictions.</p>

      {loading && <div className="bg-[#0d1220] border border-white/8 rounded-3xl p-12 text-center text-slate-400 text-sm">Loading model data…</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-8 text-center text-red-300 text-sm">⚠️ {error}</div>}

      {data && (
        <div className="space-y-6">
          {card("Accuracy Comparison", (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={38}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "#0d1220", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }}
                    labelStyle={{ color: "#fff" }} cursor={{ fill: "rgba(255,255,255,.03)" }}
                  />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                  <Bar name="Test Accuracy" dataKey="Test Accuracy" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar name="CV Accuracy" dataKey="CV Accuracy" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}

          {card("Model Leaderboard", (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-white/8">
                    <th className="pb-3 pr-4">Rank</th>
                    <th className="pb-3 pr-4">Algorithm</th>
                    <th className="pb-3 pr-4">Test Accuracy</th>
                    <th className="pb-3 pr-4">CV Accuracy</th>
                    <th className="pb-3 pr-4">F1 Score</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0)).map((m, i) => (
                    <tr key={m.slug} className="border-b border-white/5 last:border-0">
                      <td className="py-3.5 pr-4 text-slate-500 font-bold">#{i + 1}</td>
                      <td className="py-3.5 pr-4 font-bold text-white">{MODEL_EMOJI[m.name] || "🤖"} {m.name}</td>
                      <td className="py-3.5 pr-4 text-slate-300">{m.accuracy ? `${(m.accuracy * 100).toFixed(1)}%` : "—"}</td>
                      <td className="py-3.5 pr-4 text-slate-300">{m.cv_accuracy ? `${(m.cv_accuracy * 100).toFixed(1)}%` : "—"}</td>
                      <td className="py-3.5 pr-4 text-slate-300">{m.f1 ? m.f1.toFixed(3) : "—"}</td>
                      <td className="py-3.5">
                        {m.is_primary
                          ? <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">★ Primary</span>
                          : <span className="text-slate-600 text-xs">Secondary</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {card("Why this matters", (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ["🎯", "Best of 5", "We pick the model with the highest accuracy for your predictions, so you get the most reliable result."],
                ["📊", "Honest numbers", "Every model is validated on unseen data — the Test Accuracy reflects real-world performance, not training."],
                ["🔬", "Compare opinions", "If models disagree, we show you the confidence breakdown so you can judge how certain the AI is."],
              ].map(([e, t, d]) => (
                <div key={t} className="bg-white/4 border border-white/8 rounded-2xl p-4">
                  <div className="text-2xl mb-2">{e}</div>
                  <div className="text-sm font-bold mb-1">{t}</div>
                  <div className="text-xs text-slate-400 leading-relaxed">{d}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}