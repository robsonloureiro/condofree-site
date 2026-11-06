"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_DATA_URI, LOGIN_BG_DATA_URI } from "../lib/logo";

const VERDE = "#46d17c";

function IconeCalendario() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
  );
}
function IconeMegafone() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
  );
}
function IconeCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></svg>
  );
}
function IconeBoleto() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6v12" /><path d="M8 6v12" /><path d="M12 6v12" /><path d="M16 6v12" /><path d="M20 6v12" /></svg>
  );
}
function IconeGrafico() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>
  );
}
function IconeMoradores() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  );
}
function IconeFinanceiro() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>
  );
}

export default function Login() {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [form, setForm] = useState({
    email: "",
    senha: "",
  });

  useEffect(() => {
    fetch("/api/auth/login")
      .then((r) => r.json())
      .then((d) => {
        if (d.autenticado) router.replace("/painel");
      })
      .catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    setForm((f) => ({
      ...f,
      email: params.get("email") || f.email,
    }));
  }, [router]);

  function campo(nome: string) {
    return {
      value: (form as Record<string, string>)[nome],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm({ ...form, [nome]: e.target.value }),
    };
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOk("");
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, senha: form.senha }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErro(d.erro || "Não foi possível continuar.");
        return;
      }
      router.replace("/painel");
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function criarDemo() {
    setErro("");
    const res = await fetch("/api/seed", { method: "POST" });
    const d = await res.json();
    if (!d.ok) {
      setErro(d.erro || "Não foi possível criar a demonstração.");
      return;
    }
    setForm({ ...form, email: "sindico@exemplo.com", senha: "exemplo123" });
    setOk("Demonstração criada! Entre com síndico@exemplo.com / exemplo123.");
  }

  return (
    <div className="login-hero" style={{ backgroundImage: `url(${LOGIN_BG_DATA_URI})` }}>
      <div className="login-hero-grade">
        <aside className="login-hero-painel">
          <h1>
            Gestão completa para o seu{" "}
            <span className="login-sublinhado">
              condomínio
              <svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 10 Q 100 2 196 8" stroke={VERDE} strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <ul className="login-hero-lista">
            <li><IconeCalendario />Reservas de espaços</li>
            <li><IconeMegafone />Mural de avisos</li>
            <li><IconeCheck />Ocorrências com foto</li>
            <li><IconeBoleto />2ª via de boleto</li>
            <li><IconeGrafico />Votações e enquetes</li>
            <li><IconeMoradores />Cadastro de moradores</li>
            <li><IconeFinanceiro />Financeiro simples</li>
          </ul>
        </aside>

        <div className="login-hero-cartao">
          <div className="login-hero-cartao-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_DATA_URI} alt="CondoFree" />
          </div>
          <h2>Acesse o seu condomínio</h2>
          <p className="login-hero-sub">Entre com o mesmo e-mail e senha da sua conta.</p>

          {erro && <div className="erro">{erro}</div>}
          {ok && <div className="ok-msg">{ok}</div>}

          <form onSubmit={enviar}>
            <div className="campo">
              <label>E-mail</label>
              <div className="login-input-icone">
                <svg className="icone-campo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
                <input {...campo("email")} type="email" placeholder="voce@email.com" />
              </div>
            </div>
            <div className="campo">
              <label>Senha</label>
              <div className="login-input-icone">
                <svg className="icone-campo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <input
                  {...campo("senha")}
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7b8d",
                    lineHeight: 1,
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {mostrarSenha ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>
            <button className="btn" type="submit" disabled={carregando} style={{ width: "100%" }}>
              {carregando ? "Aguarde..." : <>Entrar <span aria-hidden="true">→</span></>}
            </button>
          </form>

          <button
            className="btn secundario"
            type="button"
            style={{ width: "100%", marginTop: 12 }}
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              const abaParam = params.get("aba");
              router.push(abaParam === "sindico" || abaParam === "morador" ? `/cadastro?aba=${abaParam}` : "/cadastro");
            }}
          >
            Criar conta grátis
          </button>
          <p className="login-hero-preco">
            14 dias grátis, sem cartão. Depois, R$ 9,90/mês nos 6 primeiros meses e R$ 97/mês.
          </p>

          <div className="login-hero-teste">
            <strong>🖥️ Conta de teste</strong>
            <p style={{ margin: "4px 0" }}>Síndico: sindico@exemplo.com · senha exemplo123</p>
            <p style={{ margin: "4px 0" }}>Morador: morador@exemplo.com · senha exemplo123</p>
            <button className="btn secundario pequeno" type="button" onClick={criarDemo}>
              Criar dados de demonstração
            </button>
          </div>
        </div>
      </div>

      <svg className="login-hero-onda" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 160 C 120 50 260 30 400 90 L 400 160 Z" fill="#22a06b" opacity="0.9" />
      </svg>
    </div>
  );
}
