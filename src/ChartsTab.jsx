import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { STAMP, GOOD, PAPER_DEEP, twYear, fmt, computeMonthStats, monthKeyOf } from "./lib.js";

export default function ChartsTab({ expenses, incomes, categories, viewMonth }) {
  const [barMonth, setBarMonth] = useState(viewMonth);

  const availableMonths = useMemo(() => {
    const set = new Set(expenses.map((e) => monthKeyOf(e.date)));
    set.add(viewMonth);
    return Array.from(set).sort();
  }, [expenses, viewMonth]);

  const availableYears = useMemo(() => {
    const set = new Set(availableMonths.map((mk) => twYear(mk.split("-")[0])));
    return Array.from(set).sort((a, b) => a - b);
  }, [availableMonths]);

  const [lineYear, setLineYear] = useState(availableYears[availableYears.length - 1]);
  const effectiveLineYear = availableYears.includes(lineYear) ? lineYear : availableYears[availableYears.length - 1];

  const barData = useMemo(() => {
    const s = computeMonthStats(expenses, incomes, categories, barMonth);
    return categories
      .map((c) => ({ name: c.name, id: c.id, amount: s.categoryTotals[c.id] || 0, color: c.color }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, incomes, categories, barMonth]);

  const lineData = useMemo(() => {
    const gregYear = Number(effectiveLineYear) + 1911;
    return Array.from({ length: 12 }, (_, i) => {
      const mk = `${gregYear}-${String(i + 1).padStart(2, "0")}`;
      const s = computeMonthStats(expenses, incomes, categories, mk);
      return { name: `${i + 1}月`, 支出: s.netExpense, 收入: s.incomeTotal };
    });
  }, [expenses, incomes, categories, effectiveLineYear]);

  const allTimeData = useMemo(() => {
    return availableMonths.map((mk) => {
      const s = computeMonthStats(expenses, incomes, categories, mk);
      return { name: `${twYear(mk.split("-")[0])}/${Number(mk.split("-")[1])}`, 支出: s.netExpense, 收入: s.incomeTotal };
    });
  }, [availableMonths, expenses, incomes, categories]);

  const selectStyle = { border: "1px solid #E0D5BC", borderRadius: 10, padding: "6px 10px", fontSize: 13, background: "#fff", color: "#2B2620" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A8072", letterSpacing: 1 }}>單月分類支出</div>
          <select value={barMonth} onChange={(e) => setBarMonth(e.target.value)} style={selectStyle}>
            {availableMonths.map((mk) => (
              <option key={mk} value={mk}>{twYear(mk.split("-")[0])}年{Number(mk.split("-")[1])}月</option>
            ))}
          </select>
        </div>
        {barData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "#A79C89", fontSize: 13 }}>這個月還沒有支出資料</div>
        ) : (
          <div style={{ width: "100%", height: Math.max(180, barData.length * 34) }}>
            <ResponsiveContainer>
              <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#EFE7D4" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#8A8072" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#5C5343" }} axisLine={false} tickLine={false} width={56} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #ECE1C9" }} formatter={(v) => `$${fmt(v)}`} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {barData.map((d) => (<Cell key={d.id} fill={d.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A8072", letterSpacing: 1 }}>年度每月收支趨勢</div>
          <select value={effectiveLineYear} onChange={(e) => setLineYear(Number(e.target.value))} style={selectStyle}>
            {availableYears.map((y) => (<option key={y} value={y}>民國 {y} 年</option>))}
          </select>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={lineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#EFE7D4" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A8072" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#8A8072" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #ECE1C9" }} formatter={(v) => `$${fmt(v)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="支出" stroke={STAMP} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="收入" stroke={GOOD} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #ECE1C9" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#8A8072", letterSpacing: 1, marginBottom: 10 }}>全期間每月收支趨勢（有資料以來）</div>
        {allTimeData.length < 2 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "#A79C89", fontSize: 13 }}>資料還太少，累積幾個月後這裡會出現趨勢圖</div>
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={allTimeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EFE7D4" />
                <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: "#8A8072" }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(allTimeData.length / 10) - 1)} />
                <YAxis tick={{ fontSize: 10, fill: "#8A8072" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #ECE1C9" }} formatter={(v) => `$${fmt(v)}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="支出" stroke={STAMP} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="收入" stroke={GOOD} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
