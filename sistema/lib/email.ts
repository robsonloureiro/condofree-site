// E-mail de boas-vindas via Resend (mesmo serviço da newsletter do PopVerse).
// RESEND_API_KEY fica nas env vars da Vercel — nunca no código.
// Sem a chave (ou se o envio falhar), o cadastro continua funcionando:
// a conta já nasce ativa e o e-mail é só um extra. Por isso o envio nunca
// derruba o cadastro: qualquer erro vira log e retorna false.
const RESEND_URL = "https://api.resend.com/emails";
const REMETENTE = "CondoFree <contato@condofree.com.br>";
const APP_URL = "https://app.condofree.com.br";
const SUPORTE_WHATSAPP = "(21) 99151-2329";

function baseHtml(corpo: string): string {
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2a37;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;">
<h1 style="color:#0b2a4a;font-size:22px;margin:0 0 8px;">CondoFree</h1>
<p style="color:#46d17c;font-weight:700;margin:0 0 16px;">Mais controle, zero burocracia</p>
${corpo}
<p style="color:#5b6b7d;font-size:13px;margin-top:24px;">Dúvidas? Fale com a gente no WhatsApp ${SUPORTE_WHATSAPP}.</p>
</body></html>`;
}

async function enviar(para: string, assunto: string, texto: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REMETENTE, to: para, subject: assunto, text: texto, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("email boas-vindas falhou", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("email boas-vindas erro", e);
    return false;
  }
}

export async function enviarBoasVindasSindico(d: {
  to: string;
  nome: string;
  condominio: string;
  codigoConvite: string;
  trialFim: string;
}): Promise<boolean> {
  const trial = new Date(d.trialFim).toLocaleDateString("pt-BR");
  const texto = `Olá, ${d.nome}!\n\nSua conta no CondoFree está ativa. Seu condomínio: ${d.condominio}.\n\nCódigo de convite do seu condomínio: ${d.codigoConvite}\nPasse esse código aos moradores para eles criarem a conta deles.\n\nSeu teste grátis vai até ${trial}. Depois, R$ 9,90/mês nos 6 primeiros meses e R$ 97/mês. Cancele quando quiser, sem fidelidade e sem multa.\n\nAcesse o sistema: ${APP_URL}\n\nDúvidas? Fale com a gente no WhatsApp ${SUPORTE_WHATSAPP}.\n\nCondoFree — Mais controle, zero burocracia.`;
  const html = baseHtml(`<p>Olá, <strong>${d.nome}</strong>!</p>
<p>Sua conta no CondoFree está ativa. Seu condomínio: <strong>${d.condominio}</strong>.</p>
<p><strong>Código de convite do seu condomínio: ${d.codigoConvite}</strong><br>Passe esse código aos moradores para eles criarem a conta deles.</p>
<p>Seu teste grátis vai até <strong>${trial}</strong>. Depois, R$ 9,90/mês nos 6 primeiros meses e R$ 97/mês. Cancele quando quiser, sem fidelidade e sem multa.</p>
<p><a href="${APP_URL}" style="display:inline-block;background:#46d17c;color:#0b2a4a;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none;">Acessar o sistema</a></p>`);
  return enviar(d.to, "Bem-vindo ao CondoFree — sua conta está ativa", texto, html);
}

export async function enviarBoasVindasMorador(d: {
  to: string;
  nome: string;
  condominio: string;
  bloco: string;
  apartamento: string;
}): Promise<boolean> {
  const texto = `Olá, ${d.nome}!\n\nSua conta no CondoFree está ativa. Condomínio: ${d.condominio} — Bloco ${d.bloco}, apartamento ${d.apartamento}.\n\nAcesse o sistema: ${APP_URL}\n\nDúvidas? Fale com o síndico ou com a gente no WhatsApp ${SUPORTE_WHATSAPP}.\n\nCondoFree — Mais controle, zero burocracia.`;
  const html = baseHtml(`<p>Olá, <strong>${d.nome}</strong>!</p>
<p>Sua conta no CondoFree está ativa. Condomínio: <strong>${d.condominio}</strong> — Bloco ${d.bloco}, apartamento ${d.apartamento}.</p>
<p><a href="${APP_URL}" style="display:inline-block;background:#46d17c;color:#0b2a4a;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none;">Acessar o sistema</a></p>`);
  return enviar(d.to, "Bem-vindo ao CondoFree", texto, html);
}
