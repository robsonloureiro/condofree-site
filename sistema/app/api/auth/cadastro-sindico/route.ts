import { NextRequest } from "next/server";
import { listarUsuarios, salvarUsuarios, hashSenha, criarSessao, definirCookieSessao, novoId, hojeISO } from "@/lib/auth";
import { listarCondominios, salvarCondominios, salvarDados } from "@/lib/dados";
import type { DadosCondominio, Usuario } from "@/lib/types";

function codigoConvite(): string {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
}

export async function POST(req: NextRequest) {
  const { nomeCondominio, unidades, nome, email, senha } = await req.json();
  if (!nomeCondominio || !unidades || !nome || !email || !senha) {
    return Response.json({ ok: false, erro: "Preencha todos os campos." }, { status: 400 });
  }
  if (String(senha).length < 6) {
    return Response.json({ ok: false, erro: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  }
  const usuarios = await listarUsuarios();
  if (usuarios.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return Response.json({ ok: false, erro: "Já existe uma conta com esse e-mail." }, { status: 400 });
  }
  const condominioId = novoId("cond");
  const agora = hojeISO();
  const trialFim = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const condominio = {
    id: condominioId,
    nome: String(nomeCondominio),
    unidades: Number(unidades),
    codigoConvite: codigoConvite(),
    criadoEm: agora,
    trialFim,
    assinaturaStatus: "trial" as const,
  };
  const usuario: Usuario = {
    id: novoId("usr"),
    email: String(email),
    nome: String(nome),
    papel: "sindico",
    condominioId,
    senhaHash: hashSenha(String(senha)),
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
  const token = await criarSessao(usuario.id);
  definirCookieSessao(token);
  return Response.json({ ok: true, codigoConvite: condominio.codigoConvite });
}
