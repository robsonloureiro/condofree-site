"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_DATA_URI, LOGIN_BG_DATA_URI } from "../../lib/logo";

type Aba = "inicio" | "reservas" | "avisos" | "ocorrencias" | "boletos" | "financeiro" | "votacoes" | "moradores" | "funcionarios" | "plano" | "ajuda";

const MODULOS: { id: Aba; rotulo: string; icone: string; papeis: ("sindico" | "morador")[] }[] = [
  { id: "inicio", rotulo: "Início", icone: "🏠", papeis: ["sindico", "morador"] },
  { id: "reservas", rotulo: "Reservas", icone: "📅", papeis: ["sindico", "morador"] },
  { id: "avisos", rotulo: "Avisos", icone: "📢", papeis: ["sindico", "morador"] },
  { id: "ocorrencias", rotulo: "Ocorrências", icone: "🔧", papeis: ["sindico", "morador"] },
  { id: "boletos", rotulo: "Cobranças", icone: "🧾", papeis: ["sindico", "morador"] },
  { id: "financeiro", rotulo: "Financeiro", icone: "💰", papeis: ["sindico", "morador"] },
  { id: "votacoes", rotulo: "Votações", icone: "🗳️", papeis: ["sindico", "morador"] },
  { id: "moradores", rotulo: "Moradores", icone: "👥", papeis: ["sindico"] },
  { id: "funcionarios", rotulo: "Funcionários", icone: "👔", papeis: ["sindico"] },
  { id: "plano", rotulo: "Plano e FAQ", icone: "⭐", papeis: ["sindico", "morador"] },
  { id: "ajuda", rotulo: "Ajuda", icone: "❓", papeis: ["sindico", "morador"] },
];

const WHATS = "https://wa.me/5521991512329";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dataBR(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function Painel() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("inicio");
  const [estado, setEstado] = useState<any>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [gaveta, setGaveta] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editandoMorador, setEditandoMorador] = useState<any>(null);
  const [copiadoInicio, setCopiadoInicio] = useState(false);
  async function copiarCodigoInicio() {
    if (!estado?.condominio?.codigoConvite) return;
    try {
      await navigator.clipboard.writeText(estado.condominio.codigoConvite);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = estado.condominio.codigoConvite;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiadoInicio(true);
    setTimeout(() => setCopiadoInicio(false), 2000);
  }

  const carregar = useCallback(async () => {
    const res = await fetch("/api/estado", { cache: "no-store" });
    const d = await res.json();
    if (!d.autenticado) {
      router.replace("/");
      return;
    }
    setEstado(d);
  }, [router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function campo(nome: string, valor?: string) {
    return {
      value: valor !== undefined ? valor : form[nome] || "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm({ ...form, [nome]: e.target.value }),
    };
  }

  async function acao(acaoNome: string, args: Record<string, unknown> = {}) {
    setErro("");
    setOk("");
    const res = await fetch("/api/acoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: acaoNome, ...args }),
    });
    const d = await res.json();
    if (!d.ok) {
      setErro(d.erro || "Não foi possível concluir.");
      return d;
    }
    await carregar();
    return d;
  }

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  function abrirSuporte(assunto: string) {
    const texto = encodeURIComponent(`Olá! Preciso de ajuda com o CondoFree. ${assunto}`);
    window.open(`${WHATS}?text=${texto}`, "_blank");
  }

  if (!estado) {
    return <div className="container"><p>Carregando...</p></div>;
  }

  const usuario = estado.usuario;
  const ehSindico = usuario.papel === "sindico";
  const modulosVisiveis = MODULOS.filter((m) => m.papeis.includes(usuario.papel));
  const principais: Aba[] = ["inicio", "reservas", "avisos", "boletos"];
  const resto = modulosVisiveis.filter((m) => !principais.includes(m.id));

  function irPara(nova: Aba) {
    setAba(nova);
    setGaveta(false);
    setErro("");
    setOk("");
    window.scrollTo({ top: 0 });
  }

  const reservasPendentes = estado.reservas.filter((r: any) => r.status === "pendente").length;
  const ocorrenciasAbertas = estado.ocorrencias.filter((o: any) => o.status !== "resolvida").length;
  const cobrancasPendentes = estado.boletos.filter((b: any) => b.status === "pendente").length;
  const votacoesAbertas = estado.votacoes.filter((v: any) => v.aberta).length;

  // Home nova (layout sugerido pelo Robson, 07/11/2026): saudação, ações
  // rápidas, resumo e acesso rápido — tudo com os dados reais do condomínio.
  const primeiroNome = (usuario.nome || "").split(" ")[0];
  const iniciais = (usuario.nome || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0].toUpperCase())
    .join("");
  const temPendencia = reservasPendentes + ocorrenciasAbertas + votacoesAbertas > 0;
  const emTrial = estado.condominio.assinaturaStatus === "trial";
  const diasTrial = estado.statusAssinatura.diasRestantes;
  const acoesRapidas: { rotulo: string; icone: string; classe: string; aba: Aba }[] = ehSindico
    ? [
        { rotulo: "Nova Reserva", icone: "📅", classe: "acao-verde", aba: "reservas" },
        { rotulo: "Publicar Aviso", icone: "📢", classe: "acao-azul", aba: "avisos" },
        { rotulo: "Abrir Ocorrência", icone: "🔧", classe: "acao-laranja", aba: "ocorrencias" },
        { rotulo: "Nova cobrança", icone: "🧾", classe: "acao-roxa", aba: "boletos" },
      ]
    : [
        { rotulo: "Nova Reserva", icone: "📅", classe: "acao-verde", aba: "reservas" },
        { rotulo: "Ver Avisos", icone: "📢", classe: "acao-azul", aba: "avisos" },
        { rotulo: "Abrir Ocorrência", icone: "🔧", classe: "acao-laranja", aba: "ocorrencias" },
        { rotulo: "Ver cobranças", icone: "🧾", classe: "acao-roxa", aba: "boletos" },
      ];
  const resumoItens: { num: string | number; rot: string; icone: string; fundo: string; aba: Aba; destaque?: boolean }[] = [
    { num: reservasPendentes, rot: "Reservas pendentes", icone: "📅", fundo: "#dcfce7", aba: "reservas" },
    { num: estado.avisos.length, rot: "Avisos no mural", icone: "📢", fundo: "#ffedd5", aba: "avisos" },
    { num: ocorrenciasAbertas, rot: "Ocorrências abertas", icone: "🔧", fundo: "#ffedd5", aba: "ocorrencias" },
    { num: cobrancasPendentes, rot: "Cobranças pendentes", icone: "🧾", fundo: "#ede9fe", aba: "boletos" },
    { num: votacoesAbertas, rot: "Votações abertas", icone: "🗳️", fundo: "#dbeafe", aba: "votacoes" },
    { num: brl(estado.resumoFinanceiro.saldo), rot: "Saldo do mês", icone: "🪙", fundo: "#dcfce7", aba: "financeiro", destaque: true },
  ];
  const acessoRapido: { rotulo: string; icone: string; classe: string; aba: Aba }[] = ehSindico
    ? [
        { rotulo: "Moradores", icone: "👥", classe: "acao-azul", aba: "moradores" },
        { rotulo: "Funcionários", icone: "👔", classe: "acao-roxa", aba: "funcionarios" },
        { rotulo: "Financeiro", icone: "💰", classe: "acao-amarela", aba: "financeiro" },
        { rotulo: "Plano e FAQ", icone: "⭐", classe: "acao-rosa", aba: "plano" },
      ]
    : [
        { rotulo: "Avisos", icone: "📢", classe: "acao-azul", aba: "avisos" },
        { rotulo: "Cobranças", icone: "🧾", classe: "acao-roxa", aba: "boletos" },
        { rotulo: "Financeiro", icone: "💰", classe: "acao-amarela", aba: "financeiro" },
        { rotulo: "Plano e FAQ", icone: "⭐", classe: "acao-rosa", aba: "plano" },
      ];

  return (
    <div>
      <header className={aba === "inicio" ? "topo topo-home" : "topo"}>
        <button className="hamburguer" onClick={() => setGaveta(true)} aria-label="Abrir menu">☰</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src={LOGO_DATA_URI} alt="CondoFree" />
        <div>
          <div className="titulo">{estado.condominio.nome}</div>
          <div className="sub">Síndico: {ehSindico ? usuario.nome : "Síndico do condomínio"}</div>
          <div className="quem">Logado como {usuario.email} · {ehSindico ? "Síndico" : "Morador"}</div>
        </div>
        <div className="espaco" />
        <span className="selo">{estado.statusAssinatura.texto}</span>
        <button className="btn pequeno" onClick={() => irPara("ajuda")}>Ajuda / Suporte</button>
        <button className="btn secundario pequeno" onClick={sair}>Sair</button>
      </header>

      {gaveta && <div className="gaveta-fundo" onClick={() => setGaveta(false)} />}
      <nav className={`gaveta ${gaveta ? "aberta" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "#0b2a4a", fontSize: 18 }}>Menu</strong>
          <button className="btn secundario pequeno" onClick={() => setGaveta(false)}>Fechar</button>
        </div>
        {modulosVisiveis.map((m) => (
          <button key={m.id} className="item" onClick={() => irPara(m.id)}>
            <span>{m.icone}</span> {m.rotulo}
          </button>
        ))}
        <button className="item" onClick={sair}>
          <span>🚪</span> Sair
        </button>
      </nav>

      <div className="painel-layout">
        <aside className="sidebar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src={LOGO_DATA_URI} alt="CondoFree" />
          <div className="side-condominio">{estado.condominio.nome}</div>
          <div className="side-sub">Síndico: {ehSindico ? usuario.nome : "Síndico do condomínio"}</div>
          <div className="side-quem">Logado como {usuario.email} · {ehSindico ? "Síndico" : "Morador"}</div>
          <nav className="side-nav">
            {modulosVisiveis.map((m) => (
              <button key={m.id} className={aba === m.id ? "ativo" : ""} onClick={() => irPara(m.id)}>
                <span className="icone">{m.icone}</span>
                {m.rotulo}
              </button>
            ))}
          </nav>
          <div className="side-rodape">
            <span className="selo">{estado.statusAssinatura.texto}</span>
            <button className="btn pequeno" onClick={() => irPara("ajuda")}>Ajuda / Suporte</button>
            <button className="btn secundario pequeno" onClick={sair}>Sair</button>
          </div>
        </aside>
        <div className="container">
        {erro && <div className="erro">{erro}</div>}
        {ok && <div className="ok-msg">{ok}</div>}

        {aba === "inicio" && (
          <div>
            <div className="home-hero" style={{ backgroundImage: `url(${LOGIN_BG_DATA_URI})` }}>
              <div className="home-hero-topo">
                <span className="home-hero-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={LOGO_DATA_URI} alt="CondoFree" />
                </span>
                <span className="espaco" />
                <button className="home-sino" onClick={() => irPara("avisos")} aria-label="Avisos">
                  🔔
                  {temPendencia && <span className="ponto" />}
                </button>
                <button className="home-avatar" onClick={() => irPara("plano")} aria-label="Plano e conta">
                  {iniciais}
                </button>
              </div>
              <div className="home-saudacao">Olá, {primeiroNome}! 👋</div>
              <p className="home-sub">{ehSindico ? "Síndico" : "Morador"} • {estado.condominio.nome}</p>
              <div className="home-teste">
                {emTrial && diasTrial > 0 ? (
                  <>
                    <span>👑 Em teste grátis até {dataBR(estado.condominio.trialFim)}</span>
                    <span className="falta">Faltam {diasTrial} dia{diasTrial === 1 ? "" : "s"}</span>
                  </>
                ) : (
                  <span>{estado.condominio.assinaturaStatus === "ativa" ? "✅ Assinatura ativa" : `⭐ ${estado.statusAssinatura.texto}`}</span>
                )}
              </div>
            </div>

            <div className="home-acoes">
              {acoesRapidas.map((a) => (
                <button key={a.rotulo} className={a.classe} onClick={() => irPara(a.aba)}>
                  <span className="icone">{a.icone}</span>
                  {a.rotulo}
                </button>
              ))}
            </div>

            <div className="home-resumo">
              <div className="home-resumo-topo">
                <h3>📊 Resumo do condomínio</h3>
                <span>Este mês ▾</span>
              </div>
              <div className="home-resumo-grade">
                {resumoItens.map((item) => (
                  <button key={item.rot} className={`home-resumo-item${item.destaque ? " destaque" : ""}`} onClick={() => irPara(item.aba)}>
                    <span className="icone" style={{ background: item.fundo }}>{item.icone}</span>
                    <span>
                      <span className="num">{item.num}</span>
                      <br />
                      <span className="rot">{item.rot}</span>
                    </span>
                    <span className="seta">›</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="cartao home-boasvindas">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <BotaoInstalarApp />
                <span style={{ color: "#5b6b7d" }}>Código de convite: <strong style={{ color: "var(--navy)" }}>{estado.condominio.codigoConvite}</strong></span>
                <button className="btn secundario" style={{ padding: "4px 14px", fontSize: 14 }} onClick={copiarCodigoInicio}>{copiadoInicio ? "✓ Copiado!" : "Copiar"}</button>
              </div>
            </div>

            <h3 className="home-acesso-titulo">⚡ Acesso rápido</h3>
            <div className="home-acesso">
              {acessoRapido.map((a) => (
                <button key={a.rotulo} className={a.classe} onClick={() => irPara(a.aba)}>
                  <span className="icone">{a.icone}</span>
                  {a.rotulo}
                </button>
              ))}
            </div>

            {estado.avisos.slice(0, 3).map((a: any) => (
              <div key={a.id} className="cartao">
                <h3>📢 {a.titulo}</h3>
                <p>{a.texto}</p>
                <p style={{ color: "#5b6b7d", fontSize: 14 }}>{a.lidoPor.length} morador(es) já leram.</p>
              </div>
            ))}
          </div>
        )}

        {aba === "reservas" && (
          <ReservasTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} />
        )}
        {aba === "avisos" && (
          <AvisosTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} />
        )}
        {aba === "ocorrencias" && (
          <OcorrenciasTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} />
        )}
        {aba === "boletos" && (
          <CobrancasTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} />
        )}
        {aba === "financeiro" && (
          <FinanceiroTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} />
        )}
        {aba === "votacoes" && (
          <VotacoesTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} />
        )}
        {aba === "moradores" && ehSindico && (
          <MoradoresTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} editandoMorador={editandoMorador} setEditandoMorador={setEditandoMorador} />
        )}
        {aba === "funcionarios" && ehSindico && (
          <FuncionariosTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} />
        )}
        {aba === "plano" && (
          <PlanoTab estado={estado} ehSindico={ehSindico} acao={acao} setOk={setOk} setErro={setErro} />
        )}
        {aba === "ajuda" && (
          <AjudaTab ehSindico={ehSindico} abrirSuporte={abrirSuporte} />
        )}
        </div>
      </div>

      <BannerInstalar />
      <nav className="barra-inferior">
        {principais.map((id) => {
          const m = MODULOS.find((x) => x.id === id)!;
          return (
            <button key={id} className={aba === id ? "ativo" : ""} onClick={() => irPara(id)}>
              <span className="icone">{m.icone}</span>{m.rotulo}
            </button>
          );
        })}
        <button onClick={() => setGaveta(true)}>
          <span className="icone">☰</span>Mais
        </button>
      </nav>
    </div>
  );
}

type TabProps = {
  estado: any;
  ehSindico: boolean;
  campo: (nome: string, valor?: string) => any;
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  acao: (nome: string, args?: Record<string, unknown>) => Promise<any>;
  setOk: (s: string) => void;
};

function ReservasTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  async function reservar(e: React.FormEvent) {
    e.preventDefault();
    const d = await acao("criarReserva", { espacoId: form.espacoId, data: form.data, inicio: form.inicio, fim: form.fim });
    if (d?.ok) {
      setOk(ehSindico ? "Reserva criada e já aprovada." : "Reserva enviada! Aguarde a aprovação do síndico.");
      setForm({});
    }
  }
  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-azul">📅</span>
        <div>
          <h2>Reservas de espaços</h2>
          <p>Reserve o salão, a churrasqueira e outros espaços do condomínio, sem conflito de horário.</p>
        </div>
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-verde pequeno">📅</span><h3>Nova reserva</h3></div>
        <form onSubmit={reservar}>
          <div className="campo">
            <label>Espaço</label>
            <select {...campo("espacoId")}>
              <option value="">Escolha o espaço</option>
              {estado.espacos.map((e: any) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Data</label>
            <input type="date" {...campo("data")} />
          </div>
          <div className="linha">
            <div className="campo"><label>Início</label><input type="time" {...campo("inicio")} /></div>
            <div className="campo"><label>Término</label><input type="time" {...campo("fim")} /></div>
          </div>
          <button className="btn" type="submit">Reservar espaço</button>
        </form>
        <p style={{ color: "#5b6b7d", fontSize: 14 }}>
          Como síndico, as suas reservas já nascem aprovadas. As dos moradores chegam pendentes e você aprova ou recusa abaixo. Se o horário já estiver ocupado por uma reserva aprovada no mesmo espaço, a nova é bloqueada e você é avisado na hora.
        </p>
      </div>
      {ehSindico && (
        <div className="cartao">
          <div className="cartao-titulo"><span className="chip-icone chip-azul pequeno">🏢</span><h3>Espaços do condomínio</h3></div>
          {estado.espacos.map((e: any) => (
            <div key={e.id} className="item-lista">
              <span className="chip-icone chip-azul pequeno">🏢</span>
              <div className="item-lista-corpo"><strong>{e.nome}</strong></div>
              <div className="item-lista-lado">
                <button className="btn secundario pequeno" onClick={async () => {
                  if (confirm(`Excluir ${e.nome}? As reservas futuras dele serão canceladas.`)) {
                    const d = await acao("removerEspaco", { id: e.id });
                    if (d?.ok) setOk("Espaço removido.");
                  }
                }}>Excluir</button>
              </div>
            </div>
          ))}
          <div className="linha">
            <div className="campo"><label>Novo espaço</label><input {...campo("novoEspaco")} placeholder="Ex.: Academia" /></div>
          </div>
          <button className="btn secundario" onClick={async () => {
            const d = await acao("criarEspaco", { nome: form.novoEspaco });
            if (d?.ok) { setOk("Espaço criado."); setForm({ ...form, novoEspaco: "" }); }
          }}>Adicionar espaço</button>
        </div>
      )}
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-azul pequeno">📅</span><h3>Reservas</h3></div>
        {estado.reservas.length === 0 && <p>Nenhuma reserva ainda.</p>}
        {estado.reservas.map((r: any) => (
          <div key={r.id} className="item-lista">
            <span className={`chip-icone pequeno ${r.status === "aprovada" ? "chip-verde" : r.status === "pendente" ? "chip-amarela" : r.status === "recusada" ? "chip-rosa" : "chip-cinza"}`}>📅</span>
            <div className="item-lista-corpo">
              <strong>{r.espacoNome}</strong>
              <div className="item-meta">{dataBR(r.data)} · {r.inicio} às {r.fim} · {r.moradorNome}</div>
            </div>
            <div className="item-lista-lado">
              {r.status === "pendente" && <span className="etiqueta amber">pendente</span>}
              {r.status === "aprovada" && <span className="etiqueta verde">aprovada</span>}
              {r.status === "recusada" && <span className="etiqueta vermelha">recusada</span>}
              {r.status === "cancelada" && <span className="etiqueta cinza">cancelada</span>}
              <div className="item-lista-acoes">
                {ehSindico && r.status === "pendente" && (
                  <>
                    <button className="btn pequeno" onClick={() => acao("aprovarReserva", { id: r.id, aprovar: true })}>Aprovar</button>
                    <button className="btn perigo pequeno" onClick={() => acao("aprovarReserva", { id: r.id, aprovar: false })}>Recusar</button>
                  </>
                )}
                {(ehSindico || r.moradorId === estado.eu?.id) && r.status !== "cancelada" && (
                  <button className="btn secundario pequeno" onClick={() => acao("cancelarReserva", { id: r.id })}>Cancelar</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvisosTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-rosa">📢</span>
        <div>
          <h2>Mural de avisos</h2>
          <p>Os avisos do síndico ficam aqui, sempre à vista. Marque que leu para o síndico saber.</p>
        </div>
      </div>
      {ehSindico && (
        <div className="cartao">
          <div className="cartao-titulo"><span className="chip-icone chip-rosa pequeno">📢</span><h3>Novo aviso</h3></div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const d = await acao("criarAviso", { titulo: form.tituloAviso, texto: form.textoAviso });
            if (d?.ok) { setOk("Aviso publicado."); setForm({}); }
          }}>
            <div className="campo"><label>Título</label><input {...campo("tituloAviso")} /></div>
            <div className="campo"><label>Texto</label><textarea rows={3} {...campo("textoAviso")} /></div>
            <button className="btn" type="submit">Publicar aviso</button>
            {ehSindico && (
              <ContadorPush texto={(com, total) => `${com} de ${total} morador(es) vão receber este aviso por notificação.`} />
            )}
          </form>
        </div>
      )}
      {estado.avisos.map((a: any) => {
        const euLi = estado.eu && a.lidoPor.includes(estado.eu.id);
        return (
          <div key={a.id} className="item-lista">
            <span className="chip-icone chip-rosa pequeno">📢</span>
            <div className="item-lista-corpo">
              <strong>{a.titulo}</strong>
              <div>{a.texto}</div>
              <div className="item-meta">
                {a.lidoPor.length} morador(es) leram
                {ehSindico && a.lidoPor.length > 0 && (
                  <>: {a.lidoPor.map((id: string) => estado.moradores.find((m: any) => m.id === id)?.nome).filter(Boolean).join(", ")}</>
                )}
              </div>
            </div>
            <div className="item-lista-lado">
              {!ehSindico && !euLi && (
                <button className="btn pequeno" onClick={() => acao("marcarLido", { avisoId: a.id })}>Li o aviso ✓</button>
              )}
              {!ehSindico && euLi && <span className="etiqueta verde">Você já leu ✓</span>}
              {ehSindico && (
                <button className="btn perigo pequeno" onClick={() => acao("removerAviso", { id: a.id })}>Remover</button>
              )}
            </div>
          </div>
        );
      })}
      {estado.avisos.length === 0 && <div className="cartao"><p>Nenhum aviso ainda.</p></div>}
    </div>
  );
}

function OcorrenciasTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  // Fotos antigas foram salvas como blob privado (URL com ?download=1) e
  // quebram no <img>; essas passam pelo proxy /api/foto. Fotos novas já
  // são públicas e carregam direto.
  function srcFoto(url: string) {
    try {
      const u = new URL(url);
      // Toda foto do Blob (antiga ou nova, host público ou privado) passa
      // pelo proxy /api/foto, que busca com o token no servidor — o <img>
      // sozinho não autentica e a foto privada quebra.
      if (u.hostname.endsWith(".blob.vercel-storage.com")) {
        return `/api/foto?u=${encodeURIComponent(url)}`;
      }
    } catch {
      // url inválida: deixa como está
    }
    return url;
  }
  const [fotoUrl, setFotoUrl] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState("");
  const [privada, setPrivada] = useState(false);
  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoFoto(true);
    setErroFoto("");
    try {
      const fd = new FormData();
      fd.append("foto", arquivo);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (d.ok) setFotoUrl(d.url);
      else setErroFoto(d.erro || "Não foi possível enviar a foto. Tente novamente.");
    } catch {
      setErroFoto("Não foi possível enviar a foto. Tente novamente.");
    } finally {
      setEnviandoFoto(false);
    }
  }
  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-laranja">🔧</span>
        <div>
          <h2>Ocorrências</h2>
          <p>Avise o síndico sobre algo que precisa de reparo, com foto e local — ou mande uma mensagem só para ele. Acompanhe o status aqui.</p>
        </div>
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-laranja pequeno">🔧</span><h3>Nova ocorrência</h3></div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const d = await acao("criarOcorrencia", { titulo: form.tituloOc, descricao: form.descOc, local: form.localOc, fotoUrl, privada });
          if (d?.ok) { setOk(privada ? "Mensagem enviada ao síndico." : "Ocorrência registrada."); setForm({}); setFotoUrl(""); setPrivada(false); }
        }}>
          <div className="campo"><label>Título</label><input {...campo("tituloOc")} placeholder="Ex.: Lâmpada queimada" /></div>
          <div className="campo"><label>Descrição</label><textarea rows={3} {...campo("descOc")} /></div>
          <div className="campo"><label>Local</label><input {...campo("localOc")} placeholder="Ex.: Bloco B, 2º andar" /></div>
          <div className="campo">
            <label>Foto (opcional)</label>
            <input type="file" accept="image/*" onChange={enviarFoto} />
            {enviandoFoto && <p>Enviando foto...</p>}
            {erroFoto && <p style={{ color: "#b91c1c" }}>{erroFoto}</p>}
            {fotoUrl && <p style={{ color: "#166534" }}>Foto anexada ✓</p>}
          </div>
          {!ehSindico && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "4px 0 12px", color: "#0b2a4a", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={privada}
                onChange={(e) => setPrivada(e.target.checked)}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: "#22a06b" }}
              />
              <span>
                <strong>🔒 Enviar só para o síndico (mensagem privada)</strong>
                <br />
                <span style={{ color: "#5b6b7d", fontSize: 14 }}>Os outros moradores não vão ver esta mensagem.</span>
              </span>
            </label>
          )}
          <button className="btn" type="submit">Registrar ocorrência</button>
        </form>
      </div>
      {estado.ocorrencias.map((o: any) => (
        <div key={o.id} className="item-lista">
          <span className={`chip-icone pequeno ${o.status === "resolvida" ? "chip-verde" : o.status === "em_andamento" ? "chip-amarela" : "chip-rosa"}`}>🔧</span>
          <div className="item-lista-corpo">
            <strong>{o.titulo}</strong>
            <div>{o.descricao}</div>
            <div className="item-meta">{o.local} · por {o.moradorNome}</div>
            {o.fotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={srcFoto(o.fotoUrl)} alt="Foto da ocorrência" className="foto" />
            )}
          </div>
          <div className="item-lista-lado">
            {o.privada && <span className="etiqueta azul">🔒 Privado</span>}
            {o.status === "aberta" && <span className="etiqueta vermelha">aberta</span>}
            {o.status === "em_andamento" && <span className="etiqueta amber">em andamento</span>}
            {o.status === "resolvida" && <span className="etiqueta verde">resolvida</span>}
            {ehSindico && o.status !== "resolvida" && (
              <div className="item-lista-acoes">
                <button className="btn pequeno" onClick={() => acao("mudarStatusOcorrencia", { id: o.id, status: "em_andamento" })}>Em andamento</button>
                <button className="btn pequeno" onClick={() => acao("mudarStatusOcorrencia", { id: o.id, status: "resolvida" })}>Resolver</button>
              </div>
            )}
          </div>
        </div>
      ))}
      {estado.ocorrencias.length === 0 && <div className="cartao"><p>Nenhuma ocorrência ainda.</p></div>}
    </div>
  );
}

function CobrancasTab({ estado, ehSindico, acao, setOk }: TabProps) {
  // Foto do comprovante passa pelo proxy /api/foto (mesmo padrão das ocorrências).
  function srcFoto(url: string) {
    try {
      const u = new URL(url);
      if (u.hostname.endsWith(".blob.vercel-storage.com")) {
        return `/api/foto?u=${encodeURIComponent(url)}`;
      }
    } catch {}
    return url;
  }
  const pixChave = estado.condominio.pixChave || "";
  const recorrente = estado.condominio.cobrancaRecorrente || null;
  const [pixInput, setPixInput] = useState(pixChave);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [alvo, setAlvo] = useState("todos");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [recorrenteChecked, setRecorrenteChecked] = useState(false);
  const [diaRecorrente, setDiaRecorrente] = useState("1");
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const [erroComprovante, setErroComprovante] = useState("");
  const [anexoNovoUrl, setAnexoNovoUrl] = useState("");
  const [enviandoAnexoNovo, setEnviandoAnexoNovo] = useState(false);
  const [anexandoId, setAnexandoId] = useState<string | null>(null);
  const [enviandoAnexoItem, setEnviandoAnexoItem] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroMorador, setFiltroMorador] = useState("todos");
  const [filtroDescricao, setFiltroDescricao] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const descricoes: string[] = [...new Set<string>(estado.boletos.map((b: any) => (b.descricao || "Taxa do condomínio") as string))].sort();
  const filtrosAtivos = busca.trim() !== "" || filtroMorador !== "todos" || filtroDescricao !== "todas" || filtroStatus !== "todos";
  const boletosFiltrados = estado.boletos.filter((b: any) => {
    const desc = b.descricao || "Taxa do condomínio";
    if (busca.trim() !== "") {
      const q = busca.trim().toLowerCase();
      if (!b.moradorNome.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) return false;
    }
    if (ehSindico && filtroMorador !== "todos" && b.moradorId !== filtroMorador) return false;
    if (filtroDescricao !== "todas" && desc !== filtroDescricao) return false;
    if (filtroStatus !== "todos" && b.status !== filtroStatus) return false;
    return true;
  });
  function limparFiltros() {
    setBusca(""); setFiltroMorador("todos"); setFiltroDescricao("todas"); setFiltroStatus("todos");
  }

  async function copiarPix() {
    try {
      await navigator.clipboard.writeText(pixChave);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = pixChave;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 2000);
  }

  async function enviarComprovante(arquivo: File) {
    setErroComprovante("");
    setEnviandoComprovante(true);
    try {
      const fd = new FormData();
      fd.append("foto", arquivo);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (d.ok && d.url) setComprovanteUrl(d.url);
      else setErroComprovante(d.erro || "Não foi possível enviar o comprovante. Tente novamente.");
    } catch {
      setErroComprovante("Não foi possível enviar o comprovante. Tente novamente.");
    } finally {
      setEnviandoComprovante(false);
    }
  }

  // Envia o boleto (PDF ou imagem) do síndico. Sem boletoId, guarda para a
  // cobrança que está sendo criada; com boletoId, anexa numa já existente.
  async function enviarAnexoBoleto(arquivo: File, boletoId: string | null) {
    if (boletoId) setEnviandoAnexoItem(true);
    else setEnviandoAnexoNovo(true);
    try {
      const fd = new FormData();
      fd.append("foto", arquivo);
      fd.append("pasta", "anexos");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!d.ok || !d.url) { setOk(d.erro || "Não foi possível enviar o boleto. Tente novamente."); return; }
      if (boletoId) {
        const r = await acao("anexarBoleto", { id: boletoId, url: d.url });
        if (r?.ok) { setOk("Boleto anexado."); setAnexandoId(null); }
      } else {
        setAnexoNovoUrl(d.url);
      }
    } catch {
      setOk("Não foi possível enviar o boleto. Tente novamente.");
    } finally {
      if (boletoId) setEnviandoAnexoItem(false);
      else setEnviandoAnexoNovo(false);
    }
  }

  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-roxa">🧾</span>
        <div>
          <h2>Cobranças</h2>
          <p>Taxa do condomínio, extras e multas — pague via Pix e envie o comprovante.</p>
        </div>
      </div>
      <p style={{ color: "#5b6b7d", fontSize: 14, margin: "-8px 0 16px 66px" }}>O CondoFree não recebe o valor da cobrança. O pagamento vai direto para o Pix do condomínio.</p>

      {!ehSindico && (
        <div className="cartao">
          <div className="cartao-titulo"><span className="chip-icone chip-roxa pequeno">💳</span><h3>Pague via Pix</h3></div>
          {pixChave ? (
            <p>Chave Pix do condomínio: <strong>{pixChave}</strong>{" "}
              <button className="btn secundario pequeno" style={{ padding: "4px 14px", fontSize: 14 }} onClick={copiarPix}>{pixCopiado ? "✓ Copiado!" : "Copiar Pix"}</button>
            </p>
          ) : (
            <p style={{ color: "#5b6b7d" }}>O síndico ainda não cadastrou o Pix do condomínio.</p>
          )}
        </div>
      )}

      {ehSindico && (
        <div className="cartao">
          <div className="cartao-titulo"><span className="chip-icone chip-roxa pequeno">💳</span><h3>Pix para recebimento</h3></div>
          <p style={{ color: "#5b6b7d" }}>Os moradores pagam neste Pix e enviam o comprovante. O dinheiro cai direto na conta do condomínio.</p>
          <div className="campo"><label>Chave Pix do condomínio</label><input value={pixInput} onChange={(e) => setPixInput(e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" /></div>
          <button className="btn" onClick={async () => {
            const d = await acao("salvarPix", { pixChave: pixInput });
            if (d?.ok) setOk("Pix salvo.");
          }}>Salvar Pix</button>
          {recorrente && (
            <p style={{ color: "#5b6b7d", marginTop: 12 }}>🔁 Cobrança recorrente ativa: {recorrente.descricao} — {brl(recorrente.valor)} todo dia {recorrente.dia}.{" "}
              <button className="btn secundario pequeno" onClick={async () => {
                const d = await acao("cancelarRecorrente", {});
                if (d?.ok) setOk("Cobrança recorrente cancelada.");
              }}>Cancelar recorrência</button>
            </p>
          )}
        </div>
      )}

      {ehSindico && (
        <div className="cartao">
          <div className="cartao-titulo"><span className="chip-icone chip-roxa pequeno">🧾</span><h3>Nova cobrança</h3></div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const d = await acao("criarCobranca", { alvo, descricao, valor: Number(valor), vencimento, recorrente: recorrenteChecked, diaRecorrente: Number(diaRecorrente), anexoBoletoUrl: anexoNovoUrl });
            if (d?.ok) {
              setOk(`${d.criadas} cobrança(s) criada(s) e moradores avisados.`);
              setDescricao(""); setValor(""); setVencimento(""); setRecorrenteChecked(false); setAnexoNovoUrl("");
            }
          }}>
            <div className="campo"><label>Para quem</label>
              <select value={alvo} onChange={(e) => setAlvo(e.target.value)}>
                <option value="todos">Todos os moradores</option>
                {estado.moradores.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nome} — Bloco {m.bloco}, apto {m.apartamento}</option>
                ))}
              </select>
            </div>
            <div className="linha">
              <div className="campo"><label>Descrição</label><input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Taxa de condomínio — Novembro" /></div>
              <div className="campo"><label>Valor (R$)</label><input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="482,90" /></div>
            </div>
            <div className="linha">
              <div className="campo"><label>Vencimento</label><input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></div>
              <div className="campo"><label>Repetir todo mês</label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400, marginTop: 8 }}>
                  <input type="checkbox" checked={recorrenteChecked} onChange={(e) => setRecorrenteChecked(e.target.checked)} />
                  Criar de novo todo mês
                </label>
              </div>
              {recorrenteChecked && (
                <div className="campo"><label>Dia do mês</label><input type="number" min={1} max={28} value={diaRecorrente} onChange={(e) => setDiaRecorrente(e.target.value)} /></div>
              )}
            </div>
            <div className="campo"><label>Anexar boleto (PDF ou imagem, opcional)</label>
              {anexoNovoUrl ? (
                <p>✓ Boleto anexado — <a href={srcFoto(anexoNovoUrl)} target="_blank" rel="noreferrer">ver</a>{" "}
                  <button type="button" className="btn secundario pequeno" onClick={() => setAnexoNovoUrl("")}>Remover</button>
                </p>
              ) : (
                <label className="btn secundario pequeno" style={{ cursor: "pointer" }}>
                  {enviandoAnexoNovo ? "Enviando..." : "Escolher arquivo"}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" hidden onChange={(e) => {
                    const arq = e.target.files?.[0];
                    if (arq) enviarAnexoBoleto(arq, null);
                  }} />
                </label>
              )}
            </div>
            <button className="btn" type="submit">Criar cobrança</button>
          </form>
        </div>
      )}

      <div className="cartao">
        <div className="campo"><label>Buscar</label><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por morador ou descrição..." /></div>
        <div className="linha">
          {ehSindico && (
            <div className="campo"><label>Morador</label>
              <select value={filtroMorador} onChange={(e) => setFiltroMorador(e.target.value)}>
                <option value="todos">Todos os moradores</option>
                {estado.moradores.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
          )}
          <div className="campo"><label>Descrição</label>
            <select value={filtroDescricao} onChange={(e) => setFiltroDescricao(e.target.value)}>
              <option value="todas">Todas as descrições</option>
              {descricoes.map((d: string) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="campo"><label>Status</label>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="aguardando">Aguardando confirmação</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
        </div>
        <p style={{ color: "#5b6b7d", fontSize: 14 }}>{boletosFiltrados.length} cobrança(s){filtrosAtivos && (<>{" "}<button className="btn secundario pequeno" onClick={limparFiltros}>Limpar filtros</button></>)}</p>
      </div>

      {boletosFiltrados.map((b: any) => (
        <div key={b.id} className="item-lista">
          <span className={`chip-icone pequeno ${b.status === "pago" ? "chip-verde" : b.status === "aguardando" ? "chip-azul" : b.status === "pendente" ? "chip-amarela" : "chip-rosa"}`}>🧾</span>
          <div className="item-lista-corpo">
            <strong>{b.descricao || "Taxa do condomínio"} — {b.moradorNome}{b.bloco && b.apartamento ? ` · Bloco ${b.bloco}, apto ${b.apartamento}` : ""} — {brl(b.valor)}</strong>
            <div className="item-meta">Vencimento: {dataBR(b.vencimento)}</div>
            {b.anexoBoletoUrl && (
              <div style={{ marginTop: 6 }}>
                <a href={srcFoto(b.anexoBoletoUrl)} target="_blank" rel="noreferrer">📄 Ver boleto</a>
              </div>
            )}
            {b.comprovanteUrl && (
              <div style={{ marginTop: 8 }}>
                <img src={srcFoto(b.comprovanteUrl)} alt="Comprovante" style={{ maxWidth: 220, borderRadius: 12, border: "1px solid var(--border)" }} />
              </div>
            )}
            {!ehSindico && b.status === "pendente" && pagandoId === b.id && (
              <div style={{ marginTop: 8 }}>
                <label className="btn secundario pequeno" style={{ cursor: "pointer" }}>
                  {enviandoComprovante ? "Enviando..." : comprovanteUrl ? "Trocar comprovante" : "Anexar comprovante (foto)"}
                  <input type="file" accept="image/*" hidden onChange={(e) => {
                    const arq = e.target.files?.[0];
                    if (arq) enviarComprovante(arq);
                  }} />
                </label>
                {comprovanteUrl && (
                  <div style={{ marginTop: 8 }}>
                    <img src={srcFoto(comprovanteUrl)} alt="Comprovante" style={{ maxWidth: 220, borderRadius: 12, border: "1px solid var(--border)" }} />
                    <div style={{ marginTop: 8 }}>
                      <button className="btn pequeno" onClick={async () => {
                        const d = await acao("marcarPagoMorador", { id: b.id, comprovanteUrl });
                        if (d?.ok) { setOk("Pagamento marcado. O síndico vai confirmar o recebimento."); setPagandoId(null); setComprovanteUrl(""); }
                      }}>Enviar comprovante e marcar como pago</button>
                    </div>
                  </div>
                )}
                {erroComprovante && <p style={{ color: "#b91c1c" }}>{erroComprovante}</p>}
              </div>
            )}
            {ehSindico && (
              <div style={{ marginTop: 8 }}>
                {anexandoId === b.id ? (
                  <>
                    <label className="btn secundario pequeno" style={{ cursor: "pointer" }}>
                      {enviandoAnexoItem ? "Enviando..." : "Escolher arquivo (PDF ou imagem)"}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" hidden onChange={(e) => {
                        const arq = e.target.files?.[0];
                        if (arq) enviarAnexoBoleto(arq, b.id);
                      }} />
                    </label>{" "}
                    <button className="btn secundario pequeno" onClick={() => setAnexandoId(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button className="btn secundario pequeno" onClick={() => setAnexandoId(b.id)}>{b.anexoBoletoUrl ? "Trocar boleto" : "📎 Anexar boleto"}</button>
                    {b.anexoBoletoUrl && (
                      <>{" "}
                        <button className="btn secundario pequeno" onClick={async () => {
                          const d = await acao("anexarBoleto", { id: b.id, url: "" });
                          if (d?.ok) setOk("Anexo removido.");
                        }}>Remover anexo</button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="item-lista-lado">
            {b.status === "pago" && <span className="etiqueta verde">pago ✓</span>}
            {b.status === "pendente" && <span className="etiqueta amber">pendente</span>}
            {b.status === "aguardando" && <span className="etiqueta azul">aguardando confirmação</span>}
            {b.status === "vencido" && <span className="etiqueta vermelha">vencido</span>}
            {!ehSindico && b.status === "pendente" && pagandoId !== b.id && (
              <button className="btn pequeno" onClick={() => { setPagandoId(b.id); setComprovanteUrl(""); setErroComprovante(""); }}>Marcar como pago</button>
            )}
            {ehSindico && b.status === "aguardando" && (
              <>
                <button className="btn pequeno" onClick={() => acao("confirmarRecebimento", { id: b.id })}>Confirmar recebimento</button>
                <button className="btn perigo pequeno" onClick={() => acao("recusarComprovante", { id: b.id })}>Recusar comprovante</button>
              </>
            )}
            {ehSindico && b.status === "pendente" && (
              <button className="btn pequeno" onClick={() => acao("confirmarRecebimento", { id: b.id })}>Confirmar recebimento</button>
            )}
            {ehSindico && b.status === "pago" && (
              <button className="btn secundario pequeno" onClick={() => acao("alternarStatusBoleto", { id: b.id })}>Voltar para pendente</button>
            )}
          </div>
        </div>
      ))}
      {boletosFiltrados.length === 0 && <div className="cartao"><p>{estado.boletos.length === 0 ? "Nenhuma cobrança ainda." : "Nenhuma cobrança encontrada com esses filtros."}</p></div>}
    </div>
  );
}

function FinanceiroTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const lancamentos = estado.lancamentos.filter((l: any) => l.data.slice(0, 7) === mes);
  const entradas = lancamentos.filter((l: any) => l.tipo === "receita" && l.pago).reduce((s: number, l: any) => s + l.valor, 0);
  const saidas = lancamentos.filter((l: any) => l.tipo === "despesa" && l.pago).reduce((s: number, l: any) => s + l.valor, 0);
  const pendentes = lancamentos.filter((l: any) => !l.pago);
  const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const nomeMesLongo = (m: string) => { const [y, mm] = m.split("-"); return `${MESES_LONGOS[Number(mm) - 1] || ""} de ${y}`; };
  const ROTULO_CATEGORIA: Record<string, string> = { limpeza: "Limpeza", manutencao: "Manutenção", energia: "Energia", agua: "Água", seguranca: "Segurança", boleto: "Cobrança", taxa_extra: "Taxa extra", aluguel_salao: "Aluguel do salão", multa: "Multa", "Folha de pagamento": "Folha de pagamento", outros: "Outros" };
  function baixarPrestacao() {
    const linhas = [
      `PRESTAÇÃO DE CONTAS — ${estado.condominio.nome}`,
      `Mês: ${mes}`,
      ``,
      `Entradas: ${brl(entradas)}`,
      `Saídas: ${brl(saidas)}`,
      `Saldo: ${brl(entradas - saidas)}`,
      ``,
      `Lançamentos:`,
    ];
    lancamentos.forEach((l: any) => {
      linhas.push(`- ${dataBR(l.data)} | ${l.tipo === "receita" ? "Entrada" : "Saída"} | ${l.categoria} | ${l.descricao} | ${brl(l.valor)} | ${l.pago ? "pago" : "pendente"}`);
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestacao-de-contas-${mes}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!ehSindico) {
    return (
      <div>
        <div className="tab-cabecalho">
          <span className="chip-icone chip-verde">💰</span>
          <div>
            <h2>Financeiro</h2>
            <p>Resumo do mês para os moradores.</p>
          </div>
        </div>
        <div className="home-resumo">
          <div className="home-resumo-grade">
            <div className="home-resumo-item"><span className="icone acao-verde">💰</span><span><span className="num" style={{ color: "#166534" }}>{brl(estado.resumoFinanceiro.entradas)}</span><br /><span className="rot">entradas</span></span></div>
            <div className="home-resumo-item"><span className="icone acao-laranja">💸</span><span><span className="num" style={{ color: "#b91c1c" }}>{brl(estado.resumoFinanceiro.saidas)}</span><br /><span className="rot">saídas</span></span></div>
            <div className="home-resumo-item"><span className="icone acao-azul">📊</span><span><span className="num">{brl(estado.resumoFinanceiro.saldo)}</span><br /><span className="rot">saldo</span></span></div>
          </div>
        </div>
        <p style={{ color: "#5b6b7d", fontSize: 14 }}>O detalhamento completo é apresentado pelo síndico na assembleia.</p>
      </div>
    );
  }
  return (
    <>
    <div className="tela-only">
      <div className="tab-cabecalho">
        <span className="chip-icone chip-verde">💰</span>
        <div>
          <h2>Financeiro — contabilidade simples</h2>
          <p>O CondoFree não recebe o valor do boleto. O dinheiro é do condomínio.</p>
        </div>
      </div>
      <div className="cartao">
        <div className="campo">
          <label>Mês</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        <div className="home-resumo-grade">
          <div className="home-resumo-item"><span className="icone acao-verde">💰</span><span><span className="num" style={{ color: "#166534" }}>{brl(entradas)}</span><br /><span className="rot">entradas pagas</span></span></div>
          <div className="home-resumo-item"><span className="icone acao-laranja">💸</span><span><span className="num" style={{ color: "#b91c1c" }}>{brl(saidas)}</span><br /><span className="rot">saídas pagas</span></span></div>
          <div className="home-resumo-item"><span className="icone acao-azul">📊</span><span><span className="num">{brl(entradas - saidas)}</span><br /><span className="rot">saldo do mês</span></span></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn" onClick={baixarPrestacao}>Baixar prestação de contas</button>
          <button className="btn secundario" onClick={() => window.open(`/painel/imprimir?mes=${mes}`, "_blank")}>Imprimir</button>
        </div>
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-verde pequeno">➕</span><h3>Novo lançamento</h3></div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const d = await acao("criarLancamento", { tipo: form.tipoLan || "despesa", categoria: form.categoriaLan, descricao: form.descLan, valor: Number(form.valorLan), data: form.dataLan, pago: form.pagoLan !== "nao" });
          if (d?.ok) { setOk("Lançamento registrado."); setForm({}); }
        }}>
          <div className="linha">
            <div className="campo">
              <label>Tipo</label>
              <select {...campo("tipoLan")}>
                <option value="despesa">Despesa (conta a pagar)</option>
                <option value="receita">Receita (conta a receber)</option>
              </select>
            </div>
            <div className="campo">
              <label>Categoria</label>
              <select {...campo("categoriaLan")}>
                <option value="limpeza">Limpeza</option>
                <option value="manutencao">Manutenção</option>
                <option value="energia">Energia</option>
                <option value="agua">Água</option>
                <option value="seguranca">Segurança</option>
                <option value="boleto">Boleto</option>
                <option value="taxa_extra">Taxa extra</option>
                <option value="aluguel_salao">Aluguel do salão</option>
                <option value="multa">Multa</option>
                <option value="outros">Outros</option>
              </select>
            </div>
          </div>
          <div className="campo"><label>Descrição</label><input {...campo("descLan")} placeholder="Ex.: Faxina do salão" /></div>
          <div className="linha">
            <div className="campo"><label>Valor (R$)</label><input type="number" step="0.01" {...campo("valorLan")} /></div>
            <div className="campo"><label>Data</label><input type="date" {...campo("dataLan")} /></div>
            <div className="campo">
              <label>Status</label>
              <select {...campo("pagoLan")}>
                <option value="sim">Pago</option>
                <option value="nao">Pendente</option>
              </select>
            </div>
          </div>
          <button className="btn" type="submit">Registrar</button>
        </form>
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-azul pequeno">📋</span><h3>Lançamentos de {mes}</h3></div>
        {lancamentos.length === 0 && <p>Nenhum lançamento neste mês.</p>}
        {lancamentos.map((l: any) => (
          <div key={l.id} className="item-lista">
            <span className={`chip-icone pequeno ${l.tipo === "receita" ? "chip-verde" : "chip-laranja"}`}>{l.tipo === "receita" ? "💰" : "🧾"}</span>
            <div className="item-lista-corpo">
              <strong>{l.descricao}</strong>
              <div className="item-meta">{brl(l.valor)} · {l.categoria} · {dataBR(l.data)}</div>
            </div>
            <div className="item-lista-lado">
              <div className="item-lista-acoes">
                {l.pago ? <span className="etiqueta verde">pago</span> : <span className="etiqueta amber">pendente</span>}
                {l.origem === "boleto" && <span className="etiqueta cinza">boleto</span>}
                {l.origem === "folha" && <span className="etiqueta cinza">folha</span>}
              </div>
              <div className="item-lista-acoes">
                <button className="btn secundario pequeno" onClick={() => acao("marcarLancamentoPago", { id: l.id, pago: !l.pago })}>
                  {l.pago ? "Marcar pendente" : "Marcar pago"}
                </button>
                {l.origem !== "boleto" && (
                  <button className="btn perigo pequeno" onClick={() => acao("removerLancamento", { id: l.id })}>Remover</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {pendentes.length > 0 && <p style={{ color: "#b45309" }}>{pendentes.length} lançamento(s) pendente(s) neste mês.</p>}
      </div>
    </div>
    <div className="impressao-only">
      <div className="doc-cabecalho">
        <img src={LOGO_DATA_URI} alt="CondoFree" className="doc-logo" />
        <div>
          <div className="doc-titulo">Prestação de contas</div>
          <div className="doc-sub">{estado.condominio.nome} · {nomeMesLongo(mes)}</div>
        </div>
      </div>
      <div className="doc-resumo">
        <div><span>Entradas pagas</span><strong>{brl(entradas)}</strong></div>
        <div><span>Saídas pagas</span><strong>{brl(saidas)}</strong></div>
        <div><span>Saldo do mês</span><strong>{brl(entradas - saidas)}</strong></div>
      </div>
      <table className="doc-tabela">
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>
          {lancamentos.map((l: any) => (
            <tr key={l.id}>
              <td>{dataBR(l.data)}</td>
              <td>{l.descricao}</td>
              <td>{ROTULO_CATEGORIA[l.categoria] || l.categoria}</td>
              <td>{l.tipo === "receita" ? "Entrada" : "Saída"}</td>
              <td>{brl(l.valor)}</td>
              <td>{l.pago ? "Pago" : "Pendente"}</td>
            </tr>
          ))}
          {lancamentos.length === 0 && (<tr><td colSpan={6}>Nenhum lançamento neste mês.</td></tr>)}
        </tbody>
      </table>
      {pendentes.length > 0 && <p className="doc-obs">{pendentes.length} lançamento(s) pendente(s) neste mês.</p>}
      <p className="doc-rodape">Documento gerado pelo CondoFree em {new Date().toLocaleDateString("pt-BR")}. O CondoFree não recebe valores do condomínio.</p>
    </div>
    </>
  );
}

function VotacoesTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-roxa">🗳️</span>
        <div>
          <h2>Votações</h2>
          <p>Decisões do condomínio com voto de cada morador e ata ao final.</p>
        </div>
      </div>
      {ehSindico && (
        <div className="cartao">
          <div className="cartao-titulo"><span className="chip-icone chip-roxa pequeno">🗳️</span><h3>Nova votação</h3></div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const opcoes = [form.opcao1, form.opcao2, form.opcao3].filter(Boolean);
            const d = await acao("criarVotacao", { pergunta: form.perguntaVot, opcoes });
            if (d?.ok) { setOk("Votação criada."); setForm({}); }
          }}>
            <div className="campo"><label>Pergunta</label><input {...campo("perguntaVot")} placeholder="Ex.: Qual cor para a pintura da fachada?" /></div>
            <div className="campo"><label>Opção 1</label><input {...campo("opcao1")} /></div>
            <div className="campo"><label>Opção 2</label><input {...campo("opcao2")} /></div>
            <div className="campo"><label>Opção 3 (opcional)</label><input {...campo("opcao3")} /></div>
            <button className="btn" type="submit">Criar votação</button>
          </form>
        </div>
      )}
      {estado.votacoes.map((v: any) => {
        const euVotei = estado.eu && v.votos.some((x: any) => x.moradorId === estado.eu.id);
        return (
          <div key={v.id} className="cartao">
            <div className="cartao-titulo">
              <span className={`chip-icone pequeno ${v.aberta ? "chip-roxa" : "chip-cinza"}`}>🗳️</span>
              <h3>{v.pergunta}</h3>
              <span className="lado">{v.aberta ? <span className="etiqueta verde">aberta</span> : <span className="etiqueta cinza">encerrada</span>}</span>
            </div>
            <p className="item-meta">{v.votos.length} voto(s)</p>
            {v.opcoes.map((op: string, i: number) => {
              const n = v.votos.filter((x: any) => x.opcao === i).length;
              return (
                <div key={i} style={{ margin: "8px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{op}</span><strong>{n}</strong>
                  </div>
                  <div style={{ background: "#e5e7eb", borderRadius: 8, height: 10 }}>
                    <div style={{ background: "#22a06b", height: 10, borderRadius: 8, width: `${v.votos.length ? (n / v.votos.length) * 100 : 0}%` }} />
                  </div>
                  {v.aberta && !euVotei && (
                    <button className="btn pequeno" style={{ marginTop: 6 }} onClick={() => acao("votar", { votacaoId: v.id, opcao: i })}>Votar nesta</button>
                  )}
                </div>
              );
            })}
            {v.aberta && euVotei && <p style={{ color: "#166534" }}>Você já votou ✓</p>}
            {ehSindico && v.aberta && (
              <button className="btn" onClick={async () => {
                const d = await acao("encerrarVotacao", { id: v.id });
                if (d?.ok) setOk("Votação encerrada e ata gerada.");
              }}>Encerrar e gerar ata</button>
            )}
            {v.ata && (
              <>
                <div className="ata-doc">
                  <div className="ata-cabecalho">
                    <span className="chip-icone pequeno">🗳️</span>
                    <div>
                      <strong>ATA DE VOTAÇÃO</strong>
                      <span>{estado.condominio.nome}</span>
                    </div>
                  </div>
                  <div className="ata-corpo">
                    <h4 className="ata-pergunta">{v.pergunta}</h4>
                    <p className="ata-meta">{v.encerradaEm ? `Encerrada em ${dataBR(v.encerradaEm)} · ` : ""}{v.votos.length} voto(s)</p>
                    {v.opcoes.map((op: string, i: number) => {
                      const votosOpcao = v.votos.filter((x: any) => x.opcao === i);
                      const nomes = votosOpcao.map((x: any) => x.moradorNome).filter(Boolean);
                      return (
                        <div key={i} className="ata-opcao">
                          <div className="ata-opcao-linha">
                            <strong>{op}</strong>
                            <strong>{votosOpcao.length} voto(s)</strong>
                          </div>
                          <div className="ata-barra">
                            <div style={{ width: `${v.votos.length ? (votosOpcao.length / v.votos.length) * 100 : 0}%` }} />
                          </div>
                          {nomes.length > 0 && <div className="ata-votantes">{nomes.join(", ")}</div>}
                        </div>
                      );
                    })}
                    <p className="ata-rodape">Documento gerado pelo CondoFree.</p>
                  </div>
                </div>
                <div className="ata-acoes">
                  <button className="btn secundario pequeno" onClick={() => {
                    const blob = new Blob([v.ata], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "ata-votacao.txt"; a.click();
                    URL.revokeObjectURL(url);
                  }}>Baixar ata (.txt)</button>
                  <button className="btn secundario pequeno" onClick={() => window.print()}>Imprimir</button>
                </div>
              </>
            )}
          </div>
        );
      })}
      {estado.votacoes.length === 0 && <div className="cartao"><p>Nenhuma votação ainda.</p></div>}
    </div>
  );
}

function MoradoresTab({ estado, campo, form, setForm, acao, setOk, editandoMorador, setEditandoMorador }: TabProps & { editandoMorador: any; setEditandoMorador: (m: any) => void }) {
  const emEdicao = editandoMorador || null;
  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-azul">👥</span>
        <div>
          <h2>Moradores</h2>
          <p>Cadastro de moradores e unidades do condomínio.</p>
        </div>
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-azul pequeno">👥</span><h3>{emEdicao ? "Editar morador" : "Cadastrar morador"}</h3></div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (emEdicao) {
            const d = await acao("editarMorador", { id: emEdicao.id, nome: form.nomeMor, bloco: form.blocoMor, apartamento: form.aptoMor, email: form.emailMor });
            if (d?.ok) { setOk("Morador atualizado."); setEditandoMorador(null); setForm({}); }
          } else {
            const d = await acao("criarMorador", { nome: form.nomeMor, bloco: form.blocoMor, apartamento: form.aptoMor, email: form.emailMor });
            if (d?.ok) { setOk("Morador cadastrado."); setForm({}); }
          }
        }}>
          <div className="campo"><label>Nome</label><input {...campo("nomeMor", emEdicao?.nome)} /></div>
          <div className="linha">
            <div className="campo"><label>Bloco</label><input {...campo("blocoMor", emEdicao?.bloco)} /></div>
            <div className="campo"><label>Apartamento</label><input {...campo("aptoMor", emEdicao?.apartamento)} /></div>
          </div>
          <div className="campo"><label>E-mail</label><input type="email" {...campo("emailMor", emEdicao?.email)} /></div>
          <button className="btn" type="submit">{emEdicao ? "Salvar alterações" : "Cadastrar"}</button>
          {emEdicao && <button className="btn secundario" type="button" style={{ marginLeft: 8 }} onClick={() => { setEditandoMorador(null); setForm({}); }}>Cancelar</button>}
        </form>
      </div>
      {estado.pedidosCorrecao.filter((p: any) => p.status === "pendente").map((p: any) => (
        <div key={p.id} className="item-lista">
          <span className="chip-icone chip-amarela pequeno">✏️</span>
          <div className="item-lista-corpo">
            <strong>Pedido de correção — {p.moradorNome}</strong>
            <div className="item-meta"><strong>{p.campo}:</strong> errado: “{p.errado}” → certo: “{p.certo}”</div>
          </div>
          <div className="item-lista-lado">
            <div className="item-lista-acoes">
              <button className="btn pequeno" onClick={() => acao("responderCorrecao", { id: p.id, aprovar: true })}>Aprovar em 1 clique</button>
              <button className="btn perigo pequeno" onClick={() => acao("responderCorrecao", { id: p.id, aprovar: false })}>Recusar</button>
            </div>
          </div>
        </div>
      ))}
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-azul pequeno">👥</span><h3>Moradores cadastrados ({estado.moradores.length})</h3></div>
        {estado.moradores.map((m: any) => (
          <div key={m.id} className="item-lista">
            <span className="chip-icone chip-azul pequeno">👤</span>
            <div className="item-lista-corpo">
              <strong>{m.nome}</strong>
              <div className="item-meta">Bloco {m.bloco} · apto {m.apartamento} · {m.email || "sem e-mail"}</div>
            </div>
            <div className="item-lista-lado">
              <div className="item-lista-acoes">
                <button className="btn secundario pequeno" onClick={() => { setEditandoMorador(m); setForm({}); }}>Editar</button>
                <button className="btn perigo pequeno" onClick={() => acao("removerMorador", { id: m.id })}>Remover</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FuncionariosTab({ estado, campo, form, setForm, acao, setOk }: TabProps) {
  const [editando, setEditando] = useState<any>(null);
  const [mesFolha, setMesFolha] = useState(new Date().toISOString().slice(0, 7));
  const [edicao, setEdicao] = useState<Record<string, { adiantamento: string; descontos: string; extras: string }>>({});
  const funcionarios = estado.funcionarios || [];
  const folhas = estado.folhas || [];
  const folha = folhas.find((f: any) => f.mes === mesFolha) || null;
  const mesesNomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function nomeMes(mes: string) {
    const [y, m] = mes.split("-");
    return `${mesesNomes[Number(m) - 1]}/${y}`;
  }
  function valorEdicao(funcionarioId: string, chave: "adiantamento" | "descontos" | "extras", atual: number) {
    const v = edicao[funcionarioId]?.[chave];
    return v !== undefined ? v : String(atual);
  }
  function mudarEdicao(funcionarioId: string, chave: "adiantamento" | "descontos" | "extras", valor: string) {
    const atual = edicao[funcionarioId] || { adiantamento: "0", descontos: "0", extras: "0" };
    setEdicao({ ...edicao, [funcionarioId]: { ...atual, [chave]: valor } });
  }
  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-roxa">👔</span>
        <div>
          <h2>Funcionários e folha de pagamento</h2>
          <p>Cadastre os funcionários do condomínio e gere a folha do mês. Ao marcar um item como pago, o valor entra automaticamente como despesa no Financeiro.</p>
        </div>
      </div>
      <p style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 12, padding: "10px 12px", fontSize: 14, margin: "-8px 0 16px 66px" }}>
        ⚠️ Controle interno simples — não emite holerite oficial nem calcula encargos; as obrigações legais continuam com o contador do condomínio.
      </p>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-roxa pequeno">👔</span><h3>{editando ? "Editar funcionário" : "Cadastrar funcionário"}</h3></div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (editando) {
            const d = await acao("editarFuncionario", { id: editando.id, nome: form.nomeFun, cargo: form.cargoFun, tipoContrato: form.tipoFun || "CLT", salarioMensal: Number(form.salarioFun), dataAdmissao: form.admissaoFun });
            if (d?.ok) { setOk("Funcionário atualizado."); setEditando(null); setForm({}); }
          } else {
            const d = await acao("criarFuncionario", { nome: form.nomeFun, cargo: form.cargoFun, tipoContrato: form.tipoFun || "CLT", salarioMensal: Number(form.salarioFun), dataAdmissao: form.admissaoFun });
            if (d?.ok) { setOk("Funcionário cadastrado."); setForm({}); }
          }
        }}>
          <div className="campo"><label>Nome</label><input {...campo("nomeFun", editando?.nome)} placeholder="Ex.: José da Silva" /></div>
          <div className="linha">
            <div className="campo"><label>Cargo</label><input {...campo("cargoFun", editando?.cargo)} placeholder="Ex.: Porteiro" /></div>
            <div className="campo">
              <label>Tipo de contrato</label>
              <select {...campo("tipoFun", editando?.tipoContrato)}>
                <option value="CLT">CLT</option>
                <option value="MEI">MEI</option>
                <option value="Diarista">Diarista</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>
          <div className="linha">
            <div className="campo"><label>Salário mensal (R$)</label><input type="number" step="0.01" {...campo("salarioFun", editando ? String(editando.salarioMensal) : undefined)} placeholder="2500,00" /></div>
            <div className="campo"><label>Data de admissão</label><input type="date" {...campo("admissaoFun", editando?.dataAdmissao)} /></div>
          </div>
          <button className="btn" type="submit">{editando ? "Salvar alterações" : "Cadastrar"}</button>
          {editando && <button className="btn secundario" type="button" style={{ marginLeft: 8 }} onClick={() => { setEditando(null); setForm({}); }}>Cancelar</button>}
        </form>
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-roxa pequeno">👔</span><h3>Funcionários ({funcionarios.length})</h3></div>
        {funcionarios.length === 0 && <p>Nenhum funcionário cadastrado ainda.</p>}
        {funcionarios.map((f: any) => (
          <div key={f.id} className="item-lista">
            <span className={`chip-icone pequeno ${f.ativo ? "chip-roxa" : "chip-cinza"}`}>👔</span>
            <div className="item-lista-corpo">
              <strong>{f.nome}</strong>
              <div className="item-meta">{f.cargo} · {f.tipoContrato} · {brl(f.salarioMensal)}/mês · admitido em {dataBR(f.dataAdmissao)}</div>
            </div>
            <div className="item-lista-lado">
              {f.ativo ? <span className="etiqueta verde">ativo</span> : <span className="etiqueta cinza">inativo</span>}
              <div className="item-lista-acoes">
                <button className="btn secundario pequeno" onClick={() => { setEditando(f); setForm({}); }}>Editar</button>
                <button className="btn secundario pequeno" onClick={async () => {
                  const d = await acao("alternarFuncionarioAtivo", { id: f.id });
                  if (d?.ok) setOk(d.ativo ? "Funcionário ativado." : "Funcionário desativado. Ele não entra nas próximas folhas.");
                }}>{f.ativo ? "Desativar" : "Ativar"}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-azul pequeno">📋</span><h3>Folha de pagamento</h3></div>
        <div className="linha">
          <div className="campo"><label>Mês</label><input type="month" value={mesFolha} onChange={(e) => setMesFolha(e.target.value)} /></div>
        </div>
        {!folha && (
          <button className="btn" onClick={async () => {
            const d = await acao("gerarFolhaMes", { mes: mesFolha });
            if (d?.ok) setOk(`Folha de ${nomeMes(mesFolha)} gerada com ${d.criados} funcionário(s).`);
          }}>Gerar folha do mês</button>
        )}
        {folha && (
          <div>
            <p><strong>Folha de {nomeMes(folha.mes)}</strong> · Total líquido: <strong>{brl(folha.totalLiquido)}</strong></p>
            {folha.itens.map((item: any) => (
              <div key={item.funcionarioId} className="item-lista">
                <span className={`chip-icone pequeno ${item.pago ? "chip-verde" : "chip-amarela"}`}>💰</span>
                <div className="item-lista-corpo">
                  <strong>{item.funcionarioNome}</strong>
                  <div className="item-meta">{item.cargo} · base {brl(item.salarioBase)}</div>
                <div className="linha" style={{ marginTop: 8 }}>
                  <div className="campo"><label>Adiantamento (R$)</label><input type="number" step="0.01" min="0" disabled={item.pago} value={valorEdicao(item.funcionarioId, "adiantamento", item.adiantamento)} onChange={(e) => mudarEdicao(item.funcionarioId, "adiantamento", e.target.value)} /></div>
                  <div className="campo"><label>Descontos (R$)</label><input type="number" step="0.01" min="0" disabled={item.pago} value={valorEdicao(item.funcionarioId, "descontos", item.descontos)} onChange={(e) => mudarEdicao(item.funcionarioId, "descontos", e.target.value)} /></div>
                  <div className="campo"><label>Extras (R$)</label><input type="number" step="0.01" min="0" disabled={item.pago} value={valorEdicao(item.funcionarioId, "extras", item.extras)} onChange={(e) => mudarEdicao(item.funcionarioId, "extras", e.target.value)} /></div>
                </div>
                <p>Líquido: <strong>{brl(item.liquido)}</strong></p>
                </div>
                <div className="item-lista-lado">
                  {item.pago ? <span className="etiqueta verde">pago</span> : <span className="etiqueta amber">a pagar</span>}
                  <div className="item-lista-acoes">
                    {!item.pago && (
                    <>
                      <button className="btn secundario pequeno" onClick={async () => {
                        const d = await acao("editarFolhaItem", {
                          folhaId: folha.id,
                          funcionarioId: item.funcionarioId,
                          adiantamento: Number(valorEdicao(item.funcionarioId, "adiantamento", item.adiantamento)) || 0,
                          descontos: Number(valorEdicao(item.funcionarioId, "descontos", item.descontos)) || 0,
                          extras: Number(valorEdicao(item.funcionarioId, "extras", item.extras)) || 0,
                        });
                        if (d?.ok) { setOk("Item atualizado."); setEdicao({ ...edicao, [item.funcionarioId]: { adiantamento: "0", descontos: "0", extras: "0" } }); }
                      }}>Salvar valores</button>
                      <button className="btn pequeno" onClick={async () => {
                        const d = await acao("pagarFolhaItem", { folhaId: folha.id, funcionarioId: item.funcionarioId });
                        if (d?.ok) setOk("Pagamento registrado e lançado no Financeiro.");
                      }}>Marcar como pago</button>
                    </>
                  )}
                  </div>
                </div>
              </div>
            ))}
            <p style={{ marginTop: 10 }}>
              Total bruto: <strong>{brl(folha.itens.reduce((s: number, i: any) => s + i.salarioBase + i.extras, 0))}</strong> ·{" "}
              Adiantamentos e descontos: <strong>{brl(folha.itens.reduce((s: number, i: any) => s + i.adiantamento + i.descontos, 0))}</strong> ·{" "}
              Total líquido: <strong>{brl(folha.totalLiquido)}</strong>
            </p>
            {!folha.itens.some((i: any) => i.pago) && (
              <button className="btn perigo pequeno" onClick={async () => {
                if (confirm(`Excluir a folha de ${nomeMes(folha.mes)}?`)) {
                  const d = await acao("excluirFolhaMes", { folhaId: folha.id });
                  if (d?.ok) setOk("Folha excluída.");
                }
              }}>Excluir folha do mês</button>
            )}
          </div>
        )}
        {folhas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h4>Folhas geradas</h4>
            {[...folhas].sort((a: any, b: any) => (a.mes < b.mes ? 1 : -1)).map((f: any) => (
              <div key={f.id} className="item-lista">
                <span className="chip-icone chip-azul pequeno">📋</span>
                <div className="item-lista-corpo">
                  <strong>{brl(f.totalLiquido)}</strong>
                  <div className="item-meta">{f.itens.filter((i: any) => i.pago).length}/{f.itens.length} pago(s)</div>
                </div>
                <div className="item-lista-lado">
                  <button className="btn secundario pequeno" onClick={() => setMesFolha(f.mes)}>{nomeMes(f.mes)}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanoTab({ estado, ehSindico, acao, setOk, setErro }: { estado: any; ehSindico: boolean; acao: (n: string, a?: Record<string, unknown>) => Promise<any>; setOk: (s: string) => void; setErro: (s: string) => void }) {
  const condominio = estado.condominio;
  const [novoNome, setNovoNome] = useState("");
  const [copiado, setCopiado] = useState(false);
  // Plano promocional do Mercado Pago (R$ 9,90/mês nos 6 primeiros meses).
  // O botão de R$ 97/mês só aparece depois que o condomínio já usou a promoção.
  const PLANO_PROMOCIONAL_ID = "b6d59f07efcd4142b013b9d2f7519261";
  const jaUsouPromo = condominio.assinaturaPlanoId === PLANO_PROMOCIONAL_ID;
  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(condominio.codigoConvite);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = condominio.codigoConvite;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  async function assinar(plano: "promocional" | "mensal") {
    const d = await acao("assinarMercadoPago", { plano });
    if (d?.ok && d.initPoint) {
      window.open(d.initPoint, "_blank");
      setOk("Abrimos o checkout do Mercado Pago em outra aba. Depois do pagamento, sua assinatura é ativada automaticamente.");
    }
  }
  async function salvarNome() {
    const nome = novoNome.trim();
    if (!nome) {
      setErro("Informe o novo nome do condomínio.");
      return;
    }
    if (nome === condominio.nome) {
      setErro("O novo nome é igual ao atual.");
      return;
    }
    const d = await acao("renomearCondominio", { nome });
    if (d?.ok) {
      setNovoNome("");
      setOk("Nome do condomínio atualizado.");
    }
  }
  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-amarela">⭐</span>
        <div>
          <h2>Plano e FAQ</h2>
          <p>Assinatura, dados do condomínio e dúvidas frequentes.</p>
        </div>
      </div>
      {ehSindico && (
        <div className="cartao">
          <div className="cartao-titulo"><span className="chip-icone chip-azul pequeno">🏢</span><h3>Dados do condomínio</h3></div>
          <p><strong>Nome atual:</strong> {condominio.nome}</p>
          <p><strong>Código de convite:</strong> {condominio.codigoConvite}{" "}
            <button className="btn secundario" style={{ padding: "4px 14px", fontSize: 14 }} onClick={copiarCodigo}>{copiado ? "✓ Copiado!" : "Copiar"}</button>
          </p>
          <p style={{ fontSize: 13, opacity: 0.8 }}>Passe o código aos moradores para eles criarem a conta.</p>
          <label>Novo nome do condomínio</label>
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Condomínio Vila Verde" maxLength={100} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={salvarNome}>Salvar novo nome</button>
          </div>
          <p style={{ fontSize: 13, opacity: 0.8 }}>O novo nome aparece no painel de todos os moradores. O código de convite não muda.</p>
        </div>
      )}
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-amarela pequeno">⭐</span><h2 style={{ margin: 0, fontSize: 20, color: "var(--navy)" }}>Plano e FAQ</h2></div>
        <p><strong>Status:</strong> {estado.statusAssinatura.texto}</p>
        <p><strong>Preço:</strong> R$ 9,90/mês nos 6 primeiros meses, depois R$ 97/mês por condomínio. 14 dias grátis, sem cartão. Cancele quando quiser, sem fidelidade e sem multa.</p>
        {condominio.assinaturaStatus !== "ativa" && ehSindico && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {jaUsouPromo ? (
              <button className="btn" onClick={() => assinar("mensal")}>Assinar — R$ 97/mês</button>
            ) : (
              <button className="btn" onClick={() => assinar("promocional")}>Assinar — R$ 9,90/mês (6 meses)</button>
            )}
          </div>
        )}
        {condominio.assinaturaStatus === "ativa" && ehSindico && (
          <button className="btn perigo" onClick={async () => {
            if (confirm("Cancelar a assinatura? Você mantém os dados, mas não poderá criar novos itens até assinar de novo. Lembre de cancelar também no Mercado Pago.")) {
              const d = await acao("cancelarAssinatura", {});
              if (d?.ok) setOk("Assinatura cancelada. Seus dados continuam visíveis.");
            }
          }}>Cancelar assinatura</button>
        )}
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-rosa pequeno">❓</span><h3>Perguntas frequentes</h3></div>
        <p><strong>Posso começar agora?</strong><br />Sim. O cadastro leva 1 minuto e você já usa tudo no teste grátis de 14 dias, sem cartão.</p>
        <p><strong>O morador precisa baixar aplicativo?</strong><br />Não. É um link só, que funciona no celular e no computador.</p>
        <p><strong>O CondoFree recebe o valor do boleto?</strong><br />Não. O valor do boleto é do condomínio e vai para a conta do condomínio.</p>
        <p><strong>Como cancelo?</strong><br />Aqui mesmo, no botão acima, ou direto no Mercado Pago. Sem multa e sem fidelidade.</p>
      </div>
    </div>
  );
}

function urlBase64ParaUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Banner "Instalar app" que aparece sozinho quando o navegador oferece a
// instalação (Android/Chrome). O navegador NÃO deixa mostrar o convite
// nativo sozinho ao entrar no site — o convite só abre quando a pessoa
// toca em "Instalar". No iPhone, mostra o passo a passo do Safari.
// Botão "Baixar o app" do cartão da tela inicial: chama o mesmo prompt de
// instalação do banner e da aba Ajuda (beforeinstallprompt). No iPhone não
// há prompt — mostra as instruções do Safari. Quando o app já está
// instalado (evento appinstalled), o botão some.
function BotaoInstalarApp() {
  const [instalado, setInstalado] = useState(false);
  const [ehIos, setEhIos] = useState(false);
  const [promptInstalacao, setPromptInstalacao] = useState<BeforeInstallPromptEvent | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setEhIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalado(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true,
    );
    const aoPerguntar = (e: Event) => {
      e.preventDefault();
      setPromptInstalacao(e as unknown as BeforeInstallPromptEvent);
    };
    const aoInstalar = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", aoPerguntar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPerguntar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (instalado) return null;

  async function instalar() {
    if (promptInstalacao) {
      try {
        promptInstalacao.prompt();
      } catch {
        setMsg("No menu do navegador, procure “Instalar app” ou “Adicionar à tela inicial”.");
        return;
      }
      const escolha = await promptInstalacao.userChoice;
      if (escolha.outcome === "accepted") { setInstalado(true); return; }
      setPromptInstalacao(null);
      return;
    }
    if (ehIos) {
      setMsg("No iPhone: toque no botão Compartilhar do Safari e depois em “Adicionar à Tela de Início”.");
      return;
    }
    setMsg("No menu do navegador, procure “Instalar app” ou “Adicionar à tela inicial”.");
  }

  return (
    <>
      <button className="btn" onClick={instalar}>📱 Baixar o app</button>
      {msg && <span style={{ color: "#5b6b7d", fontSize: 14, flexBasis: "100%" }}>{msg}</span>}
    </>
  );
}

function BannerInstalar() {
  const [promptInstalacao, setPromptInstalacao] = useState<BeforeInstallPromptEvent | null>(null);
  const [ehIos, setEhIos] = useState(false);
  const [instalado, setInstalado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [msgIos, setMsgIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) { setInstalado(true); return; }
    if (localStorage.getItem("condofree-banner-instalar") === "dispensado") return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setEhIos(ios);
    const aoPerguntar = (e: Event) => {
      e.preventDefault();
      setPromptInstalacao(e as unknown as BeforeInstallPromptEvent);
      setVisivel(true);
    };
    const aoInstalar = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", aoPerguntar);
    window.addEventListener("appinstalled", aoInstalar);
    if (ios) setVisivel(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPerguntar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (instalado || !visivel) return null;

  async function instalar() {
    if (promptInstalacao) {
      try {
        promptInstalacao.prompt();
      } catch {
        setMsgIos(true);
        return;
      }
      const escolha = await promptInstalacao.userChoice;
      if (escolha.outcome === "accepted") { setInstalado(true); return; }
      setPromptInstalacao(null);
      return;
    }
    setMsgIos(true);
  }
  function dispensar() {
    localStorage.setItem("condofree-banner-instalar", "dispensado");
    setVisivel(false);
  }

  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: 76, zIndex: 45, maxWidth: 520, margin: "0 auto", background: "#0b2a4a", color: "#fff", borderRadius: 16, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
      <span style={{ fontSize: 28 }}>📱</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800 }}>Instalar o CondoFree como app</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          {msgIos || ehIos ? "No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”." : "Abre em tela cheia, como aplicativo, sem baixar nada da loja."}
        </div>
      </div>
      <button onClick={instalar} style={{ background: "#22a06b", color: "#fff", border: 0, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>Instalar</button>
      <button onClick={dispensar} aria-label="Fechar" style={{ background: "none", border: 0, color: "#fff", fontSize: 20, cursor: "pointer", padding: 4 }}>×</button>
    </div>
  );
}

// Contador de moradores com notificações ativadas (só o síndico vê).
// Responde "quantos vão receber de verdade" quando ele publica um aviso.
function ContadorPush({ texto }: { texto: (com: number, total: number) => string }) {
  const [resumo, setResumo] = useState<{ moradores: number; comNotificacao: number } | null>(null);
  useEffect(() => {
    fetch("/api/push/resumo")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setResumo({ moradores: d.moradores, comNotificacao: d.comNotificacao });
      })
      .catch(() => {});
  }, []);
  if (!resumo) return null;
  if (resumo.moradores === 0) {
    return <p style={{ color: "#5b6b7d", marginTop: 8 }}>📬 Nenhum morador cadastrado ainda — cadastre moradores para eles receberem seus avisos por notificação.</p>;
  }
  return <p style={{ color: "#5b6b7d", marginTop: 8 }}>📬 {texto(resumo.comNotificacao, resumo.moradores)}</p>;
}

// Instalar o CondoFree como app + ativar notificações. O botão de
// instalar só aparece quando o navegador oferece (Android/Chrome); no
// iPhone a instalação é pelo Safari, "Adicionar à Tela de Início".
function AppENotificacoes({ ehSindico }: { ehSindico: boolean }) {
  const [instalado, setInstalado] = useState(false);
  const [ehIos, setEhIos] = useState(false);
  const [promptInstalacao, setPromptInstalacao] = useState<BeforeInstallPromptEvent | null>(null);
  const [notif, setNotif] = useState<"carregando" | "ativo" | "inativo" | "bloqueado" | "sem-suporte">("carregando");
  const [msg, setMsg] = useState("");
  const [agindo, setAgindo] = useState(false);
  const [testando, setTestando] = useState(false);

  useEffect(() => {
    setEhIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalado(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true,
    );
    const aoPerguntar = (e: Event) => {
      e.preventDefault();
      setPromptInstalacao(e as unknown as BeforeInstallPromptEvent);
    };
    const aoInstalar = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", aoPerguntar);
    window.addEventListener("appinstalled", aoInstalar);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotif("sem-suporte");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setNotif(sub ? "ativo" : "inativo"))
      .catch(() => setNotif("inativo"));
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPerguntar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  async function instalar() {
    if (promptInstalacao) {
      try {
        promptInstalacao.prompt();
      } catch {
        setMsg("No menu do navegador, procure “Instalar app” ou “Adicionar à tela inicial”.");
        return;
      }
      const escolha = await promptInstalacao.userChoice;
      if (escolha.outcome === "accepted") setInstalado(true);
      setPromptInstalacao(null);
      return;
    }
    if (ehIos) {
      setMsg("No iPhone: toque no botão Compartilhar do Safari e depois em “Adicionar à Tela de Início”.");
      return;
    }
    setMsg("No menu do navegador, procure “Instalar app” ou “Adicionar à tela inicial”.");
  }

  async function alternarNotificacoes() {
    setMsg("");
    setAgindo(true);
    try {
      if (notif === "ativo") {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch("/api/push/desinscrever", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setNotif("inativo");
        return;
      }
      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) {
        setMsg("As notificações ainda estão sendo ligadas no servidor. Tente de novo em instantes.");
        return;
      }
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setNotif("bloqueado");
        setMsg("Você bloqueou as notificações. Para ativar, libere nas configurações do navegador, no cadeado ao lado do endereço.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ParaUint8Array(chave),
      });
      const res = await fetch("/api/push/inscrever", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const d = await res.json();
      if (!d.ok) {
        setMsg(d.erro || "Não foi possível ativar as notificações.");
        return;
      }
      setNotif("ativo");
    } catch {
      setMsg("Não foi possível ativar as notificações neste aparelho. Tente de novo.");
    } finally {
      setAgindo(false);
    }
  }

  async function enviarTeste() {
    setMsg("");
    setTestando(true);
    try {
      const res = await fetch("/api/push/teste", { method: "POST" });
      const d = await res.json();
      setMsg(d.ok ? "Notificação de teste enviada — deve chegar neste aparelho em alguns segundos." : (d.erro || "Não foi possível enviar o teste."));
    } catch {
      setMsg("Não foi possível enviar o teste. Tente de novo.");
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="cartao" style={{ marginTop: 16 }}>
      <h2>📱 App e notificações</h2>
      <p>
        {instalado
          ? "O CondoFree já está instalado como app neste aparelho."
          : "Instale o CondoFree na tela inicial: abre em tela cheia, como aplicativo, sem baixar nada da loja."}
      </p>
      {!instalado && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={instalar}>Instalar app</button>
        </div>
      )}
      <h3 style={{ marginTop: 16 }}>Notificações</h3>
      <p>
        {notif === "ativo"
          ? ehSindico
            ? "Notificações ativadas neste aparelho: você recebe aviso quando um morador abrir ocorrência ou pedir reserva."
            : "Notificações ativadas neste aparelho: você recebe aviso quando o síndico criar votação ou aviso, e quando sua reserva for respondida."
          : notif === "bloqueado"
            ? "As notificações estão bloqueadas neste navegador."
            : notif === "sem-suporte"
              ? "Este navegador não suporta notificações do CondoFree."
              : ehSindico
                ? "Ative para receber aviso quando um morador abrir ocorrência ou pedir reserva."
                : "Ative para receber aviso quando o síndico criar votação ou aviso, e quando sua reserva for respondida."}
      </p>
      {(notif === "ativo" || notif === "inativo" || notif === "bloqueado") && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={alternarNotificacoes} disabled={agindo}>
            {agindo ? "Aguarde..." : notif === "ativo" ? "Desativar notificações" : "Ativar notificações"}
          </button>
          {notif === "ativo" && (
            <button className="btn secundario" onClick={enviarTeste} disabled={testando}>
              {testando ? "Enviando..." : "Enviar notificação de teste"}
            </button>
          )}
        </div>
      )}
      {ehSindico && (
        <ContadorPush texto={(com, total) => `${com} de ${total} morador(es) com notificações ativadas — eles recebem seus avisos e votações.`} />
      )}
      {msg && <p style={{ color: "#5b6b7d", marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

function AjudaTab({ ehSindico, abrirSuporte }: { ehSindico: boolean; abrirSuporte: (s: string) => void }) {
  return (
    <div>
      <div className="tab-cabecalho">
        <span className="chip-icone chip-rosa">❓</span>
        <div>
          <h2>Ajuda / Suporte</h2>
          <p>Como funciona o CondoFree e como falar com o suporte.</p>
        </div>
      </div>
      <div className="cartao">
        <div className="cartao-titulo"><span className="chip-icone chip-rosa pequeno">❓</span><h3>Como funciona — passo a passo</h3></div>
        {ehSindico ? (
          <ol>
            <li>Cadastre os moradores na aba Moradores ou passe o código de convite para eles se cadastrarem.</li>
            <li>Crie os espaços do condomínio na aba Reservas.</li>
            <li>Poste o primeiro aviso no mural e acompanhe quem leu.</li>
            <li>Crie cobranças na aba Cobranças.</li>
            <li>Quando o teste grátis acabar, assine na aba Plano e FAQ.</li>
          </ol>
        ) : (
          <ol>
            <li>Veja os avisos no mural e marque que leu.</li>
            <li>Reserve o salão ou a churrasqueira na aba Reservas.</li>
            <li>Abra uma ocorrência com foto se algo precisar de reparo.</li>
            <li>Veja suas cobranças na aba Cobranças.</li>
            <li>Vote nas decisões do condomínio na aba Votações.</li>
          </ol>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => abrirSuporte("Tenho uma dúvida sobre o CondoFree.")}>Falar no WhatsApp</button>
        </div>
      </div>
      <AppENotificacoes ehSindico={ehSindico} />
    </div>
  );
}
