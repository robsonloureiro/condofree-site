import { NextRequest } from "next/server";
import { listarUsuarios, salvarUsuarios, hashSenha, criarSessao, definirCookieSessao, novoId, hojeISO } from "@/lib/auth";
import { listarCondominios, carregarDados, salvarDados } from "@/lib/dados";
import { enviarBoasVindasMorador } from "@/lib/email";
import type { Usuario } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { codigoConvite, nome, bloco, apartamento, email, senha } = await req.json();
  if (!codigoConvite || !nome || !bloco || !apartamento || !email || !senha) {
    return Response.json({ ok: false, erro: "Preencha todos os campos." }, { status: 400 });
  }
  if (String(senha).length < 6) {
    return Response.json({ ok: false, erro: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  }
  const condominios = await listarCondominios();
  const condominio = condominios.find(
    (c) => c.codigoConvite.toUpperCase() === String(codigoConvite).toUpperCase()
  );
  if (!condominio) {
    return Response.json({ ok: false, erro: "Código de convite inválido. Peça o código ao síndico." }, { status: 400 });
  }
  const dados = await carregarDados(condominio.id);
  if (!dados) {
    return Response.json({ ok: false, erro: "Condomínio não encontrado." }, { status: 400 });
  }
  const unidadeOcupada = dados.moradores.find(
    (m) => m.bloco.toLowerCase() === String(bloco).toLowerCase() && m.apartamento === String(apartamento)
  );
  if (unidadeOcupada) {
    return Response.json(
      { ok: false, erro: `A unidade Bloco ${bloco} — ${apartamento} já tem um morador cadastrado. Confira o bloco e o apartamento ou fale com o síndico.` },
      { status: 400 }
    );
  }
  const usuarios = await listarUsuarios();
  if (usuarios.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return Response.json({ ok: false, erro: "Já existe uma conta com esse e-mail." }, { status: 400 });
  }
  const agora = hojeISO();
  const usuario: Usuario = {
    id: novoId("usr"),
    email: String(email),
    nome: String(nome),
    papel: "morador",
    condominioId: condominio.id,
    senhaHash: hashSenha(String(senha)),
    criadoEm: agora,
  };
  usuarios.push(usuario);
  await salvarUsuarios(usuarios);
  dados.moradores.push({
    id: novoId("mor"),
    usuarioId: usuario.id,
    nome: String(nome),
    bloco: String(bloco),
    apartamento: String(apartamento),
    email: String(email),
  });
  await salvarDados(dados);
  const token = await criarSessao(usuario.id);
  definirCookieSessao(token);
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
