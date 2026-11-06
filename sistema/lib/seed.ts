import { writeJSON, uid, hojeISO } from "./store";
import { hashSenha } from "./auth";
import { salvarCondominios } from "./dados";
import type { DadosCondominio, Usuario } from "./types";

/** Cria o Condomínio Exemplo com os mesmos dados de demonstração do artefato. */
export async function seedDemo(): Promise<void> {
  const condominioId = "cond_exemplo";
  const agora = hojeISO();
  const trialFim = new Date("2026-11-19T23:59:59-03:00").toISOString();

  const usuarios: Usuario[] = [
    {
      id: "usr_sindico",
      email: "sindico@exemplo.com",
      nome: "Síndico Exemplo",
      papel: "sindico",
      condominioId,
      senhaHash: hashSenha("exemplo123"),
      criadoEm: agora,
    },
    {
      id: "usr_ana",
      email: "ana@exemplo.com",
      nome: "Ana Souza",
      papel: "morador",
      condominioId,
      senhaHash: hashSenha("exemplo123"),
      criadoEm: agora,
    },
    {
      id: "usr_carlos",
      email: "carlos@exemplo.com",
      nome: "Carlos Lima",
      papel: "morador",
      condominioId,
      senhaHash: hashSenha("exemplo123"),
      criadoEm: agora,
    },
    {
      id: "usr_fernanda",
      email: "fernanda@exemplo.com",
      nome: "Fernanda Rocha",
      papel: "morador",
      condominioId,
      senhaHash: hashSenha("exemplo123"),
      criadoEm: agora,
    },
    {
      id: "usr_paulo",
      email: "paulo@exemplo.com",
      nome: "Paulo Mendes",
      papel: "morador",
      condominioId,
      senhaHash: hashSenha("exemplo123"),
      criadoEm: agora,
    },
  ];

  const dados: DadosCondominio = {
    condominio: {
      id: condominioId,
      nome: "Condomínio Exemplo",
      unidades: 40,
      codigoConvite: "EXEMPLO",
      criadoEm: agora,
      trialFim,
      assinaturaStatus: "trial",
    },
    moradores: [
      { id: "mor_ana", usuarioId: "usr_ana", nome: "Ana Souza", bloco: "A", apartamento: "101", email: "ana@exemplo.com" },
      { id: "mor_carlos", usuarioId: "usr_carlos", nome: "Carlos Lima", bloco: "A", apartamento: "102", email: "carlos@exemplo.com" },
      { id: "mor_fernanda", usuarioId: "usr_fernanda", nome: "Fernanda Rocha", bloco: "B", apartamento: "201", email: "fernanda@exemplo.com" },
      { id: "mor_paulo", usuarioId: "usr_paulo", nome: "Paulo Mendes", bloco: "B", apartamento: "202", email: "paulo@exemplo.com" },
    ],
    espacos: [
      { id: "esp_salao", nome: "Salão de festas" },
      { id: "esp_churras", nome: "Churrasqueira" },
      { id: "esp_quadra", nome: "Quadra" },
    ],
    reservas: [
      {
        id: "res_1",
        espacoId: "esp_salao",
        espacoNome: "Salão de festas",
        moradorId: "mor_ana",
        moradorNome: "Ana Souza",
        data: "2026-11-07",
        inicio: "14:00",
        fim: "18:00",
        status: "aprovada",
        criadoEm: agora,
      },
    ],
    avisos: [
      {
        id: "av_1",
        titulo: "Limpeza da caixa d'água",
        texto: "A limpeza da caixa d'água será feita na segunda-feira, das 8h às 12h. Pode faltar água nesse período.",
        criadoEm: agora,
        lidoPor: ["mor_ana"],
      },
      {
        id: "av_2",
        titulo: "Festa de fim de ano",
        texto: "A festa de fim de ano será no salão de festas. Tragam um prato para compartilhar!",
        criadoEm: agora,
        lidoPor: [],
      },
    ],
    ocorrencias: [
      {
        id: "oc_1",
        titulo: "Lâmpada queimada",
        descricao: "Lâmpada do corredor do 2º andar do Bloco B queimada.",
        local: "Bloco B, 2º andar",
        fotoUrl: null,
        status: "em_andamento",
        moradorId: "mor_fernanda",
        moradorNome: "Fernanda Rocha",
        criadoEm: agora,
      },
    ],
    boletos: [
      { id: "bol_1", moradorId: "mor_ana", moradorNome: "Ana Souza", valor: 482.9, vencimento: "2026-11-10", status: "pendente", codigoBarras: null, mes: "2026-11" },
      { id: "bol_2", moradorId: "mor_fernanda", moradorNome: "Fernanda Rocha", valor: 482.9, vencimento: "2026-11-01", status: "vencido", codigoBarras: null, mes: "2026-11" },
    ],
    votacoes: [
      {
        id: "vot_1",
        pergunta: "Pintura da fachada: qual cor vocês preferem?",
        opcoes: ["Branca", "Bege", "Cinza"],
        votos: [
          { moradorId: "mor_ana", moradorNome: "Ana Souza", opcao: 0 },
          { moradorId: "mor_carlos", moradorNome: "Carlos Lima", opcao: 0 },
          { moradorId: "mor_fernanda", moradorNome: "Fernanda Rocha", opcao: 2 },
        ],
        aberta: true,
        criadaEm: agora,
        encerradaEm: null,
        ata: null,
      },
    ],
    lancamentos: [],
    pedidosCorrecao: [],
  };

  await writeJSON("db/usuarios.json", usuarios);
  await writeJSON(`db/condos/${condominioId}.json`, dados);
  await salvarCondominios([dados.condominio]);
  await writeJSON("db/sessoes.json", []);
  void uid;
}
