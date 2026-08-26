import React, { useMemo, useState } from "react";
import { Sparkles, Settings as SettingsIcon, RefreshCw } from "lucide-react";
import { STAMP, GOOD, twYear, fmt, computeMonthStats, monthKeyOf } from "./lib.js";
import { callGeminiText } from "./gemini.js";

const RANGES = [
  ["month", "本月"],
  ["year", "今年"],
  ["all", "全部"],
];

export default function AITab({ expenses, incomes, categories, viewMonth, aiSettings, onOpenSettings }) {
  const [range, setRange] = useState("month");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const monthsInRange = useMemo(() => {
    const all = Array.from(new Set(expenses.map((e) => monthKeyOf(e.date)))).sort();
    if (range === "month") return [viewMonth];
    if (range === "year") {
      const y = twYear(viewMonth.split("-")[0]);
      return all.filter((mk) => twYear(mk.split("-")[0]) === y);
    }
    return all.length ? all : [viewMonth];
  }, [expenses, viewMonth, range]);

  const summary = useMemo(() => {
    const agg = { categoryTotals: {}, total: 0, netExpense: 0, incomeTotal: 0, balance: 0 };
    categories.forEach((c) => { agg.categoryTotals[c.id] = 0; });
    monthsInRange.forEach((mk) => {
      const s = computeMonthStats(expenses, incomes, categories, mk);
      categories.forEach((c) => { agg.categoryTotals[c.id] += s.categoryTotals[c.id] || 0; });
      agg.total += s.total;
      agg.netExpense += s.netExpense;
      agg.incomeTotal += s.incomeTotal;
      agg.balance += s.balance;
    });
    return agg;
  }, [monthsInRange, expenses, incomes, categories]);

  const rangeLabel = range === "month" ? `${twYear(viewMonth.split("-")[0])}年${Number(viewMonth.split("-")[1])}月`
    : range === "year" ? `民國 ${twYear(viewMonth.split("-")[0])} 年全年`
    : "有紀錄以來的全部資料";

  const hasKey = !!(aiSettings?.apiKey && aiSettings.apiKey.trim());

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const lines = categories
        .map((c) => [c.name, agg_or(summary.categoryTotals[c.id])])
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, v]) => `${name}：$${fmt(v)}`)
        .join("\n");

      const prompt = `你是一位親切、務實的個人理財顧問。以下是使用者「${rangeLabel}」的記帳統計資料（單位：新台幣）：

各分類支出：
${lines || "（此期間尚無支出紀錄）"}

支出總計：$${fmt(summary.total)}
扣除卡費後支出：$${fmt(summary.netExpense)}
收入合計：$${fmt(summary.incomeTotal)}
收支損益：$${fmt(summary.balance)}

請用繁體中文，給出：
1. 這段期間花費狀況的簡短觀察（2-3 句話）
2. 值得注意或偏高的分類（如果有的話）
3. 2-3 個具體、可執行的省錢或理財建議
語氣自然、口語一點，不要用制式的顧問腔，也不要條列出「以上僅供參考」這種免責聲明。`;

      const text = await callGeminiText(aiSettings.apiKey, aiSettings.model, prompt);
      setResult(text);
    } catch (e) {
      setError(e.message || "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  const selectStyle = { border: "1px solid #E0D5BC", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "#fff", color: "#2B2620" };

  if (!hasKey) {
    return (
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #ECE1C9", textAlign: "center" }}>
        <Sparkles size={28} color={STAMP} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>還沒有設定 AI 金鑰</div>
        <div style={{ fontSize: 12.5, color: "#8A8072", lineHeight: 1.7, marginBottom: 16 }}>
          去 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: STAMP }}>Google AI Studio</a> 免費申請一組 Gemini API 金鑰，
          貼到「設定 → AI 分析」裡就能用，完全不用花錢。
        </div>
        <button onClick={onOpenSettings}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: STAMP, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <SettingsIcon size={14} /> 前往設定
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#8A8072", marginBottom: 10, letterSpacing: 1 }}>分析範圍</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {RANGES.map(([key, label]) => (
            <button key={key} onClick={() => setRange(key)}
              style={{
                flex: 1, border: range === key ? `2px solid ${STAMP}` : "1px solid #E0D5BC",
                background: range === key ? `${STAMP}14` : "#fff", color: range === key ? STAMP : "#5C5343",
                borderRadius: 10, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#A79C89", marginBottom: 12 }}>將分析：{rangeLabel}</div>
        <button onClick={runAnalysis} disabled={loading}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 0", borderRadius: 12, border: "none", background: loading ? "#D8CBAE" : STAMP,
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer",
          }}>
          {loading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
          {loading ? "分析中…" : "產生 AI 分析"}
        </button>
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {error && (
        <div style={{ background: "#F7E3D9", border: "1px solid #E0B49A", borderRadius: 12, padding: "12px 14px", fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
          發生錯誤：{error}
        </div>
      )}

      {result && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #ECE1C9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: GOOD, marginBottom: 10, letterSpacing: 1 }}>
            <Sparkles size={14} /> AI 分析結果
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.9, whiteSpace: "pre-wrap", color: "#3A3428" }}>{result}</div>
        </div>
      )}
    </div>
  );
}

function agg_or(v) { return v || 0; }
