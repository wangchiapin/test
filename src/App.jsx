import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus, ChevronLeft, ChevronRight, BarChart3, BookText,
  LineChart as LineChartIcon, Search as SearchIcon, Settings as SettingsIcon, LogOut, Home, Sparkles,
} from "lucide-react";
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import {
  DEFAULT_CATEGORIES, INK, PAPER, PAPER_DEEP, STAMP,
  todayISO, monthKeyOf, genId, monthLabel, shiftMonth, catMapOf, computeMonthStats,
  sha256Hex, DEFAULT_STATS_PASSWORD_HASH_PROMISE,
} from "./lib.js";
import { StampBadge } from "./components.jsx";
import LedgerTab from "./LedgerTab.jsx";
import StatsTab from "./StatsTab.jsx";
import ChartsTab from "./ChartsTab.jsx";
import SearchTab from "./SearchTab.jsx";
import AITab from "./AITab.jsx";
import AddExpenseSheet from "./AddExpenseSheet.jsx";
import SettingsModal from "./SettingsModal.jsx";

const DEFAULT_AI_SETTINGS = { apiKey: "", model: "gemini-flash-latest" };

// ---------- login screen ----------

function LoginScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans TC', sans-serif", padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700;900&family=Noto+Sans+TC:wght@400;500;700&display=swap');`}</style>
      <form onSubmit={submit} style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid #ECE1C9" }}>
        <h1 style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 22, fontWeight: 900, margin: "0 0 4px", color: INK }}>生活帳本</h1>
        <p style={{ fontSize: 12, color: "#8A8072", margin: "0 0 20px" }}>{mode === "signin" ? "登入你的帳本" : "建立你的帳本帳號（僅需一次）"}</p>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0D5BC", borderRadius: 12, padding: "11px 12px", fontSize: 14, marginBottom: 10 }} />
        <input type="password" required placeholder="密碼（至少 6 碼）" value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0D5BC", borderRadius: 12, padding: "11px 12px", fontSize: 14, marginBottom: 14 }} />
        {error && <div style={{ color: STAMP, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "none", background: STAMP, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {busy ? "處理中…" : mode === "signin" ? "登入" : "建立帳號"}
        </button>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          style={{ width: "100%", background: "none", border: "none", color: "#8A8072", fontSize: 12, marginTop: 12, cursor: "pointer" }}>
          {mode === "signin" ? "第一次使用？建立帳號" : "已經有帳號？登入"}
        </button>
      </form>
    </div>
  );
}

// ---------- main app ----------

const TABS = [
  ["ledger", "記帳", BookText],
  ["stats", "統計", BarChart3],
  ["charts", "圖表", LineChartIcon],
  ["search", "搜尋", SearchIcon],
  ["ai", "AI", Sparkles],
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [aiSettings, setAiSettings] = useState(DEFAULT_AI_SETTINGS);
  const [monthlyNotes, setMonthlyNotes] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [viewMonth, setViewMonth] = useState(monthKeyOf(todayISO()));
  const [tab, setTab] = useState("ledger");
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState("categories");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingIncomeSrc, setEditingIncomeSrc] = useState(null);
  const [incomeDraft, setIncomeDraft] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [statsPasswordHash, setStatsPasswordHash] = useState(null); // null = use default "0000"
  const [statsUnlocked, setStatsUnlocked] = useState(false);
  const initializedMonth = useRef(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "ledgers", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() || {};
        setExpenses(data.expenses || []);
        setIncomes(data.incomes || []);
        setCategories(data.categories && data.categories.length ? data.categories : DEFAULT_CATEGORIES);
        setAiSettings(data.ai ? { ...DEFAULT_AI_SETTINGS, ...data.ai } : DEFAULT_AI_SETTINGS);
        setMonthlyNotes(data.monthlyNotes || []);
        setStatsPasswordHash(data.statsPasswordHash || null);
        if (!initializedMonth.current && (data.expenses || []).length) {
          const dates = data.expenses.map((e) => e.date).sort();
          setViewMonth(monthKeyOf(dates[dates.length - 1]));
          initializedMonth.current = true;
        }
        setDataLoaded(true);
      },
      () => setSaveError(true)
    );
    return unsub;
  }, [user]);

  const persist = useCallback(async (patch) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "ledgers", user.uid), { ...patch, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      setSaveError(true);
    }
  }, [user]);

  const verifyStatsPassword = async (attempt) => {
    const attemptHash = await sha256Hex(attempt);
    const targetHash = statsPasswordHash || (await DEFAULT_STATS_PASSWORD_HASH_PROMISE);
    if (attemptHash === targetHash) {
      setStatsUnlocked(true);
      return true;
    }
    return false;
  };

  const setStatsPasswordPersist = async (newPlainPassword) => {
    const hash = await sha256Hex(newPlainPassword);
    setStatsPasswordHash(hash);
    persist({ statsPasswordHash: hash });
  };

  const addExpense = (entry) => {
    const next = [...expenses, { id: genId(), ...entry }];
    setExpenses(next);
    persist({ expenses: next });
    setShowAdd(false);
  };
  const deleteExpense = (id) => {
    const next = expenses.filter((e) => e.id !== id);
    setExpenses(next);
    persist({ expenses: next });
    setConfirmDeleteId(null);
  };
  const updateExpense = (id, patch) => {
    const next = expenses.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setExpenses(next);
    persist({ expenses: next });
    setEditingExpense(null);
  };
  const getIncomeAmount = (month, source) =>
    incomes.find((i) => i.month === month && i.source === source)?.amount || 0;
  const saveIncome = (month, source, amount) => {
    const others = incomes.filter((i) => !(i.month === month && i.source === source));
    const next = amount !== 0 ? [...others, { id: genId(), month, source, amount }] : others;
    setIncomes(next);
    persist({ incomes: next });
    setEditingIncomeSrc(null);
  };
  const setCategoriesPersist = (next) => {
    setCategories(next);
    persist({ categories: next });
  };
  const setAiSettingsPersist = (next) => {
    setAiSettings(next);
    persist({ ai: next });
  };
  const setDataPersist = (nextExpenses, nextIncomes) => {
    setExpenses(nextExpenses);
    setIncomes(nextIncomes);
    persist({ expenses: nextExpenses, incomes: nextIncomes });
  };

  const addMonthlyNote = (month, text) => {
    if (!text.trim()) return;
    const next = [...monthlyNotes, { id: genId(), month, text: text.trim(), createdAt: Date.now() }];
    setMonthlyNotes(next);
    persist({ monthlyNotes: next });
  };
  const updateMonthlyNote = (id, text) => {
    const next = monthlyNotes.map((n) => (n.id === id ? { ...n, text: text.trim() } : n));
    setMonthlyNotes(next);
    persist({ monthlyNotes: next });
  };
  const deleteMonthlyNote = (id) => {
    const next = monthlyNotes.filter((n) => n.id !== id);
    setMonthlyNotes(next);
    persist({ monthlyNotes: next });
  };

  const switchTab = useCallback((key) => {
    setTab(key);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }, []);

  const goHome = useCallback(() => {
    setTab("ledger");
    setViewMonth(monthKeyOf(todayISO()));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }, []);

  const catMap = useMemo(() => catMapOf(categories), [categories]);
  const monthStats = useMemo(() => computeMonthStats(expenses, incomes, categories, viewMonth), [expenses, incomes, categories, viewMonth]);

  if (user === undefined) {
    return <div style={{ minHeight: "100vh", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", color: INK }}>載入中…</div>;
  }
  if (user === null) return <LoginScreen />;
  if (!dataLoaded) {
    return <div style={{ minHeight: "100vh", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", color: INK }}>載入帳本中…</div>;
  }

  const { tw, greg } = monthLabel(viewMonth);

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: "'Noto Sans TC', sans-serif", paddingBottom: 96 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500;700;900&family=Noto+Sans+TC:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .lg-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .lg-scroll::-webkit-scrollbar-thumb { background: #D8CBAE; border-radius: 4px; }
        button { font-family: inherit; }
        input, select { font-family: inherit; }
        .app-header, .app-content { max-width: 440px; margin: 0 auto; padding: 0 16px; }
        @media (min-width: 760px) {
          .app-content.app-content--wide { max-width: 1120px; }
        }
      `}</style>

      <div className="app-header">
        <div style={{ position: "sticky", top: 0, zIndex: 15, background: PAPER, paddingTop: 20, paddingBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={goHome} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }} aria-label="回主頁（當月）">
              <h1 style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: 1, color: INK }}>生活帳本</h1>
              <p style={{ fontSize: 12, color: "#8A8072", margin: "2px 0 0" }}>{user.email}</p>
            </button>
            <StampBadge value={monthStats.balance} size={86} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginBottom: 10 }}>
            <button onClick={goHome} style={{ background: "none", border: "none", color: "#B8AC91", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <Home size={13} /> 回主頁（當月）
            </button>
            <button onClick={() => { setSettingsSection("categories"); setShowSettings(true); }} style={{ background: "none", border: "none", color: "#B8AC91", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <SettingsIcon size={13} /> 設定
            </button>
            <button onClick={() => signOut(auth)} style={{ background: "none", border: "none", color: "#B8AC91", fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <LogOut size={13} /> 登出
            </button>
          </div>

          {saveError && (
            <div style={{ background: "#F7E3D9", border: "1px solid #E0B49A", borderRadius: 10, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>
              雲端同步時發生問題，請確認網路連線或 Firebase 設定。
            </div>
          )}

          <div style={{ background: PAPER_DEEP, borderRadius: 16, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button onClick={() => setViewMonth((m) => shiftMonth(m, -1))} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: INK }}>
              <ChevronLeft size={20} />
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 700, fontSize: 16 }}>{tw}</div>
              <div style={{ fontSize: 11, color: "#8A8072", fontFamily: "'JetBrains Mono', monospace" }}>{greg}</div>
            </div>
            <button onClick={() => setViewMonth((m) => shiftMonth(m, 1))} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: INK }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div style={{ display: "flex", background: PAPER_DEEP, borderRadius: 999, padding: 4, marginBottom: 10, gap: 4 }}>
            {TABS.map(([key, label, Icon]) => (
              <button key={key} onClick={() => switchTab(key)}
                style={{
                  flex: 1, border: "none", cursor: "pointer", padding: "9px 0", borderRadius: 999,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: tab === key ? "#FFFFFF" : "transparent",
                  color: tab === key ? STAMP : "#8A8072",
                  fontWeight: tab === key ? 700 : 500, fontSize: 12,
                  boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all .15s",
                }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`app-content${(tab === "stats" || tab === "ledger") ? " app-content--wide" : ""}`}>
        {tab === "ledger" && (
          <LedgerTab
            expenses={expenses} incomes={incomes} categories={categories} catMap={catMap}
            monthStats={monthStats} viewMonth={viewMonth}
            confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId} deleteExpense={deleteExpense}
            editingIncomeSrc={editingIncomeSrc} setEditingIncomeSrc={setEditingIncomeSrc}
            incomeDraft={incomeDraft} setIncomeDraft={setIncomeDraft}
            getIncomeAmount={getIncomeAmount} saveIncome={saveIncome}
            onEdit={(entry) => setEditingExpense(entry)}
            monthlyNotes={monthlyNotes} addMonthlyNote={addMonthlyNote}
            updateMonthlyNote={updateMonthlyNote} deleteMonthlyNote={deleteMonthlyNote}
          />
        )}
        {tab === "stats" && (
          <StatsTab expenses={expenses} incomes={incomes} categories={categories} viewMonth={viewMonth} setViewMonth={setViewMonth} setTab={switchTab} monthlyNotes={monthlyNotes} unlocked={statsUnlocked} onUnlock={verifyStatsPassword} />
        )}
        {tab === "charts" && (
          <ChartsTab expenses={expenses} incomes={incomes} categories={categories} viewMonth={viewMonth} />
        )}
        {tab === "search" && (
          <SearchTab expenses={expenses} categories={categories} catMap={catMap} />
        )}
        {tab === "ai" && (
          <AITab
            expenses={expenses} incomes={incomes} categories={categories} viewMonth={viewMonth}
            aiSettings={aiSettings}
            onOpenSettings={() => { setSettingsSection("ai"); setShowSettings(true); }}
          />
        )}
      </div>

      {tab === "ledger" && (
        <button onClick={() => setShowAdd(true)} aria-label="新增支出"
          style={{
            position: "fixed", bottom: 24, right: "50%", transform: "translateX(190px)",
            width: 56, height: 56, borderRadius: "50%", background: STAMP, color: "#fff",
            border: "none", boxShadow: "0 6px 16px rgba(163,53,42,0.4)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20,
          }}>
          <Plus size={26} />
        </button>
      )}

      {(showAdd || editingExpense) && (
        <AddExpenseSheet
          viewMonth={viewMonth} categories={categories} initialEntry={editingExpense} aiSettings={aiSettings}
          onClose={() => { setShowAdd(false); setEditingExpense(null); }}
          onSubmit={(patch, id) => (id ? updateExpense(id, patch) : addExpense(patch))}
        />
      )}
      {showSettings && (
        <SettingsModal
          categories={categories} setCategoriesPersist={setCategoriesPersist}
          expenses={expenses} incomes={incomes} setDataPersist={setDataPersist}
          aiSettings={aiSettings} setAiSettingsPersist={setAiSettingsPersist}
          setStatsPasswordPersist={setStatsPasswordPersist}
          initialSection={settingsSection}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
