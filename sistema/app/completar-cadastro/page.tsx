"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_DATA_URI } from "../../lib/logo";

type Aba = "sindico" | "morador";

// Tela que completa o cadastro com Google: o Google já provou o e-mail,
// então não há senha — a pessoa só diz se é síndico ou morador e
// completa os dados do condomínio. Ao digitar o código de convite, o
// nome do condomínio aparece sozinho para ela confirmar que é o certo.
// Depois de confirmar, a conta nasce logada e abre o painel direto.
export default function CompletarCadastro() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("sindico");
  const [token, setToken] = useState("");
  const [carregandoToken, setCarregandoToken] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [form, setForm] = useState({
    email: "",
    nome: "",
    nomeCondominio: "",
    unidades: "",
    codigoConvite: "",
    bloco: "",
    apartamento: "",
  });
  const [nomeCondominioAchado, setNomeCondominioAchado] = useState("");
  const [erroCodigo, setErroCodigo] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);
    if (!t) {
      setErro("Link inválido. Entre com o Google novamente.");
      setCarregandoToken(false);
      return;
    }
    fetch(`/api/auth/google/pendente?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setErro(d.erro || "Link expirado. Entre com o Google novamente.");
          return;
        }
        setForm((f) => ({ ...f, email: d.email, nome: d.nome || f.nome }));
      })
      .catch(() => setErro("Falha de conexão. Tente novamente."))
      .finally(() => setCarregandoToken(false));
  }, []);

  // Ao digitar o código de convite (6 letras), mostra o nome do
  // condomínio para o morador confirmar que é o certo.
  useEffect(() => {
    const codigo = form.codigoConvite.trim().toUpperCase();
    if (codigo.length !== 6) {
      setNomeCondominioAchado("");
      setErroCodigo("");
      return;
    }
    let cancelado = false;
    fetch(`/api/auth/google/condominio?codigo=${encodeURIComponent(codigo)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelado) return;
        if (d.ok) {
          setNomeCondominioAchado(d.nome);
          setErroCodigo("");
        } else {
          setNomeCondominioAchado("");
          setErroCodigo("Código de convite inválido. Peça o código ao síndico.");
        }
      })
      .catch(() => {
        if (!cancelado) setErroCodigo("Não foi possível conferir o código. Tente novamente.");
      });
    return () => {
      cancelado = true;
    };
  }, [form.codigoConvite]);

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
      const res = await fetch("/api/auth/google/completar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          papel: aba,
          nome: form.nome,
          nomeCondominio: form.nomeCondominio,
          unidades: Number(form.unidades),
          codigoConvite: form.codigoConvite,
          bloco: form.bloco,
          apartamento: form.apartamento,
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErro(d.erro || "Não foi possível criar a conta.");
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

  if (carregandoToken) {
    return (
      <div className="login-wrap">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="logo-grande">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DATA_URI} alt="CondoFree" />
        <h1 style={{ color: "#0b2a4a", margin: "8px 0 0" }}>Complete seu cadastro</h1>
        <p style={{ color: "#5b6b7d", marginTop: 4 }}>
          Você entrou com o Google — sem senha. Só falta dizer se você é síndico ou morador.
        </p>
      </div>

      <div className="abas-login">
        <button className={aba === "sindico" ? "ativo" : ""} onClick={() => setAba("sindico")}>Sou síndico</button>
        <button className={aba === "morador" ? "ativo" : ""} onClick={() => setAba("morador")}>Sou morador</button>
      </div>

      {erro && <div className="erro">{erro}</div>}
      {ok && <div className="ok-msg">{ok}</div>}

      {form.email && (
        <form onSubmit={enviar} className="cartao">
          <div className="campo">
            <label>E-mail (do Google)</label>
            <input value={form.email} disabled />
          </div>
          <div className="campo">
            <label>Seu nome</label>
            <input {...campo("nome")} placeholder="Seu nome completo" />
          </div>
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
            </>
          )}
          {aba === "morador" && (
            <>
              <div className="campo">
                <label>Código de convite do síndico</label>
                <input {...campo("codigoConvite")} placeholder="Ex.: MJGY3W" maxLength={6} style={{ textTransform: "uppercase" }} />
              </div>
              {nomeCondominioAchado && (
                <p style={{ color: "#166534" }}>
                  Você vai entrar no condomínio: <strong>{nomeCondominioAchado}</strong>
                </p>
              )}
              {erroCodigo && <p style={{ color: "#b91c1c" }}>{erroCodigo}</p>}
              <div className="campo">
                <label>Bloco</label>
                <input {...campo("bloco")} placeholder="Ex.: A" />
              </div>
              <div className="campo">
                <label>Apartamento</label>
                <input {...campo("apartamento")} placeholder="Ex.: 101" />
              </div>
            </>
          )}
          <button className="btn" type="submit" disabled={carregando}>
            {carregando ? "Criando conta..." : "Criar minha conta e entrar"}
          </button>
          <p style={{ color: "#5b6b7d", marginTop: 12 }}>
            14 dias grátis, sem cartão. Depois, R$ 9,90/mês nos 6 primeiros meses e R$ 97/mês. Cancele quando quiser, sem fidelidade e sem multa.
          </p>
        </form>
      )}
      {!form.email && !erro && (
        <p>
          Não foi possível continuar. <a href="/">Voltar para o login</a>
        </p>
      )}
    </div>
  );
}
