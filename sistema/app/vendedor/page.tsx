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
  const [leads, setLeads] = useState<any[]>([]);
  const [porStatus, setPorStatus] = useState<Record<string, number>>({});
  const [leadForm, setLeadForm] = useState({ nomeCondominio: "", contato: "", telefone: "", cidade: "", observacao: "" });
  const [criandoLead, setCriandoLead] = useState(false);
  const [msgLead, setMsgLead] = useState("");
  const [avisos, setAvisos] = useState<any[]>([]);
  const [naoLidos, setNaoLidos] = useState(0);
  const [pixChave, setPixChave] = useState("");
  const [pixSalvo, setPixSalvo] = useState("");
  const [salvandoPix, setSalvandoPix] = useState(false);
  const [msgPix, setMsgPix] = useState("");
  const [filtroExtrato, setFiltroExtrato] = useState("todos");

  async function carregarLeads() {
    try {
      const r = await fetch("/api/vendedor/leads");
      const d = await r.json();
      if (d.ok) {
        setLeads(d.leads);
        setPorStatus(d.porStatus || {});
      }
    } catch {}
  }

  async function carregarAvisos() {
    try {
      const r = await fetch("/api/vendedor/avisos");
      const d = await r.json();
      if (d.ok) {
        setAvisos(d.avisos);
        setNaoLidos(d.naoLidos || 0);
      }
    } catch {}
  }

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fetch("/api/vendedor/estado");
      const d = await r.json();
      if (d.ok) {
        setAutenticado(true);
        setEstado(d);
        setPixChave(d.vendedor?.pixChave || "");
        await Promise.all([carregarLeads(), carregarAvisos()]);
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

  async function criarLead(e: React.FormEvent) {
    e.preventDefault();
    setMsgLead("");
    if (!leadForm.nomeCondominio.trim()) {
      setMsgLead("Informe o nome do condomínio.");
      return;
    }
    setCriandoLead(true);
    try {
      const res = await fetch("/api/vendedor/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadForm),
      });
      const d = await res.json();
      if (!d.ok) {
        setMsgLead(d.erro || "Não foi possível adicionar.");
        return;
      }
      setLeadForm({ nomeCondominio: "", contato: "", telefone: "", cidade: "", observacao: "" });
      await carregarLeads();
    } catch {
      setMsgLead("Falha de conexão. Tente novamente.");
    } finally {
      setCriandoLead(false);
    }
  }

  async function mudarStatusLead(id: string, status: string) {
    try {
      const res = await fetch("/api/vendedor/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const d = await res.json();
      if (d.ok) await carregarLeads();
    } catch {}
  }

  async function excluirLead(id: string, nome: string) {
    if (!window.confirm(`Excluir o lead ${nome}?`)) return;
    try {
      const res = await fetch("/api/vendedor/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await res.json();
      if (d.ok) await carregarLeads();
    } catch {}
  }

  async function marcarAvisosLidos() {
    try {
      const res = await fetch("/api/vendedor/avisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "marcarLidas" }),
      });
      const d = await res.json();
      if (d.ok) await carregarAvisos();
    } catch {}
  }

  async function salvarPix(e: React.FormEvent) {
    e.preventDefault();
    setMsgPix("");
    setPixSalvo("");
    setSalvandoPix(true);
    try {
      const res = await fetch("/api/vendedor/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixChave }),
      });
      const d = await res.json();
      if (!d.ok) {
        setMsgPix(d.erro || "Não foi possível salvar.");
        return;
      }
      setPixSalvo("Chave Pix salva. É nela que o Robson vai pagar suas comissões.");
    } catch {
      setMsgPix("Falha de conexão. Tente novamente.");
    } finally {
      setSalvandoPix(false);
    }
  }

  const STATUS_LEAD_ROTULO: Record<string, string> = {
    novo: "A abordar",
    contatado: "Contatado",
    interessado: "Interessado",
    fechado: "Fechado",
    perdido: "Perdido",
  };
  const STATUS_LEAD_CLASSE: Record<string, string> = {
    novo: "cinza",
    contatado: "azul",
    interessado: "amber",
    fechado: "verde",
    perdido: "vermelha",
  };

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

      {avisos.length > 0 && (
        <div className="cartao" style={{ marginBottom: 16, borderLeft: naoLidos > 0 ? "4px solid #22a06b" : undefined }}>
          <div className="cartao-titulo">
            <h3>🔔 Avisos {naoLidos > 0 && <span className="etiqueta verde">{naoLidos} novo(s)</span>}</h3>
            {naoLidos > 0 && (
              <button className="btn secundario pequeno" type="button" onClick={marcarAvisosLidos} style={{ marginLeft: "auto" }}>
                Marcar como lidas
              </button>
            )}
          </div>
          {avisos.map((a: any) => (
            <div key={a.id} className="item-lista" style={{ opacity: a.lido ? 0.75 : 1 }}>
              <span className="chip-icone pequeno" style={{ background: a.tipo === "assinatura_ativa" ? "#dcfce7" : "#dbeafe" }}>
                {a.tipo === "assinatura_ativa" ? "✅" : "🏢"}
              </span>
              <div className="item-lista-corpo">
                <strong>{a.titulo}</strong>
                {a.detalhe && <div>{a.detalhe}</div>}
                <div className="item-meta">{dataBR(a.criadoEm)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

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
          <h3>🎯 Funil de prospecção</h3>
        </div>
        <p style={{ color: "#5b6b7d", margin: "4px 0 12px" }}>
          Anote os condomínios que você está abordando e acompanhe em que pé está cada um.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {(["novo", "contatado", "interessado", "fechado", "perdido"] as const).map((s) => (
            <span key={s} className={`etiqueta ${STATUS_LEAD_CLASSE[s]}`}>
              {STATUS_LEAD_ROTULO[s]}: {porStatus[s] || 0}
            </span>
          ))}
        </div>
        {msgLead && <div className="erro">{msgLead}</div>}
        <form onSubmit={criarLead} style={{ marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="campo" style={{ margin: 0 }}>
              <label>Condomínio *</label>
              <input
                placeholder="Nome do condomínio"
                value={leadForm.nomeCondominio}
                onChange={(e) => setLeadForm({ ...leadForm, nomeCondominio: e.target.value })}
              />
            </div>
            <div className="campo" style={{ margin: 0 }}>
              <label>Contato (síndico)</label>
              <input
                placeholder="Nome de quem você falou"
                value={leadForm.contato}
                onChange={(e) => setLeadForm({ ...leadForm, contato: e.target.value })}
              />
            </div>
            <div className="campo" style={{ margin: 0 }}>
              <label>Telefone / WhatsApp</label>
              <input
                placeholder="(21) 99999-9999"
                value={leadForm.telefone}
                onChange={(e) => setLeadForm({ ...leadForm, telefone: e.target.value })}
              />
            </div>
            <div className="campo" style={{ margin: 0 }}>
              <label>Cidade</label>
              <input
                placeholder="Ex.: Maricá - RJ"
                value={leadForm.cidade}
                onChange={(e) => setLeadForm({ ...leadForm, cidade: e.target.value })}
              />
            </div>
          </div>
          <div className="campo" style={{ marginTop: 8 }}>
            <label>Observação</label>
            <input
              placeholder="Ex.: pediu para ligar na segunda de manhã"
              value={leadForm.observacao}
              onChange={(e) => setLeadForm({ ...leadForm, observacao: e.target.value })}
            />
          </div>
          <button className="btn pequeno" type="submit" disabled={criandoLead}>
            {criandoLead ? "Adicionando..." : "+ Adicionar ao funil"}
          </button>
        </form>
        {leads.length === 0 ? (
          <p style={{ color: "#5b6b7d" }}>Nenhum condomínio no funil ainda. Adicione o primeiro acima.</p>
        ) : (
          leads.map((l: any) => (
            <div key={l.id} className="item-lista">
              <span className="chip-icone pequeno" style={{ background: "#e0e7ff" }}>🏢</span>
              <div className="item-lista-corpo">
                <strong>{l.nomeCondominio}</strong>
                <div>
                  {[l.contato, l.telefone, l.cidade].filter(Boolean).join(" · ")}
                </div>
                {l.observacao && <div style={{ color: "#5b6b7d" }}>💬 {l.observacao}</div>}
                <div className="item-meta">Adicionado em {dataBR(l.criadoEm)}</div>
              </div>
              <div className="item-lista-lado">
                <select
                  value={l.status}
                  onChange={(e) => mudarStatusLead(l.id, e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #dbe2ea", background: "#fff", fontSize: 14 }}
                >
                  {(["novo", "contatado", "interessado", "fechado", "perdido"] as const).map((s) => (
                    <option key={s} value={s}>{STATUS_LEAD_ROTULO[s]}</option>
                  ))}
                </select>
                <button className="btn secundario pequeno" type="button" onClick={() => excluirLead(l.id, l.nomeCondominio)}>
                  Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cartao">
        <div className="cartao-titulo">
          <h3>💳 Dados para recebimento</h3>
        </div>
        <p style={{ color: "#5b6b7d", margin: "4px 0 12px" }}>
          Cadastre a chave Pix onde o Robson vai pagar suas comissões.
        </p>
        {msgPix && <div className="erro">{msgPix}</div>}
        {pixSalvo && <div className="ok-msg">{pixSalvo}</div>}
        <form onSubmit={salvarPix}>
          <div className="campo">
            <label>Chave Pix</label>
            <input
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixChave}
              onChange={(e) => setPixChave(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={salvandoPix}>
            {salvandoPix ? "Salvando..." : "Salvar chave Pix"}
          </button>
        </form>
      </div>

      {estado?.extrato && estado.extrato.length > 0 && (
        <div className="cartao">
          <div className="cartao-titulo">
            <h3>📊 Extrato mês a mês</h3>
          </div>
          <p style={{ color: "#5b6b7d", margin: "4px 0 12px" }}>
            Quanto você ganhou e quanto falta receber, mês por mês, por condomínio.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              className={`btn pequeno ${filtroExtrato === "todos" ? "" : "secundario"}`}
              type="button"
              onClick={() => setFiltroExtrato("todos")}
            >
              Todos
            </button>
            <button
              className={`btn pequeno ${filtroExtrato === "ganho" ? "" : "secundario"}`}
              type="button"
              onClick={() => setFiltroExtrato("ganho")}
            >
              Já ganho
            </button>
            <button
              className={`btn pequeno ${filtroExtrato === "a_receber" ? "" : "secundario"}`}
              type="button"
              onClick={() => setFiltroExtrato("a_receber")}
            >
              A receber
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#5b6b7d", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 6px" }}>Mês</th>
                  <th style={{ padding: "8px 6px" }}>Condomínio</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Comissão</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {estado.extrato
                  .filter((x: any) => filtroExtrato === "todos" || x.status === filtroExtrato)
                  .slice(0, 60)
                  .map((x: any, i: number) => (
                    <tr key={`${x.condominioId}-${x.mes}-${i}`} style={{ borderBottom: "1px solid #eef2f7" }}>
                      <td style={{ padding: "10px 6px", fontWeight: 700, color: "#0b2a4a" }}>{x.mesRotulo}</td>
                      <td style={{ padding: "10px 6px" }}>{x.condominioNome}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700 }}>{brl(x.valor)}</td>
                      <td style={{ padding: "10px 6px" }}>
                        {x.status === "ganho" && <span className="etiqueta verde">Ganho</span>}
                        {x.status === "a_receber" && <span className="etiqueta azul">A receber</span>}
                        {x.status === "pendente" && <span className="etiqueta cinza">Em teste</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p style={{ color: "#5b6b7d", fontSize: 14, margin: "10px 0 0" }}>
            Mostrando até 60 linhas. "Em teste" é a projeção do condomínio que ainda está no período grátis.
          </p>
        </div>
      )}

      <div className="cartao">
        <div className="cartao-titulo">
          <h3>📚 Material de apoio</h3>
        </div>
        <p style={{ color: "#0b2a4a", fontWeight: 700, margin: "4px 0 6px" }}>O que é o CondoFree?</p>
        <p style={{ color: "#5b6b7d", margin: "0 0 10px" }}>
          Um sistema para condomínios pequenos (20 a 100 unidades) gerenciarem tudo em um link só, sem aplicativo: reserva de salão, mural de avisos, ocorrências com foto, cobranças com Pix e votação. São 14 dias grátis sem cartão, depois R$ 9,90 por mês nos primeiros 3 meses e R$ 97 por mês depois, sem fidelidade.
        </p>
        <p style={{ color: "#0b2a4a", fontWeight: 700, margin: "4px 0 6px" }}>Como abordar (guia rápido)</p>
        <ul style={{ color: "#5b6b7d", margin: "0 0 10px", paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Apresente-se como do CondoFree e explique em uma frase o que é.</li>
          <li>Fale o preço completo, sem esconder nada.</li>
          <li>Mensagem curta e consultiva, com uma pergunta — não um textão de venda.</li>
          <li>Espere a resposta; não insista depois de um não.</li>
          <li>Não invente benefício, preço ou depoimento que não existe.</li>
          <li>Se não souber responder, diga que vai verificar com o Robson.</li>
          <li>Se interessar, mande o seu link de indicação (o cadastro já nasce no seu nome).</li>
        </ul>
        <p style={{ color: "#5b6b7d", margin: "0 0 12px" }}>
          Site para apresentar: <strong>https://condofree.com.br</strong>
        </p>
        <a
          className="btn"
          href="https://wa.me/5521991512329?text=Ol%C3%A1%2C%20Robson!%20Sou%20vendedor(a)%20do%20CondoFree%20e%20preciso%20de%20ajuda."
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none", display: "inline-block" }}
        >
          💬 Falar com o Robson
        </a>
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
