# CondoFree — Sistema

Aplicativo do CondoFree (Next.js 14, App Router). Dados em Vercel Blob (privado).

## Variáveis de ambiente (Vercel → Settings → Environment Variables)
- `BLOB_READ_WRITE_TOKEN` — token do store Blob `condofree-db` (Storage → condofree-db → .env.local). Sem ele, o app usa arquivos locais em `./data` (só desenvolvimento).
- `MP_ACCESS_TOKEN` — token do Mercado Pago (para o webhook ativar a assinatura após o pagamento). Sem ele, o checkout funciona, mas a ativação automática não acontece.

## Deploy
Projeto Vercel separado, com Root Directory `sistema/`, a partir do repo `robsonloureiro/condofree-site`.
Depois do primeiro deploy, crie os dados de demonstração na tela de login ("Criar dados de demonstração") ou cadastre um condomínio novo.
