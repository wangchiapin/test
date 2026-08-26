import React, { useMemo, useState } from "react";
import { StickyNote, Lock } from "lucide-react";
import { GOOD, STAMP, INK, PAPER_DEEP, twYear, fmt, computeMonthStats } from "./lib.js";
import { thStyle, tdStyle } from "./components.jsx";

export default function StatsTab({ expenses, incomes, categories, viewMonth, setViewMonth, setTab, monthlyNotes, unlocked, onUnlock }) {
  const statsFor = (month) => computeMonthStats(expenses, incomes, categories, month);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [checking, setChecking] = useState(false);

  const notesFor = (month) => (monthlyNotes || []).filter((n) => n.month === month);

  const allMonths = useMemo(() => {
    const set = new Set(expenses.map((e) => e.date.slice(0, 7)));
    incomes.forEach((i) => set.add(i.month));
    set.add(viewMonth);
    return Array.from(set).sort();
  }, [expenses, incomes, viewMonth]);

  const yearGroups = useMemo(() => {
    const byYear = {};
    allMonths.forEach((mk) => {
      const y = twYear(mk.split("-")[0]);
      (byYear[y] = byYear[y] || []).push(mk);
    });
    return Object.keys(byYear).sort((a, b) => b - a).map((y) => ({ year: y, months: byYear[y].sort().reverse() }));
  }, [allMonths]);

  if (!unlocked) {
    const submit = async (e) => {
      e.preventDefault();
      setChecking(true);
      const ok = await onUnlock(pwInput);
      setChecking(false);
      if (!ok) { setPwError(true); setPwInput(""); } else { setPwError(false); }
    };
    return (
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #ECE1C9", padding: "48px 24px", textAlign: "center" }}>
        <Lock size={28} color="#B8AC91" style={{ marginBottom: 14 }} />
        <div style={{ fontSize: 14, color: "#5C5343", marginBottom: 18 }}>統計分頁已鎖定，請輸入密碼查看</div>
        <form onSubmit={submit} style={{ maxWidth: 220, margin: "0 auto" }}>
          <input
            type="password" inputMode="numeric" autoFocus placeholder="密碼" value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${pwError ? STAMP : "#E0D5BC"}`, borderRadius: 10, padding: "10px 12px", fontSize: 15, textAlign: "center", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}
          />
          {pwError && <div style={{ fontSize: 12, color: STAMP, marginBottom: 10 }}>密碼不正確</div>}
          <button type="submit" disabled={checking}
            style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: STAMP, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {checking ? "確認中…" : "解鎖"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="stats-card" style={{ background: "#fff", borderRadius: 16, border: "1px solid #ECE1C9" }}>
      <style>{`
        .stats-card { overflow: hidden; }
        .stats-scroll { overflow: auto; max-height: 480px; }
        @media (min-width: 760px) {
          .stats-card { overflow-x: auto; overflow-y: hidden; }
          .stats-scroll { overflow: visible; max-height: none; }
        }
      `}</style>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#8A8072", padding: "12px 14px 6px", letterSpacing: 1 }}>
        逐月統計（比照原 Excel「統計」表，點任一列可跳到該月記帳）
      </div>
      <div className="lg-scroll stats-scroll" style={{ padding: "0 4px 12px" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>月份</th>
              <th style={{ ...thStyle, position: "sticky", top: 0, background: "#fff", zIndex: 1, textAlign: "center" }}>備註</th>
              {categories.map((c) => (<th key={c.id} style={{ ...thStyle, color: c.color, position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>{c.id}</th>))}
              <th style={{ ...thStyle, position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>總計</th>
              <th style={{ ...thStyle, position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>支出總計－卡費</th>
              <th style={{ ...thStyle, position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>收入</th>
              <th style={{ ...thStyle, position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>收支損益</th>
            </tr>
          </thead>
          <tbody>
            {yearGroups.map((yg) => (
              <React.Fragment key={yg.year}>
                {yg.months.map((mk) => {
                  const s = statsFor(mk);
                  const active = mk === viewMonth;
                  const notes = notesFor(mk);
                  const expanded = expandedMonth === mk;
                  return (
                    <React.Fragment key={mk}>
                      <tr onClick={() => { setViewMonth(mk); setTab("ledger"); }} style={{ cursor: "pointer", background: active ? "#FBF3E4" : "transparent" }}>
                        <td style={{ ...tdStyle, fontWeight: 700, position: "sticky", left: 0, background: active ? "#FBF3E4" : "#fff" }}>{Number(mk.split("-")[1])}月</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {notes.length > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); setExpandedMonth(expanded ? null : mk); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: STAMP, padding: 2, display: "inline-flex" }}
                              title={`${notes.length} 則備註`}>
                              <StickyNote size={13} fill={expanded ? STAMP : "none"} />
                            </button>
                          )}
                        </td>
                        {categories.map((c) => (<td key={c.id} style={tdStyle}>{s.categoryTotals[c.id] ? fmt(s.categoryTotals[c.id]) : "－"}</td>))}
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(s.total)}</td>
                        <td style={tdStyle}>{fmt(s.netExpense)}</td>
                        <td style={{ ...tdStyle, color: s.incomeTotal >= 0 ? GOOD : STAMP }}>{s.incomeTotal ? fmt(s.incomeTotal) : "－"}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: s.balance >= 0 ? GOOD : STAMP }}>{s.balance >= 0 ? "+" : ""}{fmt(s.balance)}</td>
                      </tr>
                      {expanded && notes.length > 0 && (
                        <tr>
                          <td colSpan={categories.length + 6} style={{ background: "#FBF7EC", padding: "8px 14px", borderBottom: "1px solid #ECE1C9" }}>
                            {notes.map((n) => (
                              <div key={n.id} style={{ fontSize: 12, color: "#5C5343", padding: "3px 0", fontFamily: "'Noto Sans TC', sans-serif", textAlign: "left", whiteSpace: "pre-wrap" }}>
                                · {n.text}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                <tr style={{ background: PAPER_DEEP }}>
                  <td style={{ ...tdStyle, fontWeight: 800, position: "sticky", left: 0, background: PAPER_DEEP }}>{yg.year}年</td>
                  <td style={tdStyle}></td>
                  {categories.map((c) => {
                    const sum = yg.months.reduce((s, mk) => s + statsFor(mk).categoryTotals[c.id], 0);
                    return <td key={c.id} style={{ ...tdStyle, fontWeight: 700 }}>{sum ? fmt(sum) : "－"}</td>;
                  })}
                  {(() => {
                    const totals = yg.months.reduce((acc, mk) => {
                      const s = statsFor(mk);
                      acc.total += s.total; acc.net += s.netExpense; acc.inc += s.incomeTotal; acc.bal += s.balance;
                      return acc;
                    }, { total: 0, net: 0, inc: 0, bal: 0 });
                    return (
                      <>
                        <td style={{ ...tdStyle, fontWeight: 800 }}>{fmt(totals.total)}</td>
                        <td style={{ ...tdStyle, fontWeight: 800 }}>{fmt(totals.net)}</td>
                        <td style={{ ...tdStyle, fontWeight: 800, color: GOOD }}>{fmt(totals.inc)}</td>
                        <td style={{ ...tdStyle, fontWeight: 800, color: totals.bal >= 0 ? GOOD : STAMP }}>{totals.bal >= 0 ? "+" : ""}{fmt(totals.bal)}</td>
                      </>
                    );
                  })()}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
