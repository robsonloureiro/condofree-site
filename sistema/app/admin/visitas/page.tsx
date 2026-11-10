"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ROTULOS: { id: "sindico" | "morador" | "vendedor" | "visitante"; rotulo: string; icone: string }[] = [
  { id: "sindico", rotulo: "Síndicos", icone: "🏢" },
  { id: "morador", rotulo: "Moradores", icone: "🏠" },
  { id: "vendedor", rotulo: "Vendedores", icone: "💼" },
  { id: "visitante", rotulo: "Visitantes", icone: "👀" },
];

function dataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function AdminVisitas() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<any>(null);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/visitas");
      const d = await r.json();
      if (!d.ok) {
        setErro(d.erro || "Não foi possível carregar.");
        if (r.status === 401) router.replace("/?next=/admin/visitas");
        return;
      }
      setDados(d);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  if (carregando && !dados) {
    return (
      <div className="login-wrap">
        <p style={{ textAlign: "center", color: "#5b6b7d" }}>Carregando...</p>
      </div>
    );
  }

  const porPapel = dados?.porPapel || {};
  const geral = dados?.geral || { hoje: 0, ultimos7: 0, ultimos30: 0, total: 0 };
  const porDia = dados?.porDia || [];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 64px" }}>
      <div className="tab-cabecalho">
        <span className="chip-icone" style={{ background: "#dbeafe" }}>📊</span>
        <div>
          <h2>Visitas</h2>
          <p>Quantas pessoas visitam o site e o sistema, por papel. Uma visita = uma pessoa por dia.</p>
        </div>
        <button className="btn secundario pequeno" type="button" onClick={() => router.push("/admin/vendedores")} style={{ marginLeft: "auto" }}>
          Vendedores
        </button>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="cartao-titulo">
          <h3>📈 Resumo — {geral.total} visitas no total</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {ROTULOS.map((p) => {
            const t = porPapel[p.id] || { hoje: 0, ultimos7: 0, ultimos30: 0, total: 0 };
            return (
              <div key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 800, color: "#0b2a4a", fontSize: 16 }}>
                  {p.icone} {p.rotulo}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#0b2a4a", margin: "6px 0 2px" }}>{t.total}</div>
                <div style={{ fontSize: 14, color: "#5b6b7d" }}>no total</div>
                <div style={{ fontSize: 14, color: "#334155", marginTop: 8 }}>
                  Hoje: <strong>{t.hoje}</strong> · 7 dias: <strong>{t.ultimos7}</strong> · 30 dias: <strong>{t.ultimos30}</strong>
                </div>
              </div>
            );
          })}
          <div style={{ border: "1px solid #0b2a4a", borderRadius: 12, padding: 14, background: "#0b2a4a", color: "#fff" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>👥 Todos</div>
            <div style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 2px" }}>{geral.total}</div>
            <div style={{ fontSize: 14, opacity: 0.85 }}>no total</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>
              Hoje: <strong>{geral.hoje}</strong> · 7 dias: <strong>{geral.ultimos7}</strong> · 30 dias: <strong>{geral.ultimos30}</strong>
            </div>
          </div>
        </div>
        <p style={{ color: "#5b6b7d", fontSize: 13, margin: "12px 0 0" }}>
          Visitante é quem acessa sem login (principalmente a página de vendas). Síndico, morador e vendedor são quem entra logado no sistema. Não guardamos IP nem dado pessoal de ninguém.
        </p>
      </div>

      <div className="cartao">
        <div className="cartao-titulo">
          <h3>📅 Por dia — últimos 30 dias</h3>
        </div>
        {!porDia.length ? (
          <p style={{ color: "#5b6b7d" }}>Nenhuma visita registrada ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#5b6b7d", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 6px" }}>Dia</th>
                  <th style={{ padding: "8px 6px" }}>Síndicos</th>
                  <th style={{ padding: "8px 6px" }}>Moradores</th>
                  <th style={{ padding: "8px 6px" }}>Vendedores</th>
                  <th style={{ padding: "8px 6px" }}>Visitantes</th>
                  <th style={{ padding: "8px 6px" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {[...porDia].reverse().map((d: any) => (
                  <tr key={d.data} style={{ borderBottom: "1px solid #eef2f7" }}>
                    <td style={{ padding: "10px 6px", fontWeight: 700, color: "#0b2a4a" }}>{dataBR(d.data)}</td>
                    <td style={{ padding: "10px 6px" }}>{d.sindico}</td>
                    <td style={{ padding: "10px 6px" }}>{d.morador}</td>
                    <td style={{ padding: "10px 6px" }}>{d.vendedor}</td>
                    <td style={{ padding: "10px 6px" }}>{d.visitante}</td>
                    <td style={{ padding: "10px 6px", fontWeight: 800 }}>{d.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
