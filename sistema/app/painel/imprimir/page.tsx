import { usuarioDaSessao } from "@/lib/auth";
import { carregarDados } from "@/lib/dados";
import { brl, dataBR } from "@/lib/store";
import { LOGO_DATA_URI } from "@/lib/logo";
import AutoPrint from "./auto-print";

const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ROTULO_CATEGORIA: Record<string, string> = { limpeza: "Limpeza", manutencao: "Manutenção", energia: "Energia", agua: "Água", seguranca: "Segurança", boleto: "Cobrança", taxa_extra: "Taxa extra", aluguel_salao: "Aluguel do salão", multa: "Multa", "Folha de pagamento": "Folha de pagamento", outros: "Outros" };

function nomeMesLongo(m: string) {
  const [y, mm] = m.split("-");
  return `${MESES_LONGOS[Number(mm) - 1] || ""} de ${y}`;
}

export default async function ImprimirPrestacao({ searchParams }: { searchParams: { mes?: string } }) {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return (
      <main style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
        <p>Você precisa entrar para imprimir a prestação de contas.</p>
        <p><a href="/">Ir para o login</a></p>
      </main>
    );
  }
  const dados = await carregarDados(usuario.condominioId);
  if (!dados) {
    return (
      <main style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
        <p>Condomínio não encontrado.</p>
      </main>
    );
  }
  const mes = /^\d{4}-\d{2}$/.test(searchParams.mes || "") ? searchParams.mes! : new Date().toISOString().slice(0, 7);
  const lancamentos = dados.lancamentos.filter((l) => l.data.slice(0, 7) === mes);
  const entradas = lancamentos.filter((l) => l.tipo === "receita" && l.pago).reduce((s, l) => s + l.valor, 0);
  const saidas = lancamentos.filter((l) => l.tipo === "despesa" && l.pago).reduce((s, l) => s + l.valor, 0);
  const pendentes = lancamentos.filter((l) => !l.pago);
  const ehSindico = usuario.papel === "sindico";

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; background: #fff !important; color: #12233a; font-size: 16px; line-height: 1.5; }
          .doc { max-width: 800px; margin: 0 auto; padding: 24px; }
          .doc-cabecalho { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #123a5c; padding-bottom: 12px; margin-bottom: 16px; }
          .doc-logo { height: 40px; width: auto; }
          .doc-titulo { font-size: 22px; font-weight: 800; color: #123a5c; }
          .doc-sub { font-size: 14px; color: #5b6b7d; }
          .doc-resumo { display: flex; gap: 12px; margin: 0 0 16px; }
          .doc-resumo > div { flex: 1; border: 1px solid #dde5ee; border-radius: 10px; padding: 10px 12px; }
          .doc-resumo span { display: block; font-size: 12px; color: #5b6b7d; }
          .doc-resumo strong { font-size: 18px; }
          .doc-tabela { width: 100%; border-collapse: collapse; font-size: 13px; }
          .doc-tabela th, .doc-tabela td { border: 1px solid #dde5ee; padding: 7px 8px; text-align: left; }
          .doc-tabela th { background: #f1f5f9; color: #123a5c; }
          .doc-tabela tr { break-inside: avoid; }
          .doc-obs { font-size: 13px; color: #b45309; }
          .doc-rodape { margin-top: 18px; padding-top: 10px; border-top: 1px solid #dde5ee; font-size: 12px; color: #5b6b7d; }
          .acoes { display: flex; gap: 8px; margin: 16px 0; }
          .acoes button, .acoes a { font-family: inherit; font-size: 16px; font-weight: 700; padding: 10px 18px; border-radius: 12px; border: 2px solid #0b2a4a; background: #fff; color: #0b2a4a; text-decoration: none; cursor: pointer; }
          .acoes button.principal { background: #22a06b; border-color: #22a06b; color: #fff; }
          @media print {
            @page { margin: 15mm; }
            .acoes { display: none !important; }
            .doc { max-width: 100%; padding: 0; }
          }
        `}</style>
        <main className="doc">
          <AutoPrint />
          <div className="doc-cabecalho">
            <img src={LOGO_DATA_URI} alt="CondoFree" className="doc-logo" />
            <div>
              <div className="doc-titulo">Prestação de contas</div>
              <div className="doc-sub">{dados.condominio.nome} · {nomeMesLongo(mes)}</div>
            </div>
          </div>
          <div className="doc-resumo">
            <div><span>Entradas pagas</span><strong>{brl(entradas)}</strong></div>
            <div><span>Saídas pagas</span><strong>{brl(saidas)}</strong></div>
            <div><span>Saldo do mês</span><strong>{brl(entradas - saidas)}</strong></div>
          </div>
          {ehSindico ? (
            <>
              <table className="doc-tabela">
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Status</th></tr></thead>
                <tbody>
                  {lancamentos.map((l) => (
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
            </>
          ) : (
            <p style={{ color: "#5b6b7d", fontSize: 14 }}>O detalhamento completo é apresentado pelo síndico na assembleia.</p>
          )}
          <p className="doc-rodape">Documento gerado pelo CondoFree em {new Date().toLocaleDateString("pt-BR")}. O CondoFree não recebe valores do condomínio.</p>
        </main>
    </>
  );
}
