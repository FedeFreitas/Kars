"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Link from "next/link";
import {
  login,
  register,
  me,
  verify2fa,
  send2fa,
  resetRequest,
  resetConfirm,
  resetDecode
} from "@/services/auth";

function LoginContent() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const presetEmail = search.get("email") || "";
  const presetReset = search.get("reset") === "1";
  const presetToken = search.get("t") || "";

  const [mode, setMode] = useState("login"); // login | register | 2fa
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [codeId2fa, setCodeId2fa] = useState("");
  const [code2fa, setCode2fa] = useState("");
  const [remember, setRemember] = useState(true);
  const [resetMode, setResetMode] = useState(false);
  const [codeIdReset, setCodeIdReset] = useState("");
  const [codeReset, setCodeReset] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState({
    login: false,
    register: false,
    registerConfirm: false,
    reset: false,
    resetConfirm: false
  });
  const [resend2faTimer, setResend2faTimer] = useState(0);
  const [resendResetTimer, setResendResetTimer] = useState(0);
  const showResetInputs = resetMode;

  const togglePeek = (key) => setShowPass((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    me().then((m) => {
      if (m?.user) {
        if (m.user.role === "pending") router.replace("/aguardando");
        else router.replace(next);
      }
    });
  }, [router, next]);

  useEffect(() => {
    if (presetEmail) setEmail(presetEmail);
    if (presetReset) {
      setResetMode(true);
      setMode("login");
    }
  }, [presetEmail, presetReset]);

  useEffect(() => {
    if (!presetToken) return;
    (async () => {
      try {
        const res = await resetDecode({ token: presetToken });
        if (res?.email) {
          setEmail(res.email);
          setResetMode(true);
          setMode("login");
          setInfo("Link recebido. Confirme o codigo enviado para o e-mail para definir sua senha.");
        }
      } catch (e) {
        setErr(e.message || "Link invalido ou expirado");
      }
    })();
  }, [presetToken]);

  useEffect(() => {
    if (mode === "2fa" && codeId2fa) {
      setResend2faTimer(60);
    }
  }, [mode, codeId2fa]);

  useEffect(() => {
    if (resend2faTimer <= 0) return;
    const t = setTimeout(() => setResend2faTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resend2faTimer]);

  useEffect(() => {
    if (resendResetTimer <= 0) return;
    const t = setTimeout(() => setResendResetTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendResetTimer]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      if (resetMode) {
        if (!codeIdReset) {
          const res = await resetRequest({ email });
          setCodeIdReset(res.codeId);
          setInfo("Enviamos um codigo para seu e-mail. Expira em 10 minutos.");
          return;
        } else {
          if (resetPassword !== resetPasswordConfirm) throw new Error("As senhas nao conferem");
          await resetConfirm({ codeId: codeIdReset, code: codeReset, password: resetPassword });
          setResetMode(false);
          setInfo("Senha definida. Entre com a nova senha.");
          setPassword("");
          setResetPassword("");
          setResetPasswordConfirm("");
          setCodeReset("");
          setCodeIdReset("");
          setMode("login");
          return;
        }
      }

      if (mode === "login") {
        const res = await login({ email, password });
        if (res?.requiresReset) {
          setResetMode(true);
          setMode("login");
          setCodeIdReset(res.codeId || "");
          setCodeReset("");
          setInfo("Email encontrado sem senha. Enviamos um codigo para voce criar a senha.");
          return;
        }
        if (res?.requires2fa) {
          setMode("2fa");
          setCodeId2fa(res.codeId);
          setCode2fa("");
          setInfo("Enviamos um codigo para seu e-mail. Ele expira em 10 minutos.");
          return;
        }
      } else if (mode === "register") {
        const res = await register({ email, name, password });
        if (res?.requires2fa) {
          setMode("2fa");
          setCodeId2fa(res.codeId);
          setCode2fa("");
          setInfo("Enviamos um codigo para seu e-mail. Ele expira em 10 minutos.");
          return;
        }
      } else if (mode === "2fa") {
        await verify2fa({ codeId: codeId2fa, code: code2fa, rememberDevice: remember, purpose: "login" });
      }

      const session = await me();
      if (session?.user?.role === "pending") router.replace("/aguardando");
      else router.replace(next);
    } catch (e) {
      const msg = e.message || "Falha na autenticacao";
      if (/already registered|existe/i.test(msg)) {
        setMode("login");
      }
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function resend2fa() {
    if (resend2faTimer > 0 || loading || !codeId2fa) return;
    try {
      setLoading(true);
      await send2fa({ codeId: codeId2fa, email, purpose: "login" });
      setInfo("Novo codigo enviado para o e-mail.");
      setResend2faTimer(60);
    } catch (e) {
      setErr(e.message || "Falha ao reenviar codigo");
    } finally {
      setLoading(false);
    }
  }

  async function resendResetCode() {
    if (resendResetTimer > 0 || loading || !email) return;
    try {
      setLoading(true);
      const res = await resetRequest({ email });
      if (res?.codeId) setCodeIdReset(res.codeId);
      setInfo("Novo codigo enviado para o e-mail.");
      setResendResetTimer(60);
    } catch (e) {
      setErr(e.message || "Falha ao reenviar codigo");
    } finally {
      setLoading(false);
    }
  }

  const Title = resetMode ? "Criar sua senha" : mode === "login" ? "Entrar" : mode === "2fa" ? "Codigo de acesso" : "Criar conta";
  const subtitle = resetMode
    ? "Informe o e-mail, valide o codigo e crie uma nova senha."
    : mode === "login"
      ? "Acesse sua conta para continuar."
      : mode === "2fa"
        ? "Digite o codigo enviado para seu e-mail."
        : "Crie uma conta para acessar o app.";

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white border border-neutral-200 shadow-xl rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-neutral-900">{Title}</h1>
        <p className="text-neutral-600 mt-1 mb-6">{subtitle}</p>

        <form onSubmit={onSubmit} className="space-y-4">
          {!showResetInputs && mode === "register" && (
            <div>
              <label className="text-sm text-neutral-600">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full p-3 mt-1 rounded-xl bg-neutral-100 border border-neutral-300 focus:ring-2 focus:ring-yellow-400 outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-neutral-600">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              required
              className="w-full p-3 mt-1 rounded-xl bg-neutral-100 border border-neutral-300 focus:ring-2 focus:ring-yellow-400 outline-none"
            />
          </div>

          {!showResetInputs && mode !== "2fa" && (
            <div>
              <label className="text-sm text-neutral-600">Senha</label>
              <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-300 rounded-xl px-3">
                <input
                  type={showPass[mode === "register" ? "register" : "login"] ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  className="w-full p-3 bg-transparent outline-none"
                />
                <button type="button" onClick={() => togglePeek(mode === "register" ? "register" : "login")} className="text-neutral-700">
                  {showPass[mode === "register" ? "register" : "login"] ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
          )}

          {mode === "register" && !showResetInputs && (
            <div>
              <label className="text-sm text-neutral-600">Confirmar senha</label>
              <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-300 rounded-xl px-3">
                <input
                  type={showPass.registerConfirm ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                  className="w-full p-3 bg-transparent outline-none"
                />
                <button type="button" onClick={() => togglePeek("registerConfirm")} className="text-neutral-700">
                  {showPass.registerConfirm ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
          )}

          {mode === "2fa" && (
            <div className="space-y-2">
              <label className="text-sm text-neutral-600">Codigo 2FA</label>
              <input
                value={code2fa}
                onChange={(e) => setCode2fa(e.target.value)}
                maxLength={6}
                required
                className="w-full p-3 mt-1 rounded-xl bg-neutral-100 border border-neutral-300 focus:ring-2 focus:ring-yellow-400 outline-none tracking-widest text-center"
              />
              <div className="flex items-center justify-between text-sm text-neutral-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Lembrar este dispositivo por 24h
                </label>
                <button
                  type="button"
                  onClick={resend2fa}
                  disabled={resend2faTimer > 0 || loading || !codeId2fa}
                  className="text-yellow-700 disabled:text-neutral-400"
                >
                  {resend2faTimer > 0 ? `Reenviar em ${resend2faTimer}s` : "Reenviar codigo"}
                </button>
              </div>
            </div>
          )}

          {showResetInputs && (
            <>
              {!codeIdReset && (
                <p className="text-sm text-neutral-600">Enviaremos um codigo de 6 digitos para seu e-mail.</p>
              )}
              {codeIdReset && (
                <div className="space-y-2">
                  <label className="text-sm text-neutral-600">Codigo recebido por e-mail</label>
                  <input
                    value={codeReset}
                    onChange={(e) => setCodeReset(e.target.value)}
                    maxLength={6}
                    required
                    className="w-full p-3 rounded-xl bg-neutral-100 border border-neutral-300 focus:ring-2 focus:ring-yellow-400 outline-none tracking-widest text-center"
                  />
                  <div className="flex justify-end text-sm">
                    <button
                      type="button"
                      onClick={resendResetCode}
                      disabled={resendResetTimer > 0 || loading}
                      className="text-yellow-700 disabled:text-neutral-400"
                    >
                      {resendResetTimer > 0 ? `Reenviar em ${resendResetTimer}s` : "Reenviar codigo"}
                    </button>
                  </div>
                </div>
              )}
              {codeIdReset && (
                <>
                  <div>
                    <label className="text-sm text-neutral-600">Nova senha</label>
                    <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-300 rounded-xl px-3">
                      <input
                        type={showPass.reset ? "text" : "password"}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="********"
                        required
                        className="w-full p-3 bg-transparent outline-none"
                      />
                      <button type="button" onClick={() => togglePeek("reset")} className="text-neutral-700">
                        {showPass.reset ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-neutral-600">Confirmar senha</label>
                    <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-300 rounded-xl px-3">
                      <input
                        type={showPass.resetConfirm ? "text" : "password"}
                        value={resetPasswordConfirm}
                        onChange={(e) => setResetPasswordConfirm(e.target.value)}
                        placeholder="********"
                        required
                        className="w-full p-3 bg-transparent outline-none"
                      />
                      <button type="button" onClick={() => togglePeek("resetConfirm")} className="text-neutral-700">
                        {showPass.resetConfirm ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {err && <div className="text-red-600 text-sm font-medium mt-2">{err}</div>}
          {info && <div className="text-green-700 text-sm font-medium mt-2">{info}</div>}

          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3 rounded-xl text-black font-semibold mt-4
              bg-yellow-400 hover:bg-yellow-500 transition-all shadow-lg
              cursor-pointer disabled:opacity-60
            "
          >
            {loading
              ? "Enviando..."
              : resetMode
                ? codeIdReset ? "Confirmar codigo e redefinir" : "Enviar codigo"
                : mode === "login"
                  ? "Entrar"
                  : mode === "2fa"
                    ? "Confirmar codigo"
                    : "Registrar"}
          </button>
        </form>

        {!resetMode && mode !== "2fa" && (
          <div className="mt-3 text-right">
            <button
              onClick={() => { setResetMode(true); setMode("login"); setCodeIdReset(""); setCodeReset(""); setInfo(""); }}
              className="text-sm text-yellow-700 hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        <div className="mt-5 text-center text-sm">
          {resetMode ? (
            <button
              onClick={() => { setResetMode(false); setCodeIdReset(""); setCodeReset(""); setInfo(""); }}
              className="text-yellow-600 font-semibold hover:underline cursor-pointer"
            >
              Voltar ao login
            </button>
          ) : mode === "login" ? (
            <>
              Ainda nao tem conta?{" "}
              <button
                onClick={() => setMode("register")}
                className="text-yellow-600 font-semibold hover:underline cursor-pointer"
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Ja tem conta?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-yellow-600 font-semibold hover:underline cursor-pointer"
              >
                Entrar
              </button>
            </>
          )}
        </div>
        <div className="mt-4 text-center">
          <Link href="/" className="text-neutral-600 hover:text-neutral-900 text-sm underline">
            Voltar para a pagina inicial
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-700">Carregando...</main>}>
      <LoginContent />
    </Suspense>
  );
}
