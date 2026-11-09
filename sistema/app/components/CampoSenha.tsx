"use client";
import { useState } from "react";

// Campo de senha com o olhinho para revelar/ocultar (mesmo padrão da tela
// de login: SVG cinza, nunca emoji).
export default function CampoSenha({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div className="campo">
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={mostrar ? "text" : "password"}
          placeholder={placeholder || ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setMostrar(!mostrar)}
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
          title={mostrar ? "Ocultar senha" : "Mostrar senha"}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7b8d",
            lineHeight: 1,
            padding: 4,
            display: "flex",
            alignItems: "center",
          }}
        >
          {mostrar ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}
