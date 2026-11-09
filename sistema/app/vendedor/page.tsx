"use client";
import { useEffect, useState } from "react";
import { LOGO_DATA_URI } from "../../lib/logo";
import CampoSenha from "../components/CampoSenha";

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dataBR(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function statusEtiqueta(status: string) {
  if (status === "ativa") return { texto: "Assinatura ativa", classe: "verde" };
  if (status === "trial") return { texto: "Em teste grátis", classe: "azul" };
  if (status === "cancelada") return { texto: "Cancelada", classe: "vermelha" };
  return { texto: "Encerrada", classe: "cinza" };
}

export default function PainelVendedor() {
  const [carregando, setCarregando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [estado, setEstado] = useState<any>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ email: "", senha: "" });
  const [copiado, setCopiado] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fetch("/api/vendedor/estado");
      const d = await r.json();
      if (d.ok) {
        setAutenticado(true);
        setEstado(d);
      } else {
        setAutenticado(false);
      }
    } catch {
      setAutenticado(false);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch("/api/vendedor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, senha: form.senha }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErro(d.erro || "Não foi possível entrar.");
        return;
      }
      await carregar();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function sair() {
    setSaindo(true);
    try {
      await fetch("/api/vendedor/login", { method: "DELETE" });
    } catch {
      // ignora
    } finally {
      setAutenticado(false);
      setEstado(null);
      setSaindo(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setMsgSenha("");
    setErro("");
    if (novaSenha.length < 6) {
      setMsgSenha("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setTrocandoSenha(true);
    try {
      const res = await fetch("/api/vendedor/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const d = await res.json();
      if (!d.ok) {
        setMsgSenha(d.erro || "Não foi possível trocar a senha.");
        return;
      }
      setMsgSenha("Senha trocada com sucesso.");
      setSenhaAtual("");
      setNovaSenha("");
    } catch {
      setMsgSenha("Falha de conexão. Tente novamente.");
    } finally {
      setTrocandoSenha(false);
    }
  }

  async function copiarLink() {
    if (!estado?.vendedor?.codigo) return;
    const link = `${window.location.origin}/cadastro?ref=${estado.vendedor.codigo}`;
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
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (carregando && !estado) {
    return (
      <div className="login-wrap">
        <p style={{ textAlign: "center", color: "#5b6b7d" }}>Carregando...</p>
      </div>
    );
  }

  if (!autenticado) {
    return (
      <div className="login-wrap">
        <div className="logo-grande">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_DATA_URI} alt="CondoFree" />
          <h1 style={{ color: "#0b2a4a", margin: "8px 0 0" }}>Área do vendedor</h1>
          <p style={{ color: "#5b6b7d", marginTop: 4 }}>
            Entre com o e-mail e a senha que o CondoFree criou para você e acompanhe seus condomínios e comissões.
          </p>
        </div>
        {erro && <div className="erro">{erro}</div>}
        <form onSubmit={entrar} className="cartao">
          <div className="campo">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="voce@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <CampoSenha
            label="Senha"
            placeholder="Sua senha"
            value={form.senha}
            onChange={(v) => setForm({ ...form, senha: v })}
          />
          <button className="btn" type="submit" disabled={carregando} style={{ width: "100%" }}>
            {carregando ? "Aguarde..." : "Entrar"}
          </button>
        </form>
        <p style={{ textAlign: "center", color: "#5b6b7d", fontSize: 14 }}>
          Você ganha 50% de cada mensalidade paga nos primeiros 24 meses de cada condomínio que fechar.
        </p>
      </div>
    );
  }

  const resumo = estado?.resumo;
  const vendedor = estado?.vendedor;
  const link = vendedor?.codigo ? `${typeof window !== "undefined" ? window.location.origin : ""}/cadastro?ref=${vendedor.codigo}` : "";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 64px" }}>
      <div className="tab-cabecalho">
        <span className="chip-icone" style={{ background: "#dcfce7" }}>💼</span>
        <div>
          <h2>Painel do vendedor</h2>
          <p>Olá, {vendedor?.nome} — acompanhe seus condomínios e suas comissões.</p>
        </div>
        <button className="btn secundario pequeno" type="button" onClick={sair} disabled={saindo} style={{ marginLeft: "auto" }}>
          {saindo ? "Saindo..." : "Sair"}
        </button>
      </div>

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="cartao-titulo">
          <h3>🔗 Seu link de indicação</h3>
        </div>
        <p style={{ color: "#5b6b7d", margin: "4px 0 10px" }}>
          Quando um condomínio se cadastra por este link, ele já nasce vinculado a você e a comissão passa a contar. Compartilhe este link ao apresentar o CondoFree.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ flex: 1, minWidth: 220, background: "#f1f5f9", borderRadius: 8, padding: "10px 12px", wordBreak: "break-all" }}>{link}</code>
          <button className="btn pequeno" type="button" onClick={copiarLink}>
            {copiado ? "✓ Copiado!" : "Copiar link"}
          </button>
        </div>
        <p style={{ color: "#5b6b7d", fontSize: 14, margin: "10px 0 0" }}>
          Código: <strong>{vendedor?.codigo}</strong> · Site para apresentar: https://condofree.com.br
        </p>
      </div>

      {resumo && (
        <div className="home-resumo">
          <div className="home-resumo-topo">
            <h3>Resumo das comissões</h3>
            <span>50% por 24 meses</span>
          </div>
          <div className="home-resumo-grade">
            <div className="home-resumo-item">
              <span className="icone" style={{ background: "#e0e7ff" }}>🏢</span>
              <div>
                <div className="num">{resumo.totalCondominios}</div>
                <div className="rot">Condomínio(s) fechado(s) ({resumo.condominiosAtivos} ativo(s))</div>
              </div>
            </div>
            <div className="home-resumo-item destaque">
              <span className="icone" style={{ background: "#dcfce7" }}>💰</span>
              <div>
                <div className="num">{brl(resumo.totalGanho)}</div>
                <div className="rot">Total já ganho</div>
              </div>
            </div>
            <div className="home-resumo-item">
              <span className="icone" style={{ background: "#dbeafe" }}>⏳</span>
              <div>
                <div className="num">{brl(resumo.totalAReceber)}</div>
                <div className="rot">Total a receber ({resumo.parcelasAReceber} parcela(s) restante(s))</div>
              </div>
            </div>
            <div className="home-resumo-item">
              <span className="icone" style={{ background: "#fef3c7" }}>📈</span>
              <div>
                <div className="num">{brl(resumo.totalGeral)}</div>
                <div className="rot">Total geral (ganho + a receber)</div>
              </div>
            </div>
          </div>
          <p style={{ color: "#5b6b7d", fontSize: 14, margin: "12px 0 0" }}>
            A comissão é 50% de cada mensalidade paga, nos primeiros 24 meses de cada condomínio. Condomínio em teste grátis ainda não gera comissão; se cancelar, as parcelas futuras param.
          </p>
        </div>
      )}

      <div className="cartao">
        <div className="cartao-titulo">
          <h3>📋 Portfólio de assinantes</h3>
        </div>
        {!resumo || resumo.condominios.length === 0 ? (
          <p style={{ color: "#5b6b7d" }}>
            Você ainda não tem condomínios vinculados. Compartilhe seu link de indicação para que os cadastros já nasçam no seu nome.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#5b6b7d", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 6px" }}>Condomínio</th>
                  <th style={{ padding: "8px 6px" }}>Desde</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Comissão/mês</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Ganho</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>A receber</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {resumo.condominios.map((c: any) => {
                  const st = statusEtiqueta(c.status);
                  return (
                    <tr key={c.condominioId} style={{ borderBottom: "1px solid #eef2f7" }}>
                      <td style={{ padding: "10px 6px", fontWeight: 700, color: "#0b2a4a" }}>{c.nome}</td>
                      <td style={{ padding: "10px 6px" }}>{dataBR(c.assinaturaInicio || c.criadoEm)}</td>
                      <td style={{ padding: "10px 6px" }}>
                        <span className={`etiqueta ${st.classe}`}>{st.texto}</span>
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right" }}>{brl(c.comissaoMensalAtual)}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700 }}>{brl(c.ganho)}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right" }}>{brl(c.aReceber)}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700 }}>{brl(c.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="cartao">
        <div className="cartao-titulo">
          <h3>🔒 Trocar senha</h3>
        </div>
        <p style={{ color: "#5b6b7d", margin: "4px 0 12px" }}>
          Troque sua senha de acesso ao painel do vendedor quando quiser.
        </p>
        {msgSenha && (
          <div className={msgSenha.includes("sucesso") ? "ok-msg" : "erro"}>{msgSenha}</div>
        )}
        <form onSubmit={trocarSenha}>
          <CampoSenha
            label="Senha atual"
            placeholder="Sua senha atual"
            value={senhaAtual}
            onChange={setSenhaAtual}
          />
          <CampoSenha
            label="Nova senha"
            placeholder="Mínimo 6 caracteres"
            value={novaSenha}
            onChange={setNovaSenha}
          />
          <button className="btn" type="submit" disabled={trocandoSenha}>
            {trocandoSenha ? "Salvando..." : "Trocar senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
