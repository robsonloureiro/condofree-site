import { NextRequest } from "next/server";
import { usuarioDaSessao, listarUsuarios, salvarUsuarios, novoId } from "@/lib/auth";
import { carregarDados, salvarDados, podeCriar, erroCriacaoBloqueada, listarCondominios, salvarCondominios } from "@/lib/dados";
import { hojeISO, dataBR, brl } from "@/lib/store";
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

  const precisaCriar = [
    "criarReserva", "criarAviso", "criarOcorrencia", "criarBoleto", "gerarBoletosMes",
    "criarVotacao", "criarMorador", "criarLancamento", "criarEspaco",
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
      });
      await salvar();
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
    // ---------- Boletos ----------
    case "criarBoleto": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico cria boletos." }, { status: 403 });
      const morador = dados.moradores.find((m) => m.id === args.moradorId);
      if (!morador) return Response.json({ ok: false, erro: "Morador não encontrado." }, { status: 400 });
      const valor = Number(args.valor);
      if (!valor || valor <= 0 || !args.vencimento) return Response.json({ ok: false, erro: "Confira valor e vencimento." }, { status: 400 });
      dados.boletos.push({
        id: novoId("bol"),
        moradorId: morador.id,
        moradorNome: morador.nome,
        valor,
        vencimento: String(args.vencimento),
        status: "pendente",
        codigoBarras: (args.codigoBarras as string) || null,
        mes: String(args.vencimento).slice(0, 7),
      });
      await salvar();
      return Response.json({ ok: true });
    }
    case "gerarBoletosMes": {
      if (!ehSindico) return Response.json({ ok: false, erro: "Só o síndico gera boletos." }, { status: 403 });
      const valor = Number(args.valor);
      const mes = String(args.mes || new Date().toISOString().slice(0, 7));
      if (!valor || valor <= 0) return Response.json({ ok: false, erro: "Informe o valor da taxa do mês." }, { status: 400 });
      let criados = 0;
      for (const morador of dados.moradores) {
        if (dados.boletos.some((b) => b.moradorId === morador.id && b.mes === mes)) continue;
        dados.boletos.push({
          id: novoId("bol"),
          moradorId: morador.id,
          moradorNome: morador.nome,
          valor,
          vencimento: `${mes}-10`,
          status: "pendente",
          codigoBarras: null,
          mes,
        });
        criados++;
      }
      await salvar();
      return Response.json({ ok: true, criados });
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
            descricao: `Boleto — ${boleto.moradorNome}`,
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
      if (dados.moradores.some((m) => m.bloco.toLowerCase() === String(args.bloco).toLowerCase() && m.apartamento === String(args.apartamento))) {
        return Response.json({ ok: false, erro: "Essa unidade já tem um morador cadastrado." }, { status: 400 });
      }
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
      if (
        dados.moradores.some(
          (m) => m.id !== morador.id && m.bloco.toLowerCase() === String(args.bloco).toLowerCase() && m.apartamento === String(args.apartamento)
        )
      ) {
        return Response.json({ ok: false, erro: "Essa unidade já pertence a outro morador." }, { status: 400 });
      }
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
      dados.lancamentos = dados.lancamentos.filter((l) => l.id !== args.id);
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
    default:
      return Response.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
  }
}
