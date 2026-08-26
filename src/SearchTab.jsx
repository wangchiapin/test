import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { STAMP, fmt, dateLabel, twYear, monthKeyOf } from "./lib.js";
import { CatDot, tdStyle } from "./components.jsx";

export default function SearchTab({ expenses, categories, catMap }) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");

  const results = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return expenses
      .filter((e) => category === "all" || e.category === category)
      .filter((e) => !kw || `${e.item} ${e.note}`.toLowerCase().includes(kw))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, keyword, category]);

  const total = results.reduce((s, e) => s + Number(e.price || 0), 0);

  const trend = useMemo(() => {
    const byMonth = {};
    results.forEach((e) => {
      const mk = monthKeyOf(e.date);
      byMonth[mk] = (byMonth[mk] || 0) + Number(e.price || 0);
    });
    return Object.keys(byMonth).sort().map((mk) => ({
      name: `${twYear(mk.split("-")[0])}/${Number(mk.split("-")[1])}`,
      amount: byMonth[mk],
    }));
  }, [results]);

  const active = keyword.trim() !== "" || category !== "all";
  const selectStyle = { border: "1px solid #E0D5BC", borderRadius: 10, padding: "9px 10px", fontSize: 13, background: "#fff", color: "#2B2620" };

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9", marginBottom: 14 }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={15} color="#B8AC91" style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            type="text" placeholder="搜尋項目或備註關鍵字，例如：咖啡"
            value={keyword} onChange={(e) => setKeyword(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0D5BC", borderRadius: 10, padding: "9px 12px 9px 34px", fontSize: 14 }}
          />
          {keyword && (
            <button onClick={() => setKeyword("")} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer", color: "#B8AC91" }}>
              <X size={16} />
            </button>
          )}
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
          <option value="all">所有分類</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

      {active && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: PAPER_DEEP_FALLBACK, borderRadius: 14, padding: "10px 14px", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "#5C5343" }}>符合 {results.length} 筆</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: STAMP }}>${fmt(total)}</span>
          </div>

          {trend.length > 1 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8A8072", marginBottom: 8, letterSpacing: 1 }}>逐月金額趨勢</div>
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#EFE7D4" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8A8072" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#8A8072" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #ECE1C9" }} formatter={(v) => `$${fmt(v)}`} />
                    <Bar dataKey="amount" fill={STAMP} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="lg-scroll" style={{ background: "#fff", borderRadius: 16, border: "1px solid #ECE1C9", maxHeight: 460, overflowY: "auto" }}>
            {results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#A79C89", fontSize: 13 }}>沒有符合的紀錄</div>
            ) : (
              results.map((it) => {
                const cat = catMap[it.category] || { name: it.category, color: "#999" };
                return (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #F3ECDA" }}>
                    <CatDot color={cat.color} size={9} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.item || cat.name}</div>
                      <div style={{ fontSize: 11, color: "#A79C89" }}>{dateLabel(it.date)} · {cat.name}{it.note ? ` · ${it.note}` : ""}</div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600 }}>${fmt(it.price)}</span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {!active && (
        <div style={{ textAlign: "center", padding: "36px 0", color: "#A79C89", fontSize: 13 }}>
          輸入關鍵字或選分類，查看年度的每一筆花費
        </div>
      )}
    </div>
  );
}

const PAPER_DEEP_FALLBACK = "#EDE4D0";
