import { useState, useRef, useEffect } from "react";
import { apiFetch } from "./api";

const QUICK = ["Attendance problems", "Study tips", "Scholarship options", "Clearing backlogs", "Feeling stressed"];

function Tag({ color = "blue", children }) {
  const c = {
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    violet:  "text-violet-400 bg-violet-500/10 border-violet-500/25",
  };
  return <span className={`inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border ${c[color]}`}>{children}</span>;
}

const WELCOME = {
  role: "bot",
  text: "👋 Hi, I'm your AcademicAI assistant.\n\nAsk me about attendance rules, study techniques, scholarships, backlogs, exam prep, or mental-health resources. I'm here to help, not to judge.",
};

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-line leading-relaxed ${
        isUser
          ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-br-md"
          : "bg-white/5 border border-white/10 text-slate-300 rounded-bl-md"
      }`}>
        {msg.text}
      </div>
    </div>
  );
}

export default function Chatbot({ onBack }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: t }]);
    setLoading(true);
    try {
      const data = await apiFetch("/chatbot", { method: "POST", body: { message: t } });
      setMessages(m => [...m, { role: "bot", text: data.reply }]);
    } catch {
      setMessages(m => [...m, { role: "bot", text: "😅 Sorry, I couldn't reach the server. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 min-h-[calc(100vh-64px)] max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">← Back to Home</button>

      <Tag color="emerald">Academic Assistant</Tag>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-4 mb-6 tracking-tight">Ask Me Anything 🤖</h1>

      <div className="bg-[#0d1220] border border-white/8 rounded-3xl overflow-hidden shadow-2xl">
        <div className="h-[420px] overflow-y-auto p-5 space-y-3 bg-gradient-to-b from-white/2 to-transparent">
          {messages.map((m, i) => <Bubble key={i} msg={m} />)}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 animate-blink"/><span className="w-2 h-2 rounded-full bg-slate-500 animate-blink" style={{animationDelay:".15s"}}/><span className="w-2 h-2 rounded-full bg-slate-500 animate-blink" style={{animationDelay:".3s"}}/></div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-white/8 p-3.5">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK.map(q => (
              <button key={q} onClick={() => send(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/3 text-slate-400 hover:border-blue-500/40 hover:text-blue-300 transition-all">
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder="Type your question…"
              className="flex-1 bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors" />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="px-5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold disabled:opacity-40 transition-all hover:-translate-y-0.5">
              Send →
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white/3 border border-white/6 rounded-2xl p-4 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-200">Note:</strong> This assistant gives general academic guidance. It is not a substitute for professional counseling — if you're in crisis, please reach out to the helplines listed under the counseling resources.
      </div>
    </div>
  );
}