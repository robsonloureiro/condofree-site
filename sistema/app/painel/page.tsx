"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Aba = "inicio" | "reservas" | "avisos" | "ocorrencias" | "boletos" | "financeiro" | "votacoes" | "moradores" | "plano" | "ajuda";

const MODULOS: { id: Aba; rotulo: string; icone: string; papeis: ("sindico" | "morador")[] }[] = [
  { id: "inicio", rotulo: "Início", icone: "🏠", papeis: ["sindico", "morador"] },
  { id: "reservas", rotulo: "Reservas", icone: "📅", papeis: ["sindico", "morador"] },
  { id: "avisos", rotulo: "Avisos", icone: "📢", papeis: ["sindico", "morador"] },
  { id: "ocorrencias", rotulo: "Ocorrências", icone: "🔧", papeis: ["sindico", "morador"] },
  { id: "boletos", rotulo: "Boletos", icone: "🧾", papeis: ["sindico", "morador"] },
  { id: "financeiro", rotulo: "Financeiro", icone: "💰", papeis: ["sindico", "morador"] },
  { id: "votacoes", rotulo: "Votações", icone: "🗳️", papeis: ["sindico", "morador"] },
  { id: "moradores", rotulo: "Moradores", icone: "👥", papeis: ["sindico"] },
  { id: "plano", rotulo: "Plano e FAQ", icone: "⭐", papeis: ["sindico", "morador"] },
  { id: "ajuda", rotulo: "Ajuda", icone: "❓", papeis: ["sindico", "morador"] },
];

const WHATS = "https://wa.me/5521991512329";

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
  const boletosPendentes = estado.boletos.filter((b: any) => b.status === "pendente").length;
  const votacoesAbertas = estado.votacoes.filter((v: any) => v.aberta).length;

  return (
    <div>
      <header className="topo">
        <button className="hamburguer" onClick={() => setGaveta(true)} aria-label="Abrir menu">☰</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.png" alt="CondoFree" />
        <div>
          <div className="titulo">{estado.condominio.nome}</div>
          <div className="sub">Síndico: {ehSindico ? usuario.nome : "Síndico do condomínio"}</div>
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
      </nav>

      <div className="container">
        <div className="menu-grade">
          {modulosVisiveis.map((m) => (
            <button key={m.id} className={aba === m.id ? "ativo" : ""} onClick={() => irPara(m.id)}>
              <span className="icone">{m.icone}</span>
              {m.rotulo}
            </button>
          ))}
        </div>

        {erro && <div className="erro">{erro}</div>}
        {ok && <div className="ok-msg">{ok}</div>}

        {aba === "inicio" && (
          <div>
            <div className="cards">
              <div className="cartao"><div className="resumo-numero">{reservasPendentes}</div><div className="resumo-rotulo">reservas pendentes</div></div>
              <div className="cartao"><div className="resumo-numero">{estado.avisos.length}</div><div className="resumo-rotulo">avisos no mural</div></div>
              <div className="cartao"><div className="resumo-numero">{ocorrenciasAbertas}</div><div className="resumo-rotulo">ocorrências abertas</div></div>
              <div className="cartao"><div className="resumo-numero">{boletosPendentes}</div><div className="resumo-rotulo">boletos pendentes</div></div>
              <div className="cartao"><div className="resumo-numero">{votacoesAbertas}</div><div className="resumo-rotulo">votações abertas</div></div>
              <div className="cartao"><div className="resumo-numero">{brl(estado.resumoFinanceiro.saldo)}</div><div className="resumo-rotulo">saldo do mês</div></div>
            </div>
            <div className="cartao">
              <h2>Bem-vindo ao CondoFree</h2>
              <p>Mais controle, zero burocracia. Use o menu acima para reservar espaços, ler avisos, abrir ocorrências, ver boletos e votar.</p>
              <p style={{ color: "#5b6b7d" }}>Código de convite do condomínio: <strong>{estado.condominio.codigoConvite}</strong> — passe aos moradores para eles criarem a conta.</p>
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
          <BoletosTab estado={estado} ehSindico={ehSindico} campo={campo} form={form} setForm={setForm} acao={acao} setOk={setOk} />
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
        {aba === "plano" && (
          <PlanoTab estado={estado} ehSindico={ehSindico} acao={acao} setOk={setOk} setErro={setErro} />
        )}
        {aba === "ajuda" && (
          <AjudaTab ehSindico={ehSindico} abrirSuporte={abrirSuporte} />
        )}
      </div>

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
      <div className="cartao">
        <h2>📅 Reservas de espaços</h2>
        <p>Reserve o salão, a churrasqueira e outros espaços do condomínio, sem conflito de horário.</p>
      </div>
      <div className="cartao">
        <h3>Nova reserva</h3>
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
          <h3>Espaços do condomínio</h3>
          {estado.espacos.map((e: any) => (
            <p key={e.id}>
              {e.nome}{" "}
              <button className="btn secundario pequeno" onClick={async () => {
                if (confirm(`Excluir ${e.nome}? As reservas futuras dele serão canceladas.`)) {
                  const d = await acao("removerEspaco", { id: e.id });
                  if (d?.ok) setOk("Espaço removido.");
                }
              }}>Excluir</button>
            </p>
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
        <h3>Reservas</h3>
        {estado.reservas.length === 0 && <p>Nenhuma reserva ainda.</p>}
        {estado.reservas.map((r: any) => (
          <div key={r.id} style={{ borderBottom: "1px solid #dde5ee", padding: "8px 0" }}>
            <strong>{r.espacoNome}</strong> — {dataBR(r.data)} {r.inicio} às {r.fim} · {r.moradorNome}{" "}
            {r.status === "pendente" && <span className="etiqueta amber">pendente</span>}
            {r.status === "aprovada" && <span className="etiqueta verde">aprovada</span>}
            {r.status === "recusada" && <span className="etiqueta vermelha">recusada</span>}
            {r.status === "cancelada" && <span className="etiqueta cinza">cancelada</span>}
            <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
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
        ))}
      </div>
    </div>
  );
}

function AvisosTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  return (
    <div>
      <div className="cartao">
        <h2>📢 Mural de avisos</h2>
        <p>Os avisos do síndico ficam aqui, sempre à vista. Marque que leu para o síndico saber.</p>
      </div>
      {ehSindico && (
        <div className="cartao">
          <h3>Novo aviso</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const d = await acao("criarAviso", { titulo: form.tituloAviso, texto: form.textoAviso });
            if (d?.ok) { setOk("Aviso publicado."); setForm({}); }
          }}>
            <div className="campo"><label>Título</label><input {...campo("tituloAviso")} /></div>
            <div className="campo"><label>Texto</label><textarea rows={3} {...campo("textoAviso")} /></div>
            <button className="btn" type="submit">Publicar aviso</button>
          </form>
        </div>
      )}
      {estado.avisos.map((a: any) => {
        const euLi = estado.eu && a.lidoPor.includes(estado.eu.id);
        return (
          <div key={a.id} className="cartao">
            <h3>{a.titulo}</h3>
            <p>{a.texto}</p>
            <p style={{ color: "#5b6b7d", fontSize: 14 }}>
              {a.lidoPor.length} morador(es) leram
              {ehSindico && a.lidoPor.length > 0 && (
                <>: {a.lidoPor.map((id: string) => estado.moradores.find((m: any) => m.id === id)?.nome).filter(Boolean).join(", ")}</>
              )}
            </p>
            {!ehSindico && !euLi && (
              <button className="btn pequeno" onClick={() => acao("marcarLido", { avisoId: a.id })}>Li o aviso ✓</button>
            )}
            {!ehSindico && euLi && <span className="etiqueta verde">Você já leu ✓</span>}
            {ehSindico && (
              <button className="btn perigo pequeno" onClick={() => acao("removerAviso", { id: a.id })}>Remover</button>
            )}
          </div>
        );
      })}
      {estado.avisos.length === 0 && <div className="cartao"><p>Nenhum aviso ainda.</p></div>}
    </div>
  );
}

function OcorrenciasTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  const [fotoUrl, setFotoUrl] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoFoto(true);
    const fd = new FormData();
    fd.append("foto", arquivo);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    setEnviandoFoto(false);
    if (d.ok) setFotoUrl(d.url);
  }
  return (
    <div>
      <div className="cartao">
        <h2>🔧 Ocorrências</h2>
        <p>Avise o síndico sobre algo que precisa de reparo, com foto e local. Acompanhe o status aqui.</p>
      </div>
      <div className="cartao">
        <h3>Nova ocorrência</h3>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const d = await acao("criarOcorrencia", { titulo: form.tituloOc, descricao: form.descOc, local: form.localOc, fotoUrl });
          if (d?.ok) { setOk("Ocorrência registrada."); setForm({}); setFotoUrl(""); }
        }}>
          <div className="campo"><label>Título</label><input {...campo("tituloOc")} placeholder="Ex.: Lâmpada queimada" /></div>
          <div className="campo"><label>Descrição</label><textarea rows={3} {...campo("descOc")} /></div>
          <div className="campo"><label>Local</label><input {...campo("localOc")} placeholder="Ex.: Bloco B, 2º andar" /></div>
          <div className="campo">
            <label>Foto (opcional)</label>
            <input type="file" accept="image/*" onChange={enviarFoto} />
            {enviandoFoto && <p>Enviando foto...</p>}
            {fotoUrl && <p style={{ color: "#166534" }}>Foto anexada ✓</p>}
          </div>
          <button className="btn" type="submit">Registrar ocorrência</button>
        </form>
      </div>
      {estado.ocorrencias.map((o: any) => (
        <div key={o.id} className="cartao">
          <h3>{o.titulo}</h3>
          <p>{o.descricao}</p>
          <p style={{ color: "#5b6b7d" }}>{o.local} · por {o.moradorNome}</p>
          {o.fotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.fotoUrl} alt="Foto da ocorrência" style={{ maxWidth: "100%", borderRadius: 12 }} />
          )}
          <p>
            {o.status === "aberta" && <span className="etiqueta vermelha">aberta</span>}
            {o.status === "em_andamento" && <span className="etiqueta amber">em andamento</span>}
            {o.status === "resolvida" && <span className="etiqueta verde">resolvida</span>}
          </p>
          {ehSindico && o.status !== "resolvida" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn pequeno" onClick={() => acao("mudarStatusOcorrencia", { id: o.id, status: "em_andamento" })}>Em andamento</button>
              <button className="btn pequeno" onClick={() => acao("mudarStatusOcorrencia", { id: o.id, status: "resolvida" })}>Resolver</button>
            </div>
          )}
        </div>
      ))}
      {estado.ocorrencias.length === 0 && <div className="cartao"><p>Nenhuma ocorrência ainda.</p></div>}
    </div>
  );
}

function BoletosTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  return (
    <div>
      <div className="cartao">
        <h2>🧾 Boletos</h2>
        <p>2ª via do boleto do condomínio, sempre aqui.</p>
        <p style={{ color: "#5b6b7d", fontSize: 14 }}>O CondoFree não recebe o valor do boleto. O pagamento vai direto para a conta do condomínio.</p>
      </div>
      {ehSindico && (
        <div className="cartao">
          <h3>Gerar boletos do mês</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const d = await acao("gerarBoletosMes", { mes: form.mesBoleto || new Date().toISOString().slice(0, 7), valor: Number(form.valorBoleto) });
            if (d?.ok) setOk(`${d.criados} boleto(s) gerado(s).`);
          }}>
            <div className="linha">
              <div className="campo"><label>Mês</label><input type="month" {...campo("mesBoleto")} /></div>
              <div className="campo"><label>Valor da taxa (R$)</label><input type="number" step="0.01" {...campo("valorBoleto")} placeholder="482,90" /></div>
            </div>
            <button className="btn" type="submit">Gerar boletos do mês</button>
          </form>
        </div>
      )}
      {estado.boletos.map((b: any) => (
        <div key={b.id} className="cartao">
          <h3>{b.moradorNome} — {brl(b.valor)}</h3>
          <p>Vencimento: {dataBR(b.vencimento)}</p>
          <p>
            {b.status === "pago" && <span className="etiqueta verde">pago</span>}
            {b.status === "pendente" && <span className="etiqueta amber">pendente</span>}
            {b.status === "vencido" && <span className="etiqueta vermelha">vencido</span>}
          </p>
          {b.codigoBarras && <p style={{ fontSize: 13, wordBreak: "break-all" }}>Código de barras: {b.codigoBarras}</p>}
          {ehSindico && (
            <button className="btn pequeno" onClick={() => acao("alternarStatusBoleto", { id: b.id })}>
              {b.status === "pago" ? "Voltar para pendente" : "Marcar como pago"}
            </button>
          )}
        </div>
      ))}
      {estado.boletos.length === 0 && <div className="cartao"><p>Nenhum boleto ainda.</p></div>}
    </div>
  );
}

function FinanceiroTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const lancamentos = estado.lancamentos.filter((l: any) => l.data.slice(0, 7) === mes);
  const entradas = lancamentos.filter((l: any) => l.tipo === "receita" && l.pago).reduce((s: number, l: any) => s + l.valor, 0);
  const saidas = lancamentos.filter((l: any) => l.tipo === "despesa" && l.pago).reduce((s: number, l: any) => s + l.valor, 0);
  const pendentes = lancamentos.filter((l: any) => !l.pago);
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
        <div className="cartao">
          <h2>💰 Financeiro</h2>
          <p>Resumo do mês para os moradores:</p>
          <p>Entradas: <strong>{brl(estado.resumoFinanceiro.entradas)}</strong></p>
          <p>Saídas: <strong>{brl(estado.resumoFinanceiro.saidas)}</strong></p>
          <p>Saldo: <strong>{brl(estado.resumoFinanceiro.saldo)}</strong></p>
          <p style={{ color: "#5b6b7d", fontSize: 14 }}>O detalhamento completo é apresentado pelo síndico na assembleia.</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="cartao">
        <h2>💰 Financeiro — contabilidade simples</h2>
        <p>O CondoFree não recebe o valor do boleto. O dinheiro é do condomínio.</p>
      </div>
      <div className="cartao">
        <div className="campo">
          <label>Mês</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        <div className="cards">
          <div className="cartao"><div className="resumo-numero" style={{ color: "#166534" }}>{brl(entradas)}</div><div className="resumo-rotulo">entradas pagas</div></div>
          <div className="cartao"><div className="resumo-numero" style={{ color: "#b91c1c" }}>{brl(saidas)}</div><div className="resumo-rotulo">saídas pagas</div></div>
          <div className="cartao"><div className="resumo-numero">{brl(entradas - saidas)}</div><div className="resumo-rotulo">saldo do mês</div></div>
        </div>
        <button className="btn" onClick={baixarPrestacao}>Baixar prestação de contas</button>{" "}
        <button className="btn secundario" onClick={() => window.print()}>Imprimir</button>
      </div>
      <div className="cartao">
        <h3>Novo lançamento</h3>
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
        <h3>Lançamentos de {mes}</h3>
        {lancamentos.length === 0 && <p>Nenhum lançamento neste mês.</p>}
        {lancamentos.map((l: any) => (
          <div key={l.id} style={{ borderBottom: "1px solid #dde5ee", padding: "8px 0" }}>
            <strong>{l.descricao}</strong> — {brl(l.valor)} · {l.categoria} · {dataBR(l.data)}{" "}
            {l.pago ? <span className="etiqueta verde">pago</span> : <span className="etiqueta amber">pendente</span>}
            {l.origem === "boleto" && <span className="etiqueta cinza">boleto</span>}
            <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
              <button className="btn secundario pequeno" onClick={() => acao("marcarLancamentoPago", { id: l.id, pago: !l.pago })}>
                {l.pago ? "Marcar pendente" : "Marcar pago"}
              </button>
              {l.origem !== "boleto" && (
                <button className="btn perigo pequeno" onClick={() => acao("removerLancamento", { id: l.id })}>Remover</button>
              )}
            </div>
          </div>
        ))}
        {pendentes.length > 0 && <p style={{ color: "#b45309" }}>{pendentes.length} lançamento(s) pendente(s) neste mês.</p>}
      </div>
    </div>
  );
}

function VotacoesTab({ estado, ehSindico, campo, form, setForm, acao, setOk }: TabProps) {
  return (
    <div>
      <div className="cartao">
        <h2>🗳️ Votações</h2>
        <p>Decisões do condomínio com voto de cada morador e ata ao final.</p>
      </div>
      {ehSindico && (
        <div className="cartao">
          <h3>Nova votação</h3>
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
            <h3>{v.pergunta}</h3>
            <p>{v.aberta ? <span className="etiqueta verde">aberta</span> : <span className="etiqueta cinza">encerrada</span>} · {v.votos.length} voto(s)</p>
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
              <div style={{ marginTop: 12 }}>
                <h4>Ata gerada</h4>
                <pre style={{ whiteSpace: "pre-wrap", background: "#f2f5f8", padding: 12, borderRadius: 12 }}>{v.ata}</pre>
                <button className="btn secundario pequeno" onClick={() => {
                  const blob = new Blob([v.ata], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "ata-votacao.txt"; a.click();
                  URL.revokeObjectURL(url);
                }}>Baixar ata (.txt)</button>{" "}
                <button className="btn secundario pequeno" onClick={() => window.print()}>Imprimir</button>
              </div>
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
      <div className="cartao">
        <h2>👥 Moradores</h2>
        <p>Cadastro de moradores e unidades do condomínio.</p>
      </div>
      <div className="cartao">
        <h3>{emEdicao ? "Editar morador" : "Cadastrar morador"}</h3>
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
        <div key={p.id} className="cartao">
          <h3>Pedido de correção — {p.moradorNome}</h3>
          <p><strong>{p.campo}:</strong> errado: “{p.errado}” → certo: “{p.certo}”</p>
          <button className="btn pequeno" onClick={() => acao("responderCorrecao", { id: p.id, aprovar: true })}>Aprovar em 1 clique</button>{" "}
          <button className="btn perigo pequeno" onClick={() => acao("responderCorrecao", { id: p.id, aprovar: false })}>Recusar</button>
        </div>
      ))}
      <div className="cartao">
        <h3>Moradores cadastrados ({estado.moradores.length})</h3>
        {estado.moradores.map((m: any) => (
          <div key={m.id} style={{ borderBottom: "1px solid #dde5ee", padding: "8px 0" }}>
            <strong>{m.nome}</strong> — Bloco {m.bloco} · apto {m.apartamento} · {m.email || "sem e-mail"}{" "}
            <button className="btn secundario pequeno" onClick={() => { setEditandoMorador(m); setForm({}); }}>Editar</button>{" "}
            <button className="btn perigo pequeno" onClick={() => acao("removerMorador", { id: m.id })}>Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanoTab({ estado, ehSindico, acao, setOk, setErro }: { estado: any; ehSindico: boolean; acao: (n: string, a?: Record<string, unknown>) => Promise<any>; setOk: (s: string) => void; setErro: (s: string) => void }) {
  const condominio = estado.condominio;
  async function assinar(plano: "promocional" | "mensal") {
    const d = await acao("assinarMercadoPago", { plano });
    if (d?.ok && d.initPoint) {
      window.open(d.initPoint, "_blank");
      setOk("Abrimos o checkout do Mercado Pago em outra aba. Depois do pagamento, sua assinatura é ativada automaticamente.");
    }
  }
  return (
    <div>
      <div className="cartao">
        <h2>⭐ Plano e FAQ</h2>
        <p><strong>Status:</strong> {estado.statusAssinatura.texto}</p>
        <p><strong>Preço:</strong> R$ 9,90/mês nos 6 primeiros meses, depois R$ 97/mês por condomínio. 14 dias grátis, sem cartão. Cancele quando quiser, sem fidelidade e sem multa.</p>
        {condominio.assinaturaStatus !== "ativa" && ehSindico && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => assinar("promocional")}>Assinar — R$ 9,90/mês (6 meses)</button>
            <button className="btn secundario" onClick={() => assinar("mensal")}>Assinar — R$ 97/mês</button>
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
        <h3>Perguntas frequentes</h3>
        <p><strong>Posso começar agora?</strong><br />Sim. O cadastro leva 1 minuto e você já usa tudo no teste grátis de 14 dias, sem cartão.</p>
        <p><strong>O morador precisa baixar aplicativo?</strong><br />Não. É um link só, que funciona no celular e no computador.</p>
        <p><strong>O CondoFree recebe o valor do boleto?</strong><br />Não. O valor do boleto é do condomínio e vai para a conta do condomínio.</p>
        <p><strong>Como cancelo?</strong><br />Aqui mesmo, no botão acima, ou direto no Mercado Pago. Sem multa e sem fidelidade.</p>
      </div>
    </div>
  );
}

function AjudaTab({ ehSindico, abrirSuporte }: { ehSindico: boolean; abrirSuporte: (s: string) => void }) {
  return (
    <div>
      <div className="cartao">
        <h2>❓ Ajuda / Suporte</h2>
        <p>Precisa de ajuda? Fale com a gente no WhatsApp: <strong>(21) 99151-2329</strong></p>
        <p style={{ color: "#5b6b7d" }}>Sua mensagem vai para o nosso WhatsApp e respondemos por lá.</p>
      </div>
      <div className="cartao">
        <h3>Como funciona — passo a passo</h3>
        {ehSindico ? (
          <ol>
            <li>Cadastre os moradores na aba Moradores ou passe o código de convite para eles se cadastrarem.</li>
            <li>Crie os espaços do condomínio na aba Reservas.</li>
            <li>Poste o primeiro aviso no mural e acompanhe quem leu.</li>
            <li>Gere os boletos do mês na aba Boletos.</li>
            <li>Quando o teste grátis acabar, assine na aba Plano e FAQ.</li>
          </ol>
        ) : (
          <ol>
            <li>Veja os avisos no mural e marque que leu.</li>
            <li>Reserve o salão ou a churrasqueira na aba Reservas.</li>
            <li>Abra uma ocorrência com foto se algo precisar de reparo.</li>
            <li>Veja a 2ª via do seu boleto na aba Boletos.</li>
            <li>Vote nas decisões do condomínio na aba Votações.</li>
          </ol>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => abrirSuporte("Tenho uma dúvida sobre o CondoFree.")}>Falar no WhatsApp</button>
          <button className="btn secundario" onClick={() => abrirSuporte("Quanto custa o CondoFree?")}>Quanto custa?</button>
          <button className="btn secundario" onClick={() => abrirSuporte("Como funciona o teste grátis?")}>Como funciona o teste grátis?</button>
        </div>
      </div>
    </div>
  );
}
