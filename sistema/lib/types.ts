export type Papel = "sindico" | "morador";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  condominioId: string;
  senhaHash: string;
  criadoEm: string;
}

export interface Condominio {
  id: string;
  nome: string;
  unidades: number;
  codigoConvite: string;
  criadoEm: string;
  trialFim: string; // ISO date
  assinaturaStatus: "trial" | "ativa" | "vencida" | "cancelada";
  assinaturaPlanoId?: string | null;
  assinaturaPreapprovalId?: string | null;
  mpConfig?: { accessToken?: string } | null;
  pixChave?: string | null; // Pix do condomínio para receber as cobranças
  cobrancaRecorrente?: { dia: number; valor: number; descricao: string } | null;
}

export interface Morador {
  id: string;
  usuarioId?: string | null;
  nome: string;
  bloco: string;
  apartamento: string;
  email: string;
}

export interface Espaco {
  id: string;
  nome: string;
}

export interface Reserva {
  id: string;
  espacoId: string;
  espacoNome: string;
  moradorId: string;
  moradorNome: string;
  data: string; // YYYY-MM-DD
  inicio: string; // HH:MM
  fim: string; // HH:MM
  status: "pendente" | "aprovada" | "recusada" | "cancelada";
  criadoEm: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  texto: string;
  criadoEm: string;
  lidoPor: string[]; // moradorIds
}

export interface Ocorrencia {
  id: string;
  titulo: string;
  descricao: string;
  local: string;
  fotoUrl?: string | null;
  status: "aberta" | "em_andamento" | "resolvida";
  moradorId: string;
  moradorNome: string;
  criadoEm: string;
}

export interface Boleto {
  id: string;
  moradorId: string;
  moradorNome: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  status: "pendente" | "aguardando" | "pago" | "vencido"; // aguardando = morador marcou pago, síndico ainda não confirmou
  codigoBarras?: string | null;
  mes: string; // YYYY-MM
  descricao?: string | null;
  comprovanteUrl?: string | null;
}

export interface Votacao {
  id: string;
  pergunta: string;
  opcoes: string[];
  votos: { moradorId: string; moradorNome: string; opcao: number }[];
  aberta: boolean;
  criadaEm: string;
  encerradaEm?: string | null;
  ata?: string | null;
}

export interface Lancamento {
  id: string;
  tipo: "receita" | "despesa";
  categoria: string;
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  pago: boolean;
  origem?: "manual" | "boleto" | "folha";
  boletoId?: string | null;
  folhaId?: string | null;
}

export type TipoContrato = "CLT" | "MEI" | "Diarista" | "Outro";

export interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  tipoContrato: TipoContrato;
  salarioMensal: number;
  dataAdmissao: string; // YYYY-MM-DD
  ativo: boolean;
  criadoEm: string;
}

export interface FolhaItem {
  funcionarioId: string;
  funcionarioNome: string;
  cargo: string;
  salarioBase: number;
  adiantamento: number;
  descontos: number;
  extras: number;
  liquido: number;
  pago: boolean;
}

export interface FolhaMensal {
  id: string;
  mes: string; // YYYY-MM
  itens: FolhaItem[];
  totalLiquido: number;
  criadaEm: string;
}

export interface PedidoCorrecao {
  id: string;
  moradorId: string;
  moradorNome: string;
  campo: string;
  errado: string;
  certo: string;
  status: "pendente" | "aprovado" | "recusado";
  criadoEm: string;
}

export interface DadosCondominio {
  condominio: Condominio;
  moradores: Morador[];
  espacos: Espaco[];
  reservas: Reserva[];
  avisos: Aviso[];
  ocorrencias: Ocorrencia[];
  boletos: Boleto[];
  votacoes: Votacao[];
  lancamentos: Lancamento[];
  pedidosCorrecao: PedidoCorrecao[];
  funcionarios: Funcionario[];
  folhas: FolhaMensal[];
}

export interface Sessao {
  token: string;
  usuarioId: string;
  expiraEm: string;
}
