"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminVendedores() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [dados, setDados] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", email: "", senha: "" });
  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [vinculando, setVinculando] = useState("");

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/vendedores");
      const d = await r.json();
      if (!d.ok) {
        setErro(d.erro || "Não foi possível carregar.");
        if (r.status === 401) router.replace("/");
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

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOk("");
    setCriando(true);
    try {
      const res = await fetch("/api/admin/vendedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: form.nome, email: form.email, senha: form.senha }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErro(d.erro || "Não foi possível criar o vendedor.");
        return;
      }
      setOk(`Vendedor ${d.vendedor.nome} criado! Código de indicação: ${d.vendedor.codigo}.`);
      setForm({ nome: "", email: "", senha: "" });
      await carregar();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCriando(false);
    }
  }

  async function alternarAtivo(id: string) {
    setErro("");
    try {
      const res = await fetch("/api/admin/vendedores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "alternarAtivo", id }),
      });
      const d = await res.json();
      if (!d.ok) setErro(d.erro || "Não foi possível alterar.");
      await carregar();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
  }

  async function vincular(condominioId: string, vendedorId: string) {
    setErro("");
    setVinculando(condominioId);
    try {
      const res = await fetch("/api/admin/vendedores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "vincular", condominioId, vendedorId: vendedorId || null }),
      });
      const d = await res.json();
      if (!d.ok) setErro(d.erro || "Não foi possível vincular.");
      await carregar();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setVinculando("");
    }
  }

  async function copiarLink(codigo: string) {
    const link = `${window.location.origin}/cadastro?ref=${codigo}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiado(codigo);
    setTimeout(() => setCopiado(""), 2000);
  }

  if (carregando && !dados) {
    return (
      <div className="login-wrap">
        <p style={{ textAlign: "center", color: "#5b6b7d" }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 64px" }}>
      <div className="tab-cabecalho">
        <span className="chip-icone" style={{ background: "#dcfce7" }}>💼</span>
        <div>
          <h2>Vendedores</h2>
          <p>Área do dono do CondoFree — crie logins de vendedor e vincule condomínios a quem fechou.</p>
        </div>
        <button className="btn secundario pequeno" type="button" onClick={() => router.push("/painel")} style={{ marginLeft: "auto" }}>
          Voltar ao painel
        </button>
      </div>

      {erro && <div className="erro">{erro}</div>}
      {ok && <div className="ok-msg">{ok}</div>}

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="cartao-titulo">
          <h3>➕ Novo vendedor</h3>
        </div>
        <form onSubmit={criar}>
          <div className="linha">
            <div className="campo">
              <label>Nome</label>
              <input
                placeholder="Nome do vendedor"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>E-mail (login)</label>
              <input
                type="email"
                placeholder="vendedor@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="campo">
              <label>Senha</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
              />
            </div>
          </div>
          <button className="btn" type="submit" disabled={criando}>
            {criando ? "Criando..." : "Criar vendedor"}
          </button>
          <p style={{ color: "#5b6b7d", fontSize: 14, margin: "10px 0 0" }}>
            O vendedor entra em <strong>app.condofree.com.br/vendedor</strong> com esse e-mail e senha. O código de indicação é gerado automaticamente.
          </p>
        </form>
      </div>

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="cartao-titulo">
          <h3>👥 Vendedores ({dados?.vendedores?.length || 0})</h3>
        </div>
        {!dados?.vendedores?.length ? (
          <p style={{ color: "#5b6b7d" }}>Nenhum vendedor criado ainda.</p>
        ) : (
          dados.vendedores.map((v: any) => (
            <div key={v.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 800, color: "#0b2a4a", fontSize: 17 }}>{v.nome}</div>
                  <div style={{ color: "#5b6b7d", fontSize: 14 }}>{v.email}</div>
                  <div style={{ color: "#5b6b7d", fontSize: 14 }}>
                    Código: <strong>{v.codigo}</strong> · {v.resumo.totalCondominios} condomínio(s) · Ganho {brl(v.resumo.totalGanho)} · A receber {brl(v.resumo.totalAReceber)}
                  </div>
                </div>
                <span className={`etiqueta ${v.ativo ? "verde" : "cinza"}`}>{v.ativo ? "Ativo" : "Inativo"}</span>
                <button className="btn secundario pequeno" type="button" onClick={() => copiarLink(v.codigo)}>
                  {copiado === v.codigo ? "✓ Link copiado!" : "Copiar link"}
                </button>
                <button className="btn secundario pequeno" type="button" onClick={() => alternarAtivo(v.id)}>
                  {v.ativo ? "Desativar" : "Reativar"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cartao">
        <div className="cartao-titulo">
          <h3>🏢 Condomínios e vendedor responsável</h3>
        </div>
        <p style={{ color: "#5b6b7d", margin: "4px 0 12px" }}>
          Vincule cada condomínio ao vendedor que o fechou. Quando o condomínio se cadastra pelo link de indicação, o vínculo já nasce automático.
        </p>
        {!dados?.condominios?.length ? (
          <p style={{ color: "#5b6b7d" }}>Nenhum condomínio cadastrado ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#5b6b7d", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 6px" }}>Condomínio</th>
                  <th style={{ padding: "8px 6px" }}>Unidades</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                  <th style={{ padding: "8px 6px" }}>Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {dados.condominios.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #eef2f7" }}>
                    <td style={{ padding: "10px 6px", fontWeight: 700, color: "#0b2a4a" }}>{c.nome}</td>
                    <td style={{ padding: "10px 6px" }}>{c.unidades}</td>
                    <td style={{ padding: "10px 6px" }}>
                      <span className={`etiqueta ${c.assinaturaStatus === "ativa" ? "verde" : c.assinaturaStatus === "trial" ? "azul" : "vermelha"}`}>
                        {c.assinaturaStatus === "ativa" ? "Assinatura ativa" : c.assinaturaStatus === "trial" ? "Em teste grátis" : c.assinaturaStatus}
                      </span>
                    </td>
                    <td style={{ padding: "10px 6px" }}>
                      <select
                        value={c.vendedorId || ""}
                        disabled={vinculando === c.id}
                        onChange={(e) => vincular(c.id, e.target.value)}
                        style={{ maxWidth: 220 }}
                      >
                        <option value="">— Sem vendedor —</option>
                        {dados.vendedores.map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.nome}
                          </option>
                        ))}
                      </select>
                    </td>
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
