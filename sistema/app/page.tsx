"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_DATA_URI } from "@/lib/logo";

type Aba = "entrar" | "sindico" | "morador";

export default function Login() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("entrar");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [form, setForm] = useState({
    email: "",
    senha: "",
    nome: "",
    nomeCondominio: "",
    unidades: "",
    codigoConvite: "",
    bloco: "",
    apartamento: "",
  });

  useEffect(() => {
    fetch("/api/auth/login")
      .then((r) => r.json())
      .then((d) => {
        if (d.autenticado) router.replace("/painel");
      })
      .catch(() => undefined);
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
      let url = "/api/auth/login";
      let corpo: Record<string, unknown> = { email: form.email, senha: form.senha };
      if (aba === "sindico") {
        url = "/api/auth/cadastro-sindico";
        corpo = {
          nomeCondominio: form.nomeCondominio,
          unidades: Number(form.unidades),
          nome: form.nome,
          email: form.email,
          senha: form.senha,
        };
      } else if (aba === "morador") {
        url = "/api/auth/cadastro-morador";
        corpo = {
          codigoConvite: form.codigoConvite,
          nome: form.nome,
          bloco: form.bloco,
          apartamento: form.apartamento,
          email: form.email,
          senha: form.senha,
        };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await res.json();
      if (!d.ok) {
        setErro(d.erro || "Não foi possível continuar.");
        return;
      }
      if (d.codigoConvite) {
        setOk(`Conta criada! Código de convite do seu condomínio: ${d.codigoConvite}. Guarde e passe aos moradores.`);
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
    setAba("entrar");
    setOk("Demonstração criada! Entre com síndico@exemplo.com / exemplo123.");
  }

  return (
    <div className="login-wrap">
      <div className="logo-grande">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DATA_URI} alt="CondoFree" />
        <h1 style={{ color: "#0b2a4a", margin: "8px 0 0" }}>Acesse o seu condomínio</h1>
        <p style={{ color: "#5b6b7d", marginTop: 4 }}>
          Sem e-mail de confirmação: sua conta já nasce ativa. Cadastre-se na aba ao lado e entre com o mesmo e-mail e senha.
        </p>
      </div>

      <div className="abas-login">
        <button className={aba === "entrar" ? "ativo" : ""} onClick={() => setAba("entrar")}>Entrar</button>
        <button className={aba === "sindico" ? "ativo" : ""} onClick={() => setAba("sindico")}>Sou síndico — criar conta</button>
        <button className={aba === "morador" ? "ativo" : ""} onClick={() => setAba("morador")}>Sou morador — criar conta</button>
      </div>

      {erro && <div className="erro">{erro}</div>}
      {ok && <div className="ok-msg">{ok}</div>}

      <form onSubmit={enviar} className="cartao">
        {aba === "sindico" && (
          <>
            <div className="campo">
              <label>Nome do condomínio</label>
              <input {...campo("nomeCondominio")} placeholder="Ex.: Condomínio Jardim das Flores" />
            </div>
            <div className="campo">
              <label>Quantas unidades?</label>
              <input {...campo("unidades")} type="number" min={1} placeholder="Ex.: 40" />
            </div>
            <div className="campo">
              <label>Seu nome</label>
              <input {...campo("nome")} placeholder="Seu nome completo" />
            </div>
          </>
        )}
        {aba === "morador" && (
          <>
            <div className="campo">
              <label>Código de convite do condomínio</label>
              <input {...campo("codigoConvite")} placeholder="Peça o código ao síndico" />
            </div>
            <div className="campo">
              <label>Seu nome</label>
              <input {...campo("nome")} placeholder="Seu nome completo" />
            </div>
            <div className="linha">
              <div className="campo">
                <label>Bloco</label>
                <input {...campo("bloco")} placeholder="Ex.: A" />
              </div>
              <div className="campo">
                <label>Apartamento</label>
                <input {...campo("apartamento")} placeholder="Ex.: 101" />
              </div>
            </div>
          </>
        )}
        <div className="campo">
          <label>E-mail</label>
          <input {...campo("email")} type="email" placeholder="voce@email.com" />
        </div>
        <div className="campo">
          <label>Senha</label>
          <input {...campo("senha")} type="password" placeholder="Mínimo 6 caracteres" />
        </div>
        <button className="btn" type="submit" disabled={carregando} style={{ width: "100%" }}>
          {carregando ? "Aguarde..." : aba === "entrar" ? "Entrar" : "Criar minha conta grátis"}
        </button>
        {aba === "sindico" && (
          <p style={{ color: "#5b6b7d", fontSize: 14, marginTop: 12 }}>
            14 dias grátis, sem cartão. Depois, R$ 9,90/mês nos 6 primeiros meses e R$ 97/mês. Cancele quando quiser, sem fidelidade e sem multa.
          </p>
        )}
      </form>

      <div className="cartao" style={{ fontSize: 14 }}>
        <strong>Conta de teste</strong>
        <p style={{ margin: "4px 0" }}>Síndico: sindico@exemplo.com · senha exemplo123</p>
        <p style={{ margin: "4px 0" }}>Morador: morador@exemplo.com · senha exemplo123</p>
        <button className="btn secundario pequeno" type="button" onClick={criarDemo}>
          Criar dados de demonstração
        </button>
      </div>
    </div>
  );
}
