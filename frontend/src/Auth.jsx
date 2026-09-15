import { useState } from "react";
import { apiFetch } from "./api";

function Tag({ color = "blue", children }) {
  const c = {
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
    violet:  "text-violet-400 bg-violet-500/10 border-violet-500/25",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  };
  return <span className={`inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border ${c[color]}`}>{children}</span>;
}

function Input({ label, type = "text", value, onChange, placeholder, required, autoComplete }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

export default function Auth({ mode = "login", onAuth, onSwitch, onBack }) {
  const [tab, setTab] = useState(mode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch(tab === "login" ? "/login" : "/register", {
        method: "POST",
        body: tab === "login" ? { email, password } : { name, email, password },
      });
      onAuth(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 min-h-[calc(100vh-64px)] flex items-start justify-center px-4 sm:px-6 py-12">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">← Back to Home</button>

        <div className="bg-[#0d1220] border border-white/8 rounded-3xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-blue-950 to-violet-950 p-8 text-center">
            <div className="text-4xl mb-3">🎓</div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold">{tab === "login" ? "Welcome Back" : "Create Your Account"}</h1>
            <p className="text-slate-400 text-sm mt-2">
              {tab === "login" ? "Log in to save your results and track progress." : "Track every prediction, save your plans, and see your progress."}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-1.5 bg-white/4 border border-white/8 rounded-xl p-1 mb-6">
              {[["login", "Log In"], ["register", "Sign Up"]].map(([k, l]) => (
                <button key={k} onClick={() => { setTab(k); setError(null); }}
                  className={`py-2.5 rounded-lg text-sm font-bold transition-all ${tab === k ? "bg-gradient-to-r from-blue-500 to-violet-600" : "text-slate-400 hover:text-white"}`}>
                  {l}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {tab === "register" && (
                <Input label="Full Name" required autoComplete="name" placeholder="e.g. Rohan Sharma" value={name} onChange={setName} />
              )}
              <Input label="Email" type="email" required autoComplete="email" placeholder="you@college.edu" value={email} onChange={setEmail} />
              <Input label="Password" type="password" required autoComplete={tab === "login" ? "current-password" : "new-password"} placeholder={tab === "login" ? "Your password" : "6+ characters"} value={password} onChange={setPassword} />

              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-sm text-red-300">⚠️ {error}</div>}

              <button type="submit" disabled={loading || !email || !password || (tab === "register" && !name)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 font-bold text-sm transition-all disabled:opacity-40 hover:-translate-y-0.5 hover:shadow-lg">
                {loading ? "Please wait…" : tab === "login" ? "Log In →" : "Create Account →"}
              </button>
            </form>

            <div className="mt-6 bg-white/3 border border-white/6 rounded-2xl p-4 text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">Why create an account?</strong> Your predictions get saved to a personal history, so you can track your progress semester after semester and compare model outcomes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}