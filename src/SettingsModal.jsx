import React, { useRef, useState, useMemo } from "react";
import { X, Plus, Trash2, Download, Upload, AlertTriangle, Pencil, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { PAPER, STAMP, GOOD, INCOME_SOURCES, genId, todayISO, fmt } from "./lib.js";
import { CatDot, fieldLabel, inputStyle } from "./components.jsx";

const PALETTE = ["#C1622D", "#B4637A", "#2F6F62", "#4A6FA5", "#A97C50", "#7B5E7B", "#5B5B5B", "#4B5A85", "#3F7D5C", "#C79A2A", "#8C8474", "#A3352A", "#6B8E23", "#B5533C"];

export default function SettingsModal({
  categories, setCategoriesPersist,
  expenses, incomes, setDataPersist,
  aiSettings, setAiSettingsPersist,
  setStatsPasswordPersist,
  initialSection,
  onClose,
}) {
  const [section, setSection] = useState(initialSection || "categories"); // categories | records | data | ai | lock
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
  const [deleteBlocked, setDeleteBlocked] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [keyDraft, setKeyDraft] = useState(aiSettings?.apiKey || "");
  const [modelDraft, setModelDraft] = useState(aiSettings?.model || "gemini-flash-latest");
  const [keySaved, setKeySaved] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const backupFileRef = useRef(null);
  const legacyFileRef = useRef(null);

  const usedCategoryIds = new Set(expenses.map((e) => e.category));

  const addCategory = () => {
    const name = newName.trim();
    if (!name) return;
    if (categories.some((c) => c.id === name)) { setNewName(""); return; }
    const next = [...categories, { id: name, name, color: newColor }];
    setCategoriesPersist(next);
    setNewName("");
    setNewColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
  };

  const renameCategory = (id, name) => {
    setCategoriesPersist(categories.map((c) => (c.id === id ? { ...c, name } : c)));
  };
  const recolorCategory = (id, color) => {
    setCategoriesPersist(categories.map((c) => (c.id === id ? { ...c, color } : c)));
  };
  const deleteCategory = (id) => {
    if (usedCategoryIds.has(id)) { setDeleteBlocked(id); setTimeout(() => setDeleteBlocked(null), 2200); return; }
    setCategoriesPersist(categories.filter((c) => c.id !== id));
  };

  // ---- export ----
  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const wsExp = XLSX.utils.json_to_sheet(
      expenses.map((e) => ({ 日期: e.date, 分類: e.category, 項目: e.item, 金額: e.price, 備註: e.note || "" }))
    );
    const wsInc = XLSX.utils.json_to_sheet(
      incomes.map((i) => ({ 月份: i.month, 來源: i.source, 金額: i.amount }))
    );
    XLSX.utils.book_append_sheet(wb, wsExp, "支出");
    XLSX.utils.book_append_sheet(wb, wsInc, "收入");
    XLSX.writeFile(wb, `生活帳本備份_${todayISO()}.xlsx`);
  };

  // ---- import: our own backup format ----
  const importBackup = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const expRows = wb.Sheets["支出"] ? XLSX.utils.sheet_to_json(wb.Sheets["支出"]) : [];
    const incRows = wb.Sheets["收入"] ? XLSX.utils.sheet_to_json(wb.Sheets["收入"]) : [];
    const newExpenses = expRows
      .filter((r) => r["日期"] && r["分類"] && r["金額"])
      .map((r) => ({
        id: genId(),
        date: normalizeDate(r["日期"]),
        category: String(r["分類"]).trim(),
        item: r["項目"] ? String(r["項目"]).trim() : "",
        price: Number(r["金額"]),
        note: r["備註"] ? String(r["備註"]).trim() : "",
      }))
      .filter((e) => e.date && e.price > 0);
    const newIncomes = incRows
      .filter((r) => r["月份"] && r["來源"] && r["金額"])
      .map((r) => ({ id: genId(), month: String(r["月份"]).trim(), source: String(r["來源"]).trim(), amount: Number(r["金額"]) }));
    const nextExpenses = [...expenses, ...newExpenses];
    const nextIncomes = [...incomes, ...newIncomes];
    setDataPersist(nextExpenses, nextIncomes);
    setImportMsg(`匯入了 ${newExpenses.length} 筆支出、${newIncomes.length} 筆收入`);
  };

  // ---- import: legacy multi-sheet-per-month excel (original spreadsheet format) ----
  // Note: in the original workbook, the 日期 (date) cell is merged down across every
  // entry belonging to the same day, so only the first row of each day actually carries
  // a date value — every other row's date cell is blank. We forward-fill the last seen
  // date so those rows aren't silently dropped.
  const importLegacy = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const newExpenses = [];
    const newIncomes = [];
    let skipped = 0;
    wb.SheetNames.forEach((sheetName) => {
      const m = sheetName.match(/^(\d+)-(\d+)\s*月$/);
      if (!m) return;
      const gregYear = Number(m[1]) + 1911;
      const monthKey = `${gregYear}-${String(Number(m[2])).padStart(2, "0")}`;
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
      let lastDate = null;
      rows.forEach((row) => {
        const dateCell = row[0];
        if (dateCell) {
          const iso = normalizeDate(dateCell);
          if (iso) lastDate = iso;
        }
        const cat = row[1];
        const item = row[2];
        const price = toNumber(row[3]);
        const isRealCategory = typeof cat === "string" && cat.trim() && !["總計", "小計", "扣掉卡費", "收入", "收支損益"].includes(cat.trim());
        if (lastDate && isRealCategory && price !== null && price > 0) {
          newExpenses.push({
            id: genId(), date: lastDate, category: cat.trim(),
            item: item !== undefined && item !== null ? String(item).trim() : "", price,
            note: row[5] ? String(row[5]).trim() : "",
          });
        } else if (dateCell && isRealCategory && price === null) {
          skipped += 1;
        }
        const incLabel = row[7];
        const incAmount = toNumber(row[8]);
        if (INCOME_SOURCES.includes(incLabel) && incAmount !== null && incAmount > 0) {
          newIncomes.push({ id: genId(), month: monthKey, source: incLabel, amount: incAmount });
        }
      });
    });
    const nextExpenses = [...expenses, ...newExpenses];
    const nextIncomes = [...incomes, ...newIncomes];
    setDataPersist(nextExpenses, nextIncomes);
    setImportMsg(`從舊版 Excel 匯入了 ${newExpenses.length} 筆支出、${newIncomes.length} 筆收入${skipped ? `（${skipped} 筆金額欄位無法辨識，已略過）` : ""}`);
  };

  const clearAll = () => {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; }
    setDataPersist([], []);
    setConfirmClear(false);
    setImportMsg("已清空所有記帳資料");
  };

  const saveAISettings = () => {
    setAiSettingsPersist({ apiKey: keyDraft.trim(), model: modelDraft.trim() || "gemini-flash-latest" });
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,38,32,0.45)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PAPER, width: "100%", maxWidth: 440, borderRadius: "20px 20px 0 0", padding: "16px 18px 26px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 17, fontWeight: 800, margin: 0 }}>設定</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8A8072" }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", background: "#EDE4D0", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
          {[["categories", "分類管理"], ["records", "明細管理"], ["data", "備份與匯入"], ["ai", "AI 分析"], ["lock", "統計密碼"]].map(([key, label]) => (
            <button key={key} onClick={() => setSection(key)}
              style={{
                flex: "1 1 30%", border: "none", cursor: "pointer", padding: "8px 0", borderRadius: 10,
                background: section === key ? "#fff" : "transparent", color: section === key ? STAMP : "#8A8072",
                fontWeight: section === key ? 700 : 500, fontSize: 12.5,
              }}>
              {label}
            </button>
          ))}
        </div>

        {section === "categories" && (
          <div>
            {categories.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #F3ECDA" }}>
                <input type="color" value={c.color} onChange={(e) => recolorCategory(c.id, e.target.value)} style={{ width: 26, height: 26, border: "none", borderRadius: 6, padding: 0, background: "none", cursor: "pointer" }} />
                <input
                  type="text" defaultValue={c.name}
                  onBlur={(e) => { if (e.target.value.trim()) renameCategory(c.id, e.target.value.trim()); }}
                  style={{ flex: 1, border: "1px solid #E0D5BC", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}
                />
                {deleteBlocked === c.id ? (
                  <span style={{ fontSize: 11, color: STAMP, maxWidth: 90 }}>已有支出使用</span>
                ) : (
                  <button onClick={() => deleteCategory(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B8AC91", padding: 4 }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 26, height: 26, border: "none", borderRadius: 6, padding: 0, background: "none", cursor: "pointer" }} />
              <input
                type="text" placeholder="新分類名稱" value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
                style={{ flex: 1, border: "1px solid #E0D5BC", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}
              />
              <button onClick={addCategory} style={{ background: STAMP, border: "none", color: "#fff", borderRadius: 8, padding: 7, cursor: "pointer" }}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        {section === "records" && (
          <RecordsSection
            expenses={expenses} incomes={incomes} categories={categories} setDataPersist={setDataPersist}
          />
        )}

        {section === "data" && (
          <div>
            <button onClick={exportXlsx}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", borderRadius: 12, border: "none", background: STAMP, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 10 }}>
              <Download size={16} /> 匯出目前資料（.xlsx）
            </button>

            <input ref={backupFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files[0]; if (f) importBackup(f); e.target.value = ""; }} />
            <button onClick={() => backupFileRef.current.click()}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", borderRadius: 12, border: "1px solid #E0D5BC", background: "#fff", color: "#2B2620", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 10 }}>
              <Upload size={16} /> 匯入本工具備份檔
            </button>

            <input ref={legacyFileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files[0]; if (f) importLegacy(f); e.target.value = ""; }} />
            <button onClick={() => legacyFileRef.current.click()}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", borderRadius: 12, border: "1px solid #E0D5BC", background: "#fff", color: "#2B2620", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 10 }}>
              <Upload size={16} /> 匯入舊版 Excel 記帳本（歷史資料一次搬過來）
            </button>

            {importMsg && <div style={{ fontSize: 12, color: GOOD, marginBottom: 10 }}>{importMsg}</div>}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #D8CBAE" }}>
              <div style={{ fontSize: 11, color: "#A79C89", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <AlertTriangle size={13} /> 危險區域
              </div>
              <button onClick={clearAll}
                style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: `1px solid ${STAMP}`, background: confirmClear ? STAMP : "#fff", color: confirmClear ? "#fff" : STAMP, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {confirmClear ? "再按一次確定清空所有資料" : "清空所有記帳資料"}
              </button>
            </div>
          </div>
        )}

        {section === "ai" && (
          <div>
            <div style={{ fontSize: 12, color: "#8A8072", lineHeight: 1.6, marginBottom: 14 }}>
              到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: STAMP }}>Google AI Studio</a> 免費申請一組 API 金鑰貼在這裡，就能在「AI 分析」分頁請 Gemini 幫你看支出、給建議。申請時建議把金鑰限制成只能從你的網站網域呼叫，比較安全。
            </div>
            <label style={{ display: "block", fontSize: 11.5, color: "#8A8072", fontWeight: 700, marginBottom: 6 }}>Gemini API 金鑰</label>
            <input
              type="text" placeholder="AIzaSy..." value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0D5BC", borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <label style={{ display: "block", fontSize: 11.5, color: "#8A8072", fontWeight: 700, marginBottom: 6 }}>模型名稱</label>
            <input
              type="text" placeholder="gemini-flash-latest" value={modelDraft}
              onChange={(e) => setModelDraft(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0D5BC", borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <div style={{ fontSize: 11, color: "#A79C89", marginBottom: 14 }}>如果之後 Google 改了免費模型名稱，改這裡就好，不用改程式。</div>
            <button onClick={saveAISettings}
              style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: keySaved ? GOOD : STAMP, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {keySaved ? "已儲存" : "儲存設定"}
            </button>
          </div>
        )}

        {section === "lock" && (
          <div>
            <div style={{ fontSize: 12, color: "#8A8072", lineHeight: 1.6, marginBottom: 14 }}>
              「統計」分頁需要輸入密碼才能查看，預設密碼是 <b>0000</b>。在這裡可以改成你自己的密碼（4 碼以上皆可）。密碼只會用雜湊方式存起來，不會存明碼。
            </div>
            <label style={{ display: "block", fontSize: 11.5, color: "#8A8072", fontWeight: 700, marginBottom: 6 }}>新密碼</label>
            <input
              type="password" inputMode="numeric" placeholder="輸入新密碼" value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0D5BC", borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <label style={{ display: "block", fontSize: 11.5, color: "#8A8072", fontWeight: 700, marginBottom: 6 }}>再輸入一次</label>
            <input
              type="password" inputMode="numeric" placeholder="再次輸入新密碼" value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0D5BC", borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}
            />
            {pwMsg && <div style={{ fontSize: 12, color: pwMsg.startsWith("已") ? GOOD : STAMP, marginBottom: 10 }}>{pwMsg}</div>}
            <button
              onClick={async () => {
                if (pw1.length < 4) { setPwMsg("密碼至少要 4 碼"); return; }
                if (pw1 !== pw2) { setPwMsg("兩次輸入的密碼不一樣"); return; }
                await setStatsPasswordPersist(pw1);
                setPwMsg("已更新密碼");
                setPw1(""); setPw2("");
              }}
              style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: STAMP, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              更新密碼
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 明細管理：支出 / 收入 的新增、修改、刪除 ----------

function RecordsSection({ expenses, incomes, categories, setDataPersist }) {
  const [subTab, setSubTab] = useState("expense");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["expense", "支出明細"], ["income", "收入明細"]].map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            style={{
              flex: 1, border: subTab === key ? `2px solid ${STAMP}` : "1px solid #E0D5BC",
              background: subTab === key ? `${STAMP}14` : "#fff", color: subTab === key ? STAMP : "#5C5343",
              borderRadius: 10, padding: "8px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}>
            {label}
          </button>
        ))}
      </div>
      {subTab === "expense" ? (
        <ExpenseRecordsPanel expenses={expenses} incomes={incomes} categories={categories} setDataPersist={setDataPersist} />
      ) : (
        <IncomeRecordsPanel expenses={expenses} incomes={incomes} setDataPersist={setDataPersist} />
      )}
    </div>
  );
}

const rowInput = { border: "1px solid #D8CBAE", borderRadius: 8, padding: "5px 7px", fontSize: 12.5, fontFamily: "inherit" };

function ExpenseRecordsPanel({ expenses, incomes, categories, setDataPersist }) {
  const currentMonth = todayISO().slice(0, 7);
  const monthsAvail = useMemo(() => {
    const set = new Set(expenses.map((e) => e.date.slice(0, 7)));
    set.add(currentMonth);
    return Array.from(set).sort().reverse();
  }, [expenses, currentMonth]);

  const [monthFilter, setMonthFilter] = useState(monthsAvail[0]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [newDraft, setNewDraft] = useState({ date: `${monthFilter}-01` === `${currentMonth}-01` ? todayISO() : `${monthFilter}-01`, category: categories[0]?.id || "", item: "", price: "", note: "" });

  const list = useMemo(
    () => expenses.filter((e) => e.date.slice(0, 7) === monthFilter).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [expenses, monthFilter]
  );

  const startEdit = (e) => { setConfirmId(null); setEditingId(e.id); setDraft({ ...e, price: String(e.price) }); };
  const cancelEdit = () => { setEditingId(null); setDraft(null); };
  const saveEdit = () => {
    if (!draft.category || !draft.date) return;
    const next = expenses.map((e) => (e.id === editingId
      ? { ...e, date: draft.date, category: draft.category, item: draft.item.trim(), price: Number(draft.price) || 0, note: draft.note.trim() }
      : e));
    setDataPersist(next, incomes);
    cancelEdit();
  };
  const removeOne = (id) => {
    setDataPersist(expenses.filter((e) => e.id !== id), incomes);
    setConfirmId(null);
  };
  const addNew = () => {
    if (!newDraft.category || !newDraft.date || !newDraft.price) return;
    const entry = { id: genId(), date: newDraft.date, category: newDraft.category, item: newDraft.item.trim(), price: Number(newDraft.price) || 0, note: newDraft.note.trim() };
    setDataPersist([...expenses, entry], incomes);
    setNewDraft({ date: newDraft.date, category: newDraft.category, item: "", price: "", note: "" });
    setMonthFilter(entry.date.slice(0, 7));
  };

  return (
    <div>
      <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ ...rowInput, marginBottom: 12, width: "100%", padding: "8px 10px" }}>
        {monthsAvail.map((mk) => (<option key={mk} value={mk}>{mk}</option>))}
      </select>

      <div style={{ border: "1px dashed #D8CBAE", borderRadius: 10, padding: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#8A8072", fontWeight: 700, marginBottom: 8 }}>新增一筆支出</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          <input type="date" value={newDraft.date} onChange={(e) => setNewDraft({ ...newDraft, date: e.target.value })} style={{ ...rowInput, flex: "1 1 130px" }} />
          <select value={newDraft.category} onChange={(e) => setNewDraft({ ...newDraft, category: e.target.value })} style={{ ...rowInput, flex: "1 1 90px" }}>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          <input type="text" placeholder="項目" value={newDraft.item} onChange={(e) => setNewDraft({ ...newDraft, item: e.target.value })} style={{ ...rowInput, flex: "1 1 100px" }} />
          <input type="number" placeholder="金額" value={newDraft.price} onChange={(e) => setNewDraft({ ...newDraft, price: e.target.value })} style={{ ...rowInput, width: 80, fontFamily: "'JetBrains Mono', monospace" }} />
          <input type="text" placeholder="備註（選填）" value={newDraft.note} onChange={(e) => setNewDraft({ ...newDraft, note: e.target.value })} style={{ ...rowInput, flex: "1 1 90px" }} />
        </div>
        <button onClick={addNew}
          style={{ width: "100%", background: STAMP, border: "none", color: "#fff", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={14} /> 新增這一筆
        </button>
      </div>

      {list.length === 0 && (
        <div style={{ textAlign: "center", padding: "16px 0", color: "#A79C89", fontSize: 12.5 }}>這個月還沒有支出紀錄</div>
      )}

      {list.map((e) => {
        const cat = categories.find((c) => c.id === e.category);
        const editing = editingId === e.id;
        return (
          <div key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid #F3ECDA" }}>
            {editing ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  <input type="date" value={draft.date} onChange={(ev) => setDraft({ ...draft, date: ev.target.value })} style={{ ...rowInput, flex: "1 1 130px" }} />
                  <select value={draft.category} onChange={(ev) => setDraft({ ...draft, category: ev.target.value })} style={{ ...rowInput, flex: "1 1 90px" }}>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  <input type="text" value={draft.item} onChange={(ev) => setDraft({ ...draft, item: ev.target.value })} style={{ ...rowInput, flex: "1 1 100px" }} />
                  <input type="number" value={draft.price} onChange={(ev) => setDraft({ ...draft, price: ev.target.value })} style={{ ...rowInput, width: 80, fontFamily: "'JetBrains Mono', monospace" }} />
                  <input type="text" value={draft.note} onChange={(ev) => setDraft({ ...draft, note: ev.target.value })} style={{ ...rowInput, flex: "1 1 90px" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveEdit}
                    style={{ flex: 1, background: GOOD, border: "none", color: "#fff", borderRadius: 8, padding: "7px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <Check size={13} /> 儲存
                  </button>
                  <button onClick={cancelEdit}
                    style={{ flex: 1, background: "#fff", border: "1px solid #D8CBAE", color: "#8A8072", borderRadius: 8, padding: "7px 0", fontSize: 12.5, cursor: "pointer" }}>
                    取消
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CatDot color={cat?.color || "#999"} size={8} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.date} · {e.item || cat?.name || e.category}
                  </div>
                  <div style={{ fontSize: 11, color: "#A79C89" }}>{cat?.name || e.category}{e.note ? ` · ${e.note}` : ""}</div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>${fmt(e.price)}</span>
                <button onClick={() => startEdit(e)} style={{ background: "none", border: "none", color: "#B8AC91", cursor: "pointer", padding: 3, flexShrink: 0 }}>
                  <Pencil size={13} />
                </button>
                {confirmId === e.id ? (
                  <button onClick={() => removeOne(e.id)} style={{ background: STAMP, color: "#fff", border: "none", borderRadius: 6, padding: "4px 6px", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>確定</button>
                ) : (
                  <button onClick={() => setConfirmId(e.id)} style={{ background: "none", border: "none", color: "#D8CBAE", cursor: "pointer", padding: 3, flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IncomeRecordsPanel({ expenses, incomes, setDataPersist }) {
  const currentMonth = todayISO().slice(0, 7);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [newDraft, setNewDraft] = useState({ month: currentMonth, source: INCOME_SOURCES[0], amount: "" });

  const sorted = useMemo(
    () => [...incomes].sort((a, b) => b.month.localeCompare(a.month) || a.source.localeCompare(b.source)),
    [incomes]
  );

  const startEdit = (i) => { setConfirmId(null); setEditingId(i.id); setDraft({ ...i, amount: String(i.amount) }); };
  const cancelEdit = () => { setEditingId(null); setDraft(null); };
  const saveEdit = () => {
    if (!draft.month || !draft.source) return;
    const next = incomes.map((i) => (i.id === editingId
      ? { ...i, month: draft.month, source: draft.source, amount: Number(draft.amount) || 0 }
      : i));
    setDataPersist(expenses, next);
    cancelEdit();
  };
  const removeOne = (id) => {
    setDataPersist(expenses, incomes.filter((i) => i.id !== id));
    setConfirmId(null);
  };
  const addNew = () => {
    if (!newDraft.month || !newDraft.source || !newDraft.amount) return;
    const entry = { id: genId(), month: newDraft.month, source: newDraft.source, amount: Number(newDraft.amount) || 0 };
    setDataPersist(expenses, [...incomes, entry]);
    setNewDraft({ ...newDraft, amount: "" });
  };

  return (
    <div>
      <div style={{ border: "1px dashed #D8CBAE", borderRadius: 10, padding: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#8A8072", fontWeight: 700, marginBottom: 8 }}>新增一筆收入</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          <input type="month" value={newDraft.month} onChange={(e) => setNewDraft({ ...newDraft, month: e.target.value })} style={{ ...rowInput, flex: "1 1 110px" }} />
          <select value={newDraft.source} onChange={(e) => setNewDraft({ ...newDraft, source: e.target.value })} style={{ ...rowInput, flex: "1 1 90px" }}>
            {INCOME_SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <input type="number" placeholder="金額" value={newDraft.amount} onChange={(e) => setNewDraft({ ...newDraft, amount: e.target.value })} style={{ ...rowInput, width: 90, fontFamily: "'JetBrains Mono', monospace" }} />
        </div>
        <div style={{ fontSize: 11, color: "#A79C89", marginBottom: 8 }}>同一個月份 + 來源如果已存在，新增時會產生第二筆；如果只是想改金額，請直接編輯下面清單裡的那一筆。</div>
        <button onClick={addNew}
          style={{ width: "100%", background: STAMP, border: "none", color: "#fff", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={14} /> 新增這一筆
        </button>
      </div>

      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "16px 0", color: "#A79C89", fontSize: 12.5 }}>還沒有收入紀錄</div>
      )}

      {sorted.map((i) => {
        const editing = editingId === i.id;
        return (
          <div key={i.id} style={{ padding: "8px 0", borderBottom: "1px solid #F3ECDA" }}>
            {editing ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  <input type="month" value={draft.month} onChange={(ev) => setDraft({ ...draft, month: ev.target.value })} style={{ ...rowInput, flex: "1 1 110px" }} />
                  <select value={draft.source} onChange={(ev) => setDraft({ ...draft, source: ev.target.value })} style={{ ...rowInput, flex: "1 1 90px" }}>
                    {INCOME_SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                  <input type="number" value={draft.amount} onChange={(ev) => setDraft({ ...draft, amount: ev.target.value })} style={{ ...rowInput, width: 90, fontFamily: "'JetBrains Mono', monospace" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveEdit}
                    style={{ flex: 1, background: GOOD, border: "none", color: "#fff", borderRadius: 8, padding: "7px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <Check size={13} /> 儲存
                  </button>
                  <button onClick={cancelEdit}
                    style={{ flex: 1, background: "#fff", border: "1px solid #D8CBAE", color: "#8A8072", borderRadius: 8, padding: "7px 0", fontSize: 12.5, cursor: "pointer" }}>
                    取消
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, fontSize: 13 }}>{i.month} · {i.source}</div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: GOOD, flexShrink: 0 }}>${fmt(i.amount)}</span>
                <button onClick={() => startEdit(i)} style={{ background: "none", border: "none", color: "#B8AC91", cursor: "pointer", padding: 3, flexShrink: 0 }}>
                  <Pencil size={13} />
                </button>
                {confirmId === i.id ? (
                  <button onClick={() => removeOne(i.id)} style={{ background: STAMP, color: "#fff", border: "none", borderRadius: 6, padding: "4px 6px", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>確定</button>
                ) : (
                  <button onClick={() => setConfirmId(i.id)} style={{ background: "none", border: "none", color: "#D8CBAE", cursor: "pointer", padding: 3, flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function toNumber(cell) {
  if (typeof cell === "number" && !Number.isNaN(cell)) return cell;
  if (typeof cell === "string" && cell.trim() !== "" && !Number.isNaN(Number(cell))) return Number(cell);
  return null;
}

function normalizeDate(cell) {
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  if (typeof cell === "string") {
    const m = cell.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  if (typeof cell === "number") {
    const d = XLSX.SSF.parse_date_code(cell);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}
