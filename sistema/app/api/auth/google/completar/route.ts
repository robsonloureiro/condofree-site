import { NextRequest } from "next/server";
import {
  listarUsuarios,
  salvarUsuarios,
  criarSessao,
  definirCookieSessao,
  novoId,
  hojeISO,
} from "@/lib/auth";
import { buscarPendente, removerPendente } from "@/lib/google-pendente";
import { listarCondominios, salvarCondominios, carregarDados, salvarDados } from "@/lib/dados";
import { buscarVendedorPorCodigo } from "@/lib/vendedores";
import { enviarBoasVindasSindico, enviarBoasVindasMorador } from "@/lib/email";
import type { DadosCondominio, Usuario } from "@/lib/types";

function codigoConvite(): string {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
}

// Completa o cadastro com Google: cria a conta SEM senha (o login passa
// a ser só pelo botão do Google) e já deixa a pessoa logada, indo para
// o painel. O e-mail vem do token pendente, que o callback do Google
// criou após verificar o e-mail — nunca do corpo da requisição.
export async function POST(req: NextRequest) {
  const corpo = await req.json();
  const { token, papel, nome, nomeCondominio, unidades, codigoConvite: codigo, bloco, apartamento, ref } = corpo;
  const pendente = await buscarPendente(String(token || ""));
  if (!pendente) {
    return Response.json(
      { ok: false, erro: "Link expirado. Entre com o Google novamente." },
      { status: 400 },
    );
  }
  const email = pendente.email;
  const nomeFinal = String(nome || pendente.nome || "").trim();
  if (!nomeFinal) {
    return Response.json({ ok: false, erro: "Informe seu nome." }, { status: 400 });
  }
  const usuarios = await listarUsuarios();
  if (usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    await removerPendente(String(token));
    return Response.json({ ok: false, erro: "Já existe uma conta com esse e-mail." }, { status: 400 });
  }
  const agora = hojeISO();

  if (papel === "sindico") {
    if (!nomeCondominio || !unidades) {
      return Response.json({ ok: false, erro: "Preencha o nome do condomínio e as unidades." }, { status: 400 });
    }
    const condominioId = novoId("cond");
    const trialFim = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    // Código de indicação do vendedor (opcional): vincula o condomínio a quem fechou.
    const vendedor = ref ? await buscarVendedorPorCodigo(String(ref)) : null;
    const condominio = {
      id: condominioId,
      nome: String(nomeCondominio),
      unidades: Number(unidades),
      codigoConvite: codigoConvite(),
      criadoEm: agora,
      trialFim,
      assinaturaStatus: "trial" as const,
      vendedorId: vendedor ? vendedor.id : null,
    };
    const usuario: Usuario = {
      id: novoId("usr"),
      email,
      nome: nomeFinal,
      papel: "sindico",
      condominioId,
      senhaHash: "",
      criadoEm: agora,
    };
    const dados: DadosCondominio = {
      condominio,
      moradores: [],
      espacos: [
        { id: novoId("esp"), nome: "Salão de festas" },
        { id: novoId("esp"), nome: "Churrasqueira" },
        { id: novoId("esp"), nome: "Quadra" },
      ],
      reservas: [],
      avisos: [],
      ocorrencias: [],
      boletos: [],
      votacoes: [],
      lancamentos: [],
      pedidosCorrecao: [],
      funcionarios: [],
      folhas: [],
    };
    usuarios.push(usuario);
    await salvarUsuarios(usuarios);
    const condominios = await listarCondominios();
    condominios.push(condominio);
    await salvarCondominios(condominios);
    await salvarDados(dados);
    await removerPendente(String(token));
    const tokenSessao = await criarSessao(usuario.id);
    definirCookieSessao(tokenSessao);
    // E-mail de boas-vindas (não trava o cadastro se falhar).
    await enviarBoasVindasSindico({
      to: usuario.email,
      nome: usuario.nome,
      condominio: condominio.nome,
      codigoConvite: condominio.codigoConvite,
      trialFim: condominio.trialFim,
    });
    return Response.json({ ok: true, codigoConvite: condominio.codigoConvite });
  }

  if (papel === "morador") {
    if (!codigo || !bloco || !apartamento) {
      return Response.json(
        { ok: false, erro: "Preencha o código de convite, o bloco e o apartamento." },
        { status: 400 },
      );
    }
    const condominios = await listarCondominios();
    const condominio = condominios.find(
      (c) => c.codigoConvite.toUpperCase() === String(codigo).toUpperCase(),
    );
    if (!condominio) {
      return Response.json(
        { ok: false, erro: "Código de convite inválido. Peça o código ao síndico." },
        { status: 400 },
      );
    }
    const dados = await carregarDados(condominio.id);
    if (!dados) {
      return Response.json({ ok: false, erro: "Condomínio não encontrado." }, { status: 400 });
    }
    const unidadeOcupada = dados.moradores.find(
      (m) => m.bloco.toLowerCase() === String(bloco).toLowerCase() && m.apartamento === String(apartamento),
    );
    if (unidadeOcupada) {
      return Response.json(
        { ok: false, erro: `A unidade Bloco ${bloco} — ${apartamento} já tem um morador cadastrado. Confira o bloco e o apartamento ou fale com o síndico.` },
        { status: 400 },
      );
    }
    const usuario: Usuario = {
      id: novoId("usr"),
      email,
      nome: nomeFinal,
      papel: "morador",
      condominioId: condominio.id,
      senhaHash: "",
      criadoEm: agora,
    };
    usuarios.push(usuario);
    await salvarUsuarios(usuarios);
    dados.moradores.push({
      id: novoId("mor"),
      usuarioId: usuario.id,
      nome: nomeFinal,
      bloco: String(bloco),
      apartamento: String(apartamento),
      email,
    });
    await salvarDados(dados);
    await removerPendente(String(token));
    const tokenSessao = await criarSessao(usuario.id);
    definirCookieSessao(tokenSessao);
    // E-mail de boas-vindas (não trava o cadastro se falhar).
    await enviarBoasVindasMorador({
      to: usuario.email,
      nome: usuario.nome,
      condominio: condominio.nome,
      bloco: String(bloco),
      apartamento: String(apartamento),
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, erro: "Escolha se você é síndico ou morador." }, { status: 400 });
}
