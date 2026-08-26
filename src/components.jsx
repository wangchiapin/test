import React from "react";
import { GOOD, STAMP, fmt } from "./lib.js";

export function CatDot({ color, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

export function StampBadge({ value, size = 108 }) {
  const positive = value >= 0;
  const color = positive ? GOOD : STAMP;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        border: `2.5px double ${color}`,
        color, opacity: 0.94,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        transform: "rotate(-9deg)", fontFamily: "'Noto Serif TC', serif",
        flexShrink: 0, background: "rgba(255,255,255,0.25)",
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: 3, marginBottom: 2 }}>本月損益</span>
      <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
        {positive ? "+" : "－"}{fmt(Math.abs(value))}
      </span>
    </div>
  );
}

export function Tile({ label, value, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "12px 8px", textAlign: "center", border: "1px solid #ECE1C9" }}>
      <div style={{ fontSize: 11, color: "#A79C89", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color }}>${fmt(value)}</div>
    </div>
  );
}

export const fieldLabel = { display: "block", fontSize: 11.5, color: "#8A8072", fontWeight: 700, letterSpacing: 0.5, margin: "0 2px 6px" };
export const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #E0D5BC", borderRadius: 12, padding: "10px 12px", fontSize: 14, marginBottom: 14, background: "#fff", color: "#2B2620" };
export const thStyle = { padding: "6px 8px", textAlign: "right", color: "#8A8072", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid #ECE1C9" };
export const tdStyle = { padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap", borderBottom: "1px solid #F3ECDA", fontFamily: "'JetBrains Mono', monospace" };
