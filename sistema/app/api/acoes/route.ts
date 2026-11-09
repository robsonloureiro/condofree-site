import { NextRequest } from "next/server";
import { usuarioDaSessao, listarUsuarios, salvarUsuarios, novoId } from "@/lib/auth";
import { carregarDados, salvarDados, podeCriar, erroCriacaoBloqueada, listarCondominios, salvarCondominios } from "@/lib/dados";
import { hojeISO, dataBR, brl } from "@/lib/store";
import { enviarPushParaCondominio, enviarPushParaSindico, enviarPushParaUsuarios } from "@/lib/push";
import type { DadosCondominio } from "@/lib/types";

const PLANOS_MP = {
  promocional: {
    id: "b6d59f07efcd4142b013b9d2f7519261",
    initPoint:
      "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=b6d59f07efcd4142b013b9d2f7519261",
  },
  mensal: {
    id: "c70e5c528b6f4bad8b11a517cdeca831",
    initPoint:
      "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=c70e5c528b6f4bad8b11a517cdeca831",
  },
} as const;

// Descrição do lançamento no Financeiro: a cobrança é da unidade, então
// mostra bloco+apto (ex.: "Taxa do condomínio — Bloco A, apto 101") em vez
// do nome do morador. Para cobranças antigas sem unidade na cobrança,
// busca a unidade do morador; sem ela, mantém o nome.
function descricaoLancamentoCobranca(boleto: any, moradores: any[]): string {
  const tipo = boleto.descricao || "Taxa do condomínio";
  let bloco = boleto.bloco || null;
  let apartamento = boleto.apartamento || null;
  if ((!bloco || !apartamento) && boleto.moradorId) {
    const m = moradores.find((x) => x.id === boleto.moradorId);
    if (m) {
      bloco = m.bloco;
      apartamento = m.apartamento;
    }
  }
  if (bloco && apartamento) return `${tipo} — Bloco ${bloco}, apto ${apartamento}`;
  return `Cobrança — ${boleto.moradorNome}`;
}

function conflito(reservas: DadosCondominio["reservas"], espacoId: string, data: string, inicio: string, fim: string, ignorarId?: string): boolean {
  return reservas.some(
    (r) =>
      r.espacoId === espacoId &&
      r.data === data &&
      r.status === "aprovada" &&
      r.id !== ignorarId &&
      inicio < r.fim &&
      fim > r.inicio
  );
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: false, erro: "Faça login." }, { status: 401 });
  }
  const body = await req.json();
  const { acao, ...args } = body as { acao: string; [k: string]: unknown };
  const dados = await carregarDados(usuario.condominioId);
  if (!dados) {
    return Response.json({ ok: false, erro: "Condomínio não encontrado." }, { status: 404 });
  }
  const eu = dados.moradores.find((m) => m.usuarioId === usuario.id) || null;
  const ehSindico = usuario.papel === "sindico";
  const salvar = () => salvarDados(dados);

  // Dados antigos (inclusive no Blob de produção) não têm esses campos.
  if (!dados.funcionarios) dados.funcionarios = [];
  if (!dados.folhas) dados.folhas = [];

  const precisaCriar = [
    "criarReserva", "criarAviso", "criarOcorrencia", "criarCobranca",
    "criarVotacao", "criarMorador", "criarLancamento", "criarEspaco",
    "criarFuncionario", "gerarFolhaMes",
  ].includes(acao);
  if (precisaCriar && !podeCriar(dados.condominio)) return erroCriacaoBloqueada();

  switch (acao) {
    // ---------- Reservas ----------
    case "criarReserva": {
      if (!eu && !ehSindico) return Response.json({ ok: false, erro: "Cadastre-se como morador primeiro." }, { status: 400 });
      const { espacoId, data, inicio, fim } = args as { espacoId: string; data: string; inicio: string; fim: string };
      const espaco = dados.espacos.find((e) => e.id === espacoId);
      if (!espaco) return Response.json({ ok: false, erro: "Espaço não encontrado." }, { status: 400 });
      if (!data || !inicio || !fim || inicio >= fim) return Response.json({ ok: false, erro: "Confira a data e os horários." }, { status: 400 });
      if (conflito(dados.reservas, espacoId, data, inicio, fim)) {
        return Response.json({ ok: false, erro: "Esse horário já está ocupado por uma reserva aprovada." }, { status: 400 });
      }
      dados.reservas.push({
        id: novoId("res"),
        espacoId,
        espacoNome: espaco.nome,
        moradorId: eu?.id || "sindico",
        moradorNome: ehSindico ? usuario.nome : eu!.nome,
        data, inicio, fim,
        status: ehSindico ? "aprovada" : "pendente",
        criadoEm: hojeISO(),
      });
      await salvar();
      // Avisa o síndico quando um morador pede reserva (não trava se falhar).
      if (!ehSindico) {
        await enviarPushParaSindico(dados.condominio.id, {
          titulo: "Nova reserva pedida 📅",
          corpo: `${espaco.nome} — ${dataBR(data)} ${inicio} às ${fim} (${eu!.nome}).`,
        });
      }
      return Response.json({ ok: true });
    }
    case "aprovarReserva": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico aprova reservas." }, { status: 403 });
      const r = dados.reservas.find((x) => x.id === args.id);
      if (!r) return Response.json({ ok: false, erro: "Reserva não encontrada." }, { status: 404 });
      if (args.aprovar === true) {
        if (conflito(dados.reservas, r.espacoId, r.data, r.inicio, r.fim, r.id)) {
          return Response.json({ ok: false, erro: "Conflito: já existe reserva aprovada nesse horário." }, { status: 400 });
        }
        r.status = "aprovada";
      } else {
        r.status = "recusada";
      }
      await salvar();
      // Avisa o morador que fez a reserva (não trava a resposta se falhar).
      const moradorReserva = dados.moradores.find((m) => m.id === r.moradorId);
      if (moradorReserva?.usuarioId) {
        await enviarPushParaUsuarios([moradorReserva.usuarioId], {
          titulo: r.status === "aprovada" ? "Reserva aprovada ✅" : "Reserva recusada",
          corpo: `${r.espacoNome} — ${dataBR(r.data)} ${r.inicio} às ${r.fim}.`,
        });
      }
      return Response.json({ ok: true });
    }
    case "cancelarReserva": {
      const r = dados.reservas.find((x) => x.id === args.id);
      if (!r) return Response.json({ ok: false, erro: "Reserva não encontrada." }, { status: 404 });
      if (!ehSindico && r.moradorId !== eu?.id) return Response.json({ ok: false, erro: "Você só pode cancelar suas reservas." }, { status: 403 });
      r.status = "cancelada";
      await salvar();
      return Response.json({ ok: true });
    }
    // ---------- Espaços ----------
    case "criarEspaco": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico gerencia espaços." }, { status: 403 });
      if (!args.nome) return Response.json({ ok: false, erro: "Informe o nome do espaço." }, { status: 400 });
      dados.espacos.push({ id: novoId("esp"), nome: String(args.nome) });
      await salvar();
      return Response.json({ ok: true });
    }
    case "removerEspaco": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico gerencia espaços." }, { status: 403 });
      const futuras = dados.reservas.filter(
        (r) => r.espacoId === args.id && (r.status === "aprovada" || r.status === "pendente") && r.data >= new Date().toISOString().slice(0, 10)
      );
      futuras.forEach((r) => (r.status = "cancelada"));
      dados.espacos = dados.espacos.filter((e) => e.id !== args.id);
      await salvar();
      return Response.json({ ok: true, canceladas: futuras.length });
    }
    // ---------- Avisos ----------
    case "criarAviso": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico posta avisos." }, { status: 403 });
      if (!args.titulo || !args.texto) return Response.json({ ok: false, erro: "Informe título e texto." }, { status: 400 });
      dados.avisos.unshift({ id: novoId("av"), titulo: String(args.titulo), texto: String(args.texto), criadoEm: hojeISO(), lidoPor: [] });
      await salvar();
      // Avisa todos os moradores do condomínio (não trava se falhar).
      await enviarPushParaCondominio(dados.condominio.id, {
        titulo: `Novo aviso: ${String(args.titulo)}`,
        corpo: String(args.texto).slice(0, 120),
      });
      return Response.json({ ok: true });
    }
    case "removerAviso": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico remove avisos." }, { status: 403 });
      dados.avisos = dados.avisos.filter((a) => a.id !== args.id);
      await salvar();
      return Response.json({ ok: true });
    }
    case "marcarLido": {
      if (!eu) return Response.json({ ok: false, erro: "Cadastre-se como morador primeiro." }, { status: 400 });
      const aviso = dados.avisos.find((a) => a.id === args.avisoId);
      if (!aviso) return Response.json({ ok: false, erro: "Aviso não encontrado." }, { status: 404 });
      if (!aviso.lidoPor.includes(eu.id)) aviso.lidoPor.push(eu.id);
      await salvar();
      return Response.json({ ok: true });
    }
    // ---------- Ocorrências ----------
    case "criarOcorrencia": {
      if (!eu && !ehSindico) return Response.json({ ok: false, erro: "Cadastre-se como morador primeiro." }, { status: 400 });
      if (!args.titulo || !args.descricao) return Response.json({ ok: false, erro: "Informe título e descrição." }, { status: 400 });
      // Só o morador pode marcar como privada (mensagem só para o síndico);
      // ocorrência do síndico é sempre visível a todos.
      const privada = !ehSindico && args.privada === true;
      dados.ocorrencias.unshift({
        id: novoId("oc"),
        titulo: String(args.titulo),
        descricao: String(args.descricao),
        local: String(args.local || ""),
        fotoUrl: (args.fotoUrl as string) || null,
        status: "aberta",
        moradorId: eu?.id || "sindico",
        moradorNome: ehSindico ? usuario.nome : eu!.nome,
        criadoEm: hojeISO(),
        privada,
      });
      await salvar();
      // Avisa o síndico quando um morador abre ocorrência (não trava se falhar).
      if (!ehSindico) {
        await enviarPushParaSindico(dados.condominio.id, {
          titulo: privada ? "Nova mensagem privada 🔒" : "Nova ocorrência 🔧",
          corpo: `${String(args.titulo)} — ${eu!.nome}.`,
        });
      }
      return Response.json({ ok: true });
    }
    case "mudarStatusOcorrencia": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico muda o status." }, { status: 403 });
      const oc = dados.ocorrencias.find((x) => x.id === args.id);
      if (!oc) return Response.json({ ok: false, erro: "Ocorrência não encontrada." }, { status: 404 });
      oc.status = args.status as "aberta" | "em_andamento" | "resolvida";
      await salvar();
      return Response.json({ ok: true });
    }
    // ---------- Cobranças ----------
    case "criarCobranca": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico cria cobranças." }, { status: 403 });
      const descricao = String(args.descricao || "").trim() || "Taxa do condomínio";
      const valor = Number(args.valor);
      const vencimento = String(args.vencimento || "");
      const anexoBoletoUrl = typeof args.anexoBoletoUrl === "string" && args.anexoBoletoUrl.trim() ? args.anexoBoletoUrl.trim() : null;
      if (!valor || valor <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
        return Response.json({ ok: false, erro: "Confira descrição, valor e vencimento." }, { status: 400 });
      }
      const mes = vencimento.slice(0, 7);
      const alvo = String(args.alvo || "todos");
      // Cobrança é por UNIDADE (bloco+apartamento), não por pessoa: se um
      // apto tem 3 moradores, gera 1 cobrança só, vista pelos 3.
      const mesmaUnidade = (b: any, bloco: string, apartamento: string, moradorId: string) =>
        b.bloco && b.apartamento
          ? b.bloco.toLowerCase() === bloco.toLowerCase() && b.apartamento === apartamento
          : b.moradorId === moradorId;
      const unidades = new Map<string, { morador: any; bloco: string; apartamento: string }>();
      const candidatos = alvo === "todos" ? dados.moradores : dados.moradores.filter((m) => m.id === alvo);
      for (const m of candidatos) {
        const chave = `${m.bloco.toLowerCase()}|${m.apartamento}`;
        if (!unidades.has(chave)) unidades.set(chave, { morador: m, bloco: m.bloco, apartamento: m.apartamento });
      }
      if (unidades.size === 0) return Response.json({ ok: false, erro: "Escolha para quem é a cobrança." }, { status: 400 });
      let criadas = 0;
      for (const { morador, bloco, apartamento } of unidades.values()) {
        if (dados.boletos.some((b) => b.mes === mes && (b.descricao || "") === descricao && mesmaUnidade(b, bloco, apartamento, morador.id))) continue;
        dados.boletos.push({
          id: novoId("bol"),
          moradorId: morador.id,
          moradorNome: morador.nome,
          bloco,
          apartamento,
          valor,
          vencimento,
          status: "pendente",
          codigoBarras: null,
          mes,
          descricao,
          comprovanteUrl: null,
          anexoBoletoUrl,
        });
        criadas++;
      }
      // Recorrente: todo mês, no dia escolhido, cria a mesma cobrança para todos.
      if (args.recorrente) {
        const dia = Math.min(Math.max(1, Number(args.diaRecorrente) || 1), 28);
        dados.condominio.cobrancaRecorrente = { dia, valor, descricao };
      }
      await salvar();
      // Avisa todos os moradores das unidades cobradas — os 3 do mesmo
      // apto recebem, não só 1 (não trava se falhar).
      const chavesUnidades = new Set([...unidades.values()].map((u) => `${u.bloco.toLowerCase()}|${u.apartamento}`));
      const ids = dados.moradores
        .filter((m) => chavesUnidades.has(`${m.bloco.toLowerCase()}|${m.apartamento}`))
        .map((m) => m.usuarioId)
        .filter((id): id is string => Boolean(id));
      if (ids.length > 0) {
        await enviarPushParaUsuarios(ids, {
          titulo: "Nova cobrança 💰",
          corpo: `${descricao} — ${brl(valor)}, vencimento ${dataBR(vencimento)}. Pague via Pix e envie o comprovante.`,
        });
      }
      return Response.json({ ok: true, criadas });
    }
    case "anexarBoleto": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico anexa boletos." }, { status: 403 });
      const boleto = dados.boletos.find((b) => b.id === args.id);
      if (!boleto) return Response.json({ ok: false, erro: "Cobrança não encontrada." }, { status: 404 });
      // url vazia = remover o anexo.
      boleto.anexoBoletoUrl = typeof args.url === "string" && args.url.trim() ? args.url.trim() : null;
      await salvar();
      return Response.json({ ok: true });
    }
    case "cancelarRecorrente": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico muda a cobrança recorrente." }, { status: 403 });
      dados.condominio.cobrancaRecorrente = null;
      await salvar();
      return Response.json({ ok: true });
    }
    case "salvarPix": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico cadastra o Pix." }, { status: 403 });
      const chave = String(args.pixChave || "").trim();
      dados.condominio.pixChave = chave || null;
      await salvar();
      return Response.json({ ok: true });
    }
    case "marcarPagoMorador": {
      const boleto = dados.boletos.find((b) => b.id === args.id);
      if (!boleto) return Response.json({ ok: false, erro: "Cobrança não encontrada." }, { status: 404 });
      // Qualquer morador da unidade pode marcar como pago (a cobrança é da
      // unidade, não só da pessoa em cujo nome ela foi criada).
      const daMinhaUnidade =
        eu && boleto.bloco && boleto.apartamento &&
        boleto.bloco.toLowerCase() === eu.bloco.toLowerCase() && boleto.apartamento === eu.apartamento;
      if (!ehSindico && (!eu || (boleto.moradorId !== eu.id && !daMinhaUnidade))) {
        return Response.json({ ok: false, erro: "Essa cobrança não é da sua unidade." }, { status: 403 });
      }
      if (boleto.status === "pago") return Response.json({ ok: false, erro: "Essa cobrança já foi confirmada." }, { status: 400 });
      boleto.status = "aguardando";
      boleto.comprovanteUrl = (args.comprovanteUrl as string) || null;
      await salvar();
      // Avisa o síndico que o morador marcou como pago (não trava se falhar).
      if (!ehSindico) {
        await enviarPushParaSindico(dados.condominio.id, {
          titulo: "Pagamento marcado 💰",
          corpo: `${boleto.moradorNome} marcou ${boleto.descricao || "a cobrança"} (${brl(boleto.valor)}) como paga. Confira o comprovante.`,
        });
      }
      return Response.json({ ok: true });
    }
    case "confirmarRecebimento": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico confirma recebimentos." }, { status: 403 });
      const boleto = dados.boletos.find((b) => b.id === args.id);
      if (!boleto) return Response.json({ ok: false, erro: "Cobrança não encontrada." }, { status: 404 });
      if (boleto.status === "pago") return Response.json({ ok: false, erro: "Essa cobrança já foi confirmada." }, { status: 400 });
      boleto.status = "pago";
      if (!dados.lancamentos.some((l) => l.boletoId === boleto.id)) {
        dados.lancamentos.push({
          id: novoId("lan"),
          tipo: "receita",
          categoria: "boleto",
          descricao: descricaoLancamentoCobranca(boleto, dados.moradores),
          valor: boleto.valor,
          data: new Date().toISOString().slice(0, 10),
          pago: true,
          origem: "boleto",
          boletoId: boleto.id,
        });
      }
      await salvar();
      // Avisa o morador que o pagamento foi confirmado (não trava se falhar).
      const morador = dados.moradores.find((m) => m.id === boleto.moradorId);
      if (morador?.usuarioId) {
        await enviarPushParaUsuarios([morador.usuarioId], {
          titulo: "Pagamento confirmado ✅",
          corpo: `${boleto.descricao || "Cobrança"} (${brl(boleto.valor)}) — recebimento confirmado pelo síndico.`,
        });
      }
      return Response.json({ ok: true });
    }
    case "recusarComprovante": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico recusa comprovantes." }, { status: 403 });
      const boleto = dados.boletos.find((b) => b.id === args.id);
      if (!boleto) return Response.json({ ok: false, erro: "Cobrança não encontrada." }, { status: 404 });
      if (boleto.status !== "aguardando") return Response.json({ ok: false, erro: "Essa cobrança não está aguardando confirmação." }, { status: 400 });
      boleto.status = "pendente";
      boleto.comprovanteUrl = null;
      await salvar();
      const morador = dados.moradores.find((m) => m.id === boleto.moradorId);
      if (morador?.usuarioId) {
        await enviarPushParaUsuarios([morador.usuarioId], {
          titulo: "Comprovante não confirmado",
          corpo: `O síndico não confirmou o pagamento de ${boleto.descricao || "sua cobrança"}. Confira o pagamento e envie o comprovante de novo.`,
        });
      }
      return Response.json({ ok: true });
    }
    case "alternarStatusBoleto": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico confirma boletos." }, { status: 403 });
      const boleto = dados.boletos.find((b) => b.id === args.id);
      if (!boleto) return Response.json({ ok: false, erro: "Boleto não encontrado." }, { status: 404 });
      if (boleto.status === "pago") {
        boleto.status = "pendente";
        dados.lancamentos = dados.lancamentos.filter((l) => l.boletoId !== boleto.id);
      } else {
        boleto.status = "pago";
        if (!dados.lancamentos.some((l) => l.boletoId === boleto.id)) {
          dados.lancamentos.push({
            id: novoId("lan"),
            tipo: "receita",
            categoria: "boleto",
            descricao: descricaoLancamentoCobranca(boleto, dados.moradores),
            valor: boleto.valor,
            data: new Date().toISOString().slice(0, 10),
            pago: true,
            origem: "boleto",
            boletoId: boleto.id,
          });
        }
      }
      await salvar();
      return Response.json({ ok: true });
    }
    // ---------- Votações ----------
    case "criarVotacao": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico cria votações." }, { status: 403 });
      const opcoes = (args.opcoes as string[]).map((o) => o.trim()).filter(Boolean);
      if (!args.pergunta || opcoes.length < 2) return Response.json({ ok: false, erro: "Informe a pergunta e pelo menos 2 opções." }, { status: 400 });
      dados.votacoes.unshift({
        id: novoId("vot"),
        pergunta: String(args.pergunta),
        opcoes,
        votos: [],
        aberta: true,
        criadaEm: hojeISO(),
        encerradaEm: null,
        ata: null,
      });
      await salvar();
      // Avisa todos os moradores do condomínio (não trava se falhar).
      await enviarPushParaCondominio(dados.condominio.id, {
        titulo: "Nova votação 🗳️",
        corpo: String(args.pergunta).slice(0, 120),
        url: "/painel",
      });
      return Response.json({ ok: true });
    }
    case "votar": {
      if (!eu) return Response.json({ ok: false, erro: "Cadastre-se como morador primeiro." }, { status: 400 });
      const votacao = dados.votacoes.find((v) => v.id === args.votacaoId);
      if (!votacao || !votacao.aberta) return Response.json({ ok: false, erro: "Votação encerrada ou não encontrada." }, { status: 400 });
      if (votacao.votos.some((v) => v.moradorId === eu.id)) {
        return Response.json({ ok: false, erro: "Você já votou nesta votação." }, { status: 400 });
      }
      votacao.votos.push({ moradorId: eu.id, moradorNome: eu.nome, opcao: Number(args.opcao) });
      await salvar();
      return Response.json({ ok: true });
    }
    case "encerrarVotacao": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico encerra votações." }, { status: 403 });
      const votacao = dados.votacoes.find((v) => v.id === args.id);
      if (!votacao) return Response.json({ ok: false, erro: "Votação não encontrada." }, { status: 404 });
      votacao.aberta = false;
      votacao.encerradaEm = hojeISO();
      const linhas: string[] = [];
      linhas.push(`ATA DE VOTAÇÃO — ${dados.condominio.nome}`);
      linhas.push(`Pergunta: ${votacao.pergunta}`);
      linhas.push(`Encerrada em: ${dataBR(votacao.encerradaEm)}`);
      linhas.push(`Total de votos: ${votacao.votos.length}`);
      linhas.push("");
      votacao.opcoes.forEach((opcao, i) => {
        const votosOpcao = votacao.votos.filter((v) => v.opcao === i);
        linhas.push(`${opcao}: ${votosOpcao.length} voto(s)`);
        votosOpcao.forEach((v) => linhas.push(`  - ${v.moradorNome}`));
      });
      votacao.ata = linhas.join("\n");
      await salvar();
      return Response.json({ ok: true, ata: votacao.ata });
    }
    // ---------- Moradores ----------
    case "criarMorador": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico cadastra moradores." }, { status: 403 });
      if (!args.nome || !args.bloco || !args.apartamento) return Response.json({ ok: false, erro: "Preencha nome, bloco e apartamento." }, { status: 400 });
      dados.moradores.push({
        id: novoId("mor"),
        usuarioId: null,
        nome: String(args.nome),
        bloco: String(args.bloco),
        apartamento: String(args.apartamento),
        email: String(args.email || ""),
      });
      await salvar();
      return Response.json({ ok: true });
    }
    case "editarMorador": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico edita moradores." }, { status: 403 });
      const morador = dados.moradores.find((m) => m.id === args.id);
      if (!morador) return Response.json({ ok: false, erro: "Morador não encontrado." }, { status: 404 });
      morador.nome = String(args.nome);
      morador.bloco = String(args.bloco);
      morador.apartamento = String(args.apartamento);
      morador.email = String(args.email || "");
      if (morador.usuarioId) {
        const usuarios = await listarUsuarios();
        const u = usuarios.find((x) => x.id === morador.usuarioId);
        if (u) {
          u.nome = morador.nome;
          if (morador.email) u.email = morador.email;
          await salvarUsuarios(usuarios);
        }
      }
      await salvar();
      return Response.json({ ok: true });
    }
    case "removerMorador": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico remove moradores." }, { status: 403 });
      dados.moradores = dados.moradores.filter((m) => m.id !== args.id);
      await salvar();
      return Response.json({ ok: true });
    }
    case "pedirCorrecao": {
      if (!eu) return Response.json({ ok: false, erro: "Cadastre-se como morador primeiro." }, { status: 400 });
      if (!args.campo || !args.certo) return Response.json({ ok: false, erro: "Informe o que está errado e o certo." }, { status: 400 });
      dados.pedidosCorrecao.push({
        id: novoId("ped"),
        moradorId: eu.id,
        moradorNome: eu.nome,
        campo: String(args.campo),
        errado: String(args.errado || ""),
        certo: String(args.certo),
        status: "pendente",
        criadoEm: hojeISO(),
      });
      await salvar();
      return Response.json({ ok: true });
    }
    case "responderCorrecao": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico responde correções." }, { status: 403 });
      const pedido = dados.pedidosCorrecao.find((p) => p.id === args.id);
      if (!pedido) return Response.json({ ok: false, erro: "Pedido não encontrado." }, { status: 404 });
      if (args.aprovar === true) {
        const morador = dados.moradores.find((m) => m.id === pedido.moradorId);
        if (morador) {
          const campo = pedido.campo as "nome" | "bloco" | "apartamento" | "email";
          if (["nome", "bloco", "apartamento", "email"].includes(campo)) {
            (morador as unknown as Record<string, string>)[campo] = pedido.certo;
          }
        }
        pedido.status = "aprovado";
      } else {
        pedido.status = "recusado";
      }
      await salvar();
      return Response.json({ ok: true });
    }
    // ---------- Financeiro ----------
    case "criarLancamento": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico registra lançamentos." }, { status: 403 });
      const valor = Number(args.valor);
      if (!valor || valor <= 0 || !args.descricao || !args.data) return Response.json({ ok: false, erro: "Confira descrição, valor e data." }, { status: 400 });
      dados.lancamentos.push({
        id: novoId("lan"),
        tipo: args.tipo === "receita" ? "receita" : "despesa",
        categoria: String(args.categoria || "outros"),
        descricao: String(args.descricao),
        valor,
        data: String(args.data),
        pago: args.pago !== false,
        origem: "manual",
        boletoId: null,
      });
      await salvar();
      return Response.json({ ok: true });
    }
    case "marcarLancamentoPago": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico altera lançamentos." }, { status: 403 });
      const lan = dados.lancamentos.find((l) => l.id === args.id);
      if (!lan) return Response.json({ ok: false, erro: "Lançamento não encontrado." }, { status: 404 });
      lan.pago = args.pago === true;
      await salvar();
      return Response.json({ ok: true });
    }
    case "removerLancamento": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico remove lançamentos." }, { status: 403 });
      const lan = dados.lancamentos.find((l) => l.id === args.id);
      if (!lan) return Response.json({ ok: false, erro: "Lançamento não encontrado." }, { status: 404 });
      if (lan.origem === "boleto") {
        return Response.json({ ok: false, erro: "Lançamentos de boleto são removidos ao voltar o boleto para pendente." }, { status: 400 });
      }
      if (lan.origem === "folha") {
        return Response.json({ ok: false, erro: "Lançamentos de folha de pagamento são criados pelo pagamento da folha e não podem ser removidos manualmente." }, { status: 400 });
      }
      dados.lancamentos = dados.lancamentos.filter((l) => l.id !== args.id);
      await salvar();
      return Response.json({ ok: true });
    }
    // ---------- Funcionários e folha de pagamento ----------
    case "criarFuncionario": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico cadastra funcionários." }, { status: 403 });
      const salario = Number(args.salarioMensal);
      if (!args.nome || !args.cargo || !salario || salario <= 0 || !args.dataAdmissao) {
        return Response.json({ ok: false, erro: "Preencha nome, cargo, salário e data de admissão." }, { status: 400 });
      }
      const tipoContrato = ["CLT", "MEI", "Diarista", "Outro"].includes(String(args.tipoContrato))
        ? (args.tipoContrato as "CLT" | "MEI" | "Diarista" | "Outro")
        : "Outro";
      dados.funcionarios.push({
        id: novoId("fun"),
        nome: String(args.nome),
        cargo: String(args.cargo),
        tipoContrato,
        salarioMensal: salario,
        dataAdmissao: String(args.dataAdmissao),
        ativo: true,
        criadoEm: hojeISO(),
      });
      await salvar();
      return Response.json({ ok: true });
    }
    case "editarFuncionario": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico edita funcionários." }, { status: 403 });
      const fun = dados.funcionarios.find((f) => f.id === args.id);
      if (!fun) return Response.json({ ok: false, erro: "Funcionário não encontrado." }, { status: 404 });
      const salario = Number(args.salarioMensal);
      if (!args.nome || !args.cargo || !salario || salario <= 0 || !args.dataAdmissao) {
        return Response.json({ ok: false, erro: "Preencha nome, cargo, salário e data de admissão." }, { status: 400 });
      }
      fun.nome = String(args.nome);
      fun.cargo = String(args.cargo);
      if (["CLT", "MEI", "Diarista", "Outro"].includes(String(args.tipoContrato))) {
        fun.tipoContrato = args.tipoContrato as "CLT" | "MEI" | "Diarista" | "Outro";
      }
      fun.salarioMensal = salario;
      fun.dataAdmissao = String(args.dataAdmissao);
      await salvar();
      return Response.json({ ok: true });
    }
    case "alternarFuncionarioAtivo": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico altera funcionários." }, { status: 403 });
      const fun = dados.funcionarios.find((f) => f.id === args.id);
      if (!fun) return Response.json({ ok: false, erro: "Funcionário não encontrado." }, { status: 404 });
      fun.ativo = !fun.ativo;
      await salvar();
      return Response.json({ ok: true, ativo: fun.ativo });
    }
    case "gerarFolhaMes": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico gera a folha." }, { status: 403 });
      const mes = String(args.mes || new Date().toISOString().slice(0, 7));
      if (!/^\d{4}-\d{2}$/.test(mes)) return Response.json({ ok: false, erro: "Mês inválido." }, { status: 400 });
      if (dados.folhas.some((f) => f.mes === mes)) {
        return Response.json({ ok: false, erro: "A folha desse mês já existe." }, { status: 400 });
      }
      const ativos = dados.funcionarios.filter((f) => f.ativo);
      if (ativos.length === 0) {
        return Response.json({ ok: false, erro: "Cadastre um funcionário ativo primeiro." }, { status: 400 });
      }
      const itens = ativos.map((f) => ({
        funcionarioId: f.id,
        funcionarioNome: f.nome,
        cargo: f.cargo,
        salarioBase: f.salarioMensal,
        adiantamento: 0,
        descontos: 0,
        extras: 0,
        liquido: f.salarioMensal,
        pago: false,
      }));
      dados.folhas.push({
        id: novoId("fol"),
        mes,
        itens,
        totalLiquido: itens.reduce((s, i) => s + i.liquido, 0),
        criadaEm: hojeISO(),
      });
      await salvar();
      return Response.json({ ok: true, criados: itens.length });
    }
    case "editarFolhaItem": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico edita a folha." }, { status: 403 });
      const folha = dados.folhas.find((f) => f.id === args.folhaId);
      if (!folha) return Response.json({ ok: false, erro: "Folha não encontrada." }, { status: 404 });
      const item = folha.itens.find((i) => i.funcionarioId === args.funcionarioId);
      if (!item) return Response.json({ ok: false, erro: "Item não encontrado." }, { status: 404 });
      if (item.pago) return Response.json({ ok: false, erro: "Item já pago não pode ser editado." }, { status: 400 });
      const adiantamento = Math.max(0, Number(args.adiantamento) || 0);
      const descontos = Math.max(0, Number(args.descontos) || 0);
      const extras = Math.max(0, Number(args.extras) || 0);
      item.adiantamento = adiantamento;
      item.descontos = descontos;
      item.extras = extras;
      item.liquido = Math.max(0, item.salarioBase + extras - adiantamento - descontos);
      folha.totalLiquido = folha.itens.reduce((s, i) => s + i.liquido, 0);
      await salvar();
      return Response.json({ ok: true, liquido: item.liquido });
    }
    case "pagarFolhaItem": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico marca pagamentos." }, { status: 403 });
      const folha = dados.folhas.find((f) => f.id === args.folhaId);
      if (!folha) return Response.json({ ok: false, erro: "Folha não encontrada." }, { status: 404 });
      const item = folha.itens.find((i) => i.funcionarioId === args.funcionarioId);
      if (!item) return Response.json({ ok: false, erro: "Item não encontrado." }, { status: 404 });
      if (item.pago) return Response.json({ ok: true, jaPago: true });
      item.pago = true;
      const descricao = `Folha ${folha.mes} — ${item.funcionarioNome}`;
      if (!dados.lancamentos.some((l) => l.origem === "folha" && l.folhaId === folha.id && l.descricao === descricao)) {
        dados.lancamentos.push({
          id: novoId("lan"),
          tipo: "despesa",
          categoria: "Folha de pagamento",
          descricao,
          valor: item.liquido,
          data: new Date().toISOString().slice(0, 10),
          pago: true,
          origem: "folha",
          boletoId: null,
          folhaId: folha.id,
        });
      }
      await salvar();
      return Response.json({ ok: true });
    }
    case "excluirFolhaMes": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico exclui folhas." }, { status: 403 });
      const folha = dados.folhas.find((f) => f.id === args.folhaId);
      if (!folha) return Response.json({ ok: false, erro: "Folha não encontrada." }, { status: 404 });
      if (folha.itens.some((i) => i.pago)) {
        return Response.json({ ok: false, erro: "Não dá para excluir: há itens já pagos nesta folha." }, { status: 400 });
      }
      dados.folhas = dados.folhas.filter((f) => f.id !== folha.id);
      await salvar();
      return Response.json({ ok: true });
    }
    // ---------- Assinatura ----------
    case "assinarMercadoPago": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico assina o plano." }, { status: 403 });
      const plano = args.plano === "mensal" ? PLANOS_MP.mensal : PLANOS_MP.promocional;
      return Response.json({ ok: true, initPoint: plano.initPoint, planoId: plano.id });
    }
    case "cancelarAssinatura": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico cancela a assinatura." }, { status: 403 });
      dados.condominio.assinaturaStatus = "cancelada";
      const condominios = await listarCondominios();
      const c = condominios.find((x) => x.id === dados.condominio.id);
      if (c) c.assinaturaStatus = "cancelada";
      await salvarCondominios(condominios);
      await salvar();
      return Response.json({ ok: true });
    }
    // ---------- Dados do condomínio ----------
    case "renomearCondominio": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico muda o nome do condomínio." }, { status: 403 });
      const nome = String(args.nome || "").trim();
      if (!nome) return Response.json({ ok: false, erro: "Informe o novo nome do condomínio." }, { status: 400 });
      if (nome.length > 100) return Response.json({ ok: false, erro: "O nome deve ter no máximo 100 caracteres." }, { status: 400 });
      dados.condominio.nome = nome;
      const condominios = await listarCondominios();
      const c = condominios.find((x) => x.id === dados.condominio.id);
      if (c) c.nome = nome;
      await salvarCondominios(condominios);
      await salvar();
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
  }
}
