import React, { useMemo, useState } from "react";
import { Trash2, PiggyBank, Pencil, Check, StickyNote, Plus, RefreshCw } from "lucide-react";
import { INK, GOOD, STAMP, INCOME_SOURCES, fmt, dateLabel, monthKeyOf } from "./lib.js";
import { CatDot, Tile } from "./components.jsx";

export default function LedgerTab({
  expenses, incomes, categories, catMap, monthStats, viewMonth,
  confirmDeleteId, setConfirmDeleteId, deleteExpense, onEdit,
  editingIncomeSrc, setEditingIncomeSrc, incomeDraft, setIncomeDraft,
  getIncomeAmount, saveIncome,
  monthlyNotes, addMonthlyNote, updateMonthlyNote, deleteMonthlyNote,
}) {
  const monthGroups = useMemo(() => {
    const monthExp = expenses.filter((e) => monthKeyOf(e.date) === viewMonth);
    const byDate = {};
    monthExp.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });
    const dates = Object.keys(byDate).sort().reverse();
    return dates.map((d) => ({
      date: d,
      items: byDate[d].sort((a, b) => b.id.localeCompare(a.id)),
      subtotal: byDate[d].reduce((s, e) => s + Number(e.price || 0), 0),
    }));
  }, [expenses, viewMonth]);

  const notesForMonth = useMemo(
    () => (monthlyNotes || []).filter((n) => n.month === viewMonth).sort((a, b) => a.createdAt - b.createdAt),
    [monthlyNotes, viewMonth]
  );

  return (
    <div>
      <style>{`
        .ledger-3col { display: flex; flex-direction: column; gap: 14px; }
        .ledger-3col .col-entries { order: 1; }
        .ledger-3col .col-category { order: 2; }
        .ledger-3col .col-income { order: 3; }
        @media (min-width: 760px) {
          .ledger-3col { display: grid; grid-template-columns: 1fr 1.3fr 1fr; align-items: start; }
          .ledger-3col .col-category { order: 1; }
          .ledger-3col .col-entries { order: 2; }
          .ledger-3col .col-income { order: 3; }
        }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <Tile label="支出總計" value={monthStats.total} color={INK} />
        <Tile label="支出總計－卡費" value={monthStats.netExpense} color={INK} />
        <Tile label="收入合計" value={monthStats.incomeTotal} color={monthStats.incomeTotal >= 0 ? GOOD : STAMP} />
      </div>

      <div className="ledger-3col">
        <div className="col-category" style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A8072", marginBottom: 10, letterSpacing: 1 }}>分類明細</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#5C5343" }}>
                  <CatDot color={c.color} /> {c.name}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: monthStats.categoryTotals[c.id] ? INK : "#C9BFA9" }}>
                  {fmt(monthStats.categoryTotals[c.id])}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-entries lg-scroll" style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9", maxHeight: 560, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A8072", marginBottom: 10, letterSpacing: 1 }}>每日支出狀況</div>
          {monthGroups.length === 0 && (
            <div style={{ textAlign: "center", padding: "36px 0", color: "#A79C89", fontSize: 13 }}>
              本月尚無紀錄，點右下角「＋」開始記帳
            </div>
          )}
          {monthGroups.map((g) => (
            <div key={g.date} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px 6px", borderBottom: `1px solid #E0D5BC` }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Noto Serif TC', serif" }}>{dateLabel(g.date)}</span>
                <span style={{ fontSize: 12, color: "#8A8072", fontFamily: "'JetBrains Mono', monospace" }}>小計 ${fmt(g.subtotal)}</span>
              </div>
              {g.items.map((it) => {
                const cat = catMap[it.category] || { name: it.category, color: "#999" };
                const confirming = confirmDeleteId === it.id;
                return (
                  <div
                    key={it.id}
                    onClick={() => { if (confirming) setConfirmDeleteId(null); else onEdit(it); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", borderBottom: "1px solid #EFE7D4", cursor: "pointer" }}
                  >
                    <CatDot color={cat.color} size={9} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.item || cat.name}</div>
                      <div style={{ fontSize: 11, color: "#A79C89" }}>{cat.name}{it.note ? ` · ${it.note}` : ""}</div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600 }}>${fmt(it.price)}</span>
                    {confirming ? (
                      <button onClick={(e) => { e.stopPropagation(); deleteExpense(it.id); }}
                        style={{ background: STAMP, color: "#fff", border: "none", borderRadius: 8, padding: "6px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 3, cursor: "pointer", flexShrink: 0 }}>
                        <Trash2 size={12} /> 確定
                      </button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(it.id); }}
                        style={{ background: "none", border: "none", color: "#D8CBAE", cursor: "pointer", padding: 4, flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="col-income" style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#8A8072", marginBottom: 10, letterSpacing: 1 }}>
            <PiggyBank size={14} /> 本月收入
          </div>
          {INCOME_SOURCES.map((src) => {
            const amount = getIncomeAmount(viewMonth, src);
            const editing = editingIncomeSrc === src;
            const synced = src === "華語文教學";
            return (
              <div key={src} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", fontSize: 13, borderBottom: "1px solid #F3ECDA" }}>
                <span style={{ color: "#5C5343", display: "flex", alignItems: "center", gap: 5 }}>
                  {src}
                  {synced && <RefreshCw size={10} color="#B8AC91" title="由「實際收入紀錄」自動同步" />}
                </span>
                {synced ? (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#5C5343" }} title="這個欄位由「實際收入紀錄」頁面自動同步，此處僅供查看">
                    ${fmt(amount)}
                  </span>
                ) : editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number" autoFocus defaultValue={amount || ""}
                      onChange={(e) => setIncomeDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveIncome(viewMonth, src, Number(incomeDraft || 0)); }}
                      style={{ width: 80, border: "1px solid #D8CBAE", borderRadius: 8, padding: "4px 6px", fontSize: 13, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}
                    />
                    <button onClick={() => saveIncome(viewMonth, src, Number(incomeDraft || 0))} style={{ background: GOOD, border: "none", color: "#fff", borderRadius: 6, padding: 5, cursor: "pointer" }}>
                      <Check size={13} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingIncomeSrc(src); setIncomeDraft(String(amount || "")); }}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: INK, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                    ${fmt(amount)} <Pencil size={11} color="#B8AC91" />
                  </button>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontSize: 13, fontWeight: 700 }}>
            <span>共計</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: monthStats.incomeTotal >= 0 ? GOOD : STAMP }}>${fmt(monthStats.incomeTotal)}</span>
          </div>
        </div>
      </div>

      <MonthlyNotesCard
        notes={notesForMonth} viewMonth={viewMonth}
        addMonthlyNote={addMonthlyNote} updateMonthlyNote={updateMonthlyNote} deleteMonthlyNote={deleteMonthlyNote}
      />
    </div>
  );
}

function MonthlyNotesCard({ notes, viewMonth, addMonthlyNote, updateMonthlyNote, deleteMonthlyNote }) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const submit = () => {
    if (!draft.trim()) return;
    addMonthlyNote(viewMonth, draft);
    setDraft("");
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9", marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#8A8072", marginBottom: 10, letterSpacing: 1 }}>
        <StickyNote size={14} /> 本月備註
      </div>

      {notes.length === 0 && (
        <div style={{ fontSize: 12.5, color: "#A79C89", marginBottom: 10 }}>還沒有備註，例如可以記「帳單金額異常，之後查」之類的事。</div>
      )}

      {notes.map((n) => (
        <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: "1px solid #F3ECDA" }}>
          {editingId === n.id ? (
            <>
              <input
                type="text" autoFocus value={editDraft} onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && editDraft.trim()) { updateMonthlyNote(n.id, editDraft); setEditingId(null); } }}
                style={{ flex: 1, border: "1px solid #D8CBAE", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}
              />
              <button onClick={() => { if (editDraft.trim()) { updateMonthlyNote(n.id, editDraft); setEditingId(null); } }}
                style={{ background: GOOD, border: "none", color: "#fff", borderRadius: 6, padding: 5, cursor: "pointer", flexShrink: 0 }}>
                <Check size={13} />
              </button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, fontSize: 13, color: "#3A342A", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.text}</div>
              <button onClick={() => { setEditingId(n.id); setEditDraft(n.text); }}
                style={{ background: "none", border: "none", color: "#B8AC91", cursor: "pointer", padding: 4, flexShrink: 0 }}>
                <Pencil size={13} />
              </button>
              {confirmId === n.id ? (
                <button onClick={() => { deleteMonthlyNote(n.id); setConfirmId(null); }}
                  style={{ background: STAMP, color: "#fff", border: "none", borderRadius: 6, padding: "4px 6px", fontSize: 11, display: "flex", alignItems: "center", gap: 3, cursor: "pointer", flexShrink: 0 }}>
                  <Trash2 size={12} /> 確定
                </button>
              ) : (
                <button onClick={() => setConfirmId(n.id)}
                  style={{ background: "none", border: "none", color: "#D8CBAE", cursor: "pointer", padding: 4, flexShrink: 0 }}>
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          type="text" placeholder="新增一則備註…" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{ flex: 1, border: "1px solid #E0D5BC", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}
        />
        <button onClick={submit}
          style={{ background: STAMP, border: "none", color: "#fff", borderRadius: 10, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
