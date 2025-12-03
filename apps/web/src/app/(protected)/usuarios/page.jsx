"use client";

import { useEffect, useMemo, useState } from "react";
import { listUsers, updateUserRole, logoutUser, updateUserPermissions, updateUserProfile } from "@/services/users";
import { ensureSession, send2fa } from "@/services/auth";
import { useToast } from "@/components/ToastProvider";

const ROLES = ["pending", "client", "admin"];

const PERMISSION_SECTIONS = [
  {
    group: "Usuarios",
    permissions: [
      { key: "can_view_users", label: "Visualizar usuarios" },
      { key: "can_edit_users", label: "Gerenciar usuarios" }
    ]
  },
  {
    group: "Leads",
    permissions: [
      { key: "can_view_leads", label: "Visualizar leads" },
      { key: "can_edit_leads", label: "Gerenciar leads" }
    ]
  },
  {
    group: "Clientes",
    permissions: [
      { key: "can_view_clients", label: "Visualizar clientes" },
      { key: "can_edit_clients", label: "Gerenciar clientes" }
    ]
  },
  {
    group: "Financeiro",
    permissions: [
      { key: "can_view_finance", label: "Visualizar financeiro" },
      { key: "can_edit_finance", label: "Lancar/editar financeiro" },
      { key: "can_manage_finance_types", label: "Gerenciar tipos financeiros" },
      { key: "can_void_finance", label: "Anular lancamentos" }
    ]
  },
  {
    group: "Carros",
    permissions: [
      { key: "can_view_cars", label: "Visualizar carros" },
      { key: "can_edit_cars", label: "Gerenciar carros" }
    ]
  },
  {
    group: "Movimentacoes",
    permissions: [
      { key: "can_view_movements", label: "Visualizar movimentacoes" },
      { key: "can_create_movements", label: "Criar movimentacoes" },
      { key: "can_edit_movements", label: "Editar movimentacoes" },
      { key: "can_manage_movement_catalogs", label: "Gerenciar cadastros de movimentacoes" }
    ]
  },
  {
    group: "Emails",
    permissions: [
      { key: "can_view_email_templates", label: "Visualizar emails/templates" },
      { key: "can_edit_email_templates", label: "Editar emails/templates" }
    ]
  }
];

const PERMISSION_LIST = PERMISSION_SECTIONS.flatMap((section) => section.permissions);

function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md p-5">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <p className="text-neutral-700 mt-2">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-neutral-300 hover:border-neutral-500">Cancelar</button>
          <button onClick={onConfirm} className="px-3 py-2 rounded-lg text-white bg-neutral-900 hover:bg-neutral-800">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function PermissionModal({ open, user, draft, onToggle, onClose, onSave, saving }) {
  if (!open || !user) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
        <div className="px-6 py-4 border-b flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Permissoes</p>
            <h3 className="text-lg font-semibold text-neutral-900">{user.name || "Sem nome"}</h3>
            <p className="text-sm text-neutral-600">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-sm text-neutral-600 hover:text-neutral-900">Fechar</button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {PERMISSION_SECTIONS.map((section) => (
            <div key={section.group} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-neutral-900">{section.group}</h4>
                <span className="text-xs text-neutral-500">
                  {section.permissions.filter((p) => draft[p.key]).length} ativas
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {section.permissions.map((p) => (
                  <label key={p.key} className="flex items-center gap-3 border border-neutral-200 rounded-xl px-3 py-2 hover:border-neutral-400">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!draft[p.key]}
                      onChange={(e) => onToggle(p.key, e.target.checked)}
                    />
                    <span className="text-sm text-neutral-800">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t bg-neutral-50 flex justify-end gap-3">
          <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:border-neutral-500" onClick={onClose}>
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar permissoes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({
  open,
  user,
  draft,
  onChange,
  onClose,
  onSave,
  onSendCode,
  showPasswordFields,
  onTogglePasswordFields,
  sendingCode,
  saving
}) {
  if (!open || !user) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Editar usuario</p>
            <h3 className="text-lg font-semibold text-neutral-900">{user.name || "Sem nome"}</h3>
            <p className="text-sm text-neutral-600">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-sm text-neutral-600 hover:text-neutral-900">Fechar</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Nome</label>
            <input
              value={draft.name}
              onChange={(e) => onChange("name", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white focus:border-neutral-500"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Email</label>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => onChange("email", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white focus:border-neutral-500"
              autoComplete="off"
            />
          </div>
          <div className="pt-2 border-t border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-neutral-900">Senha</h4>
              {!showPasswordFields && (
                <button
                  onClick={() => onTogglePasswordFields(true)}
                  className="text-sm text-neutral-700 hover:text-neutral-900 underline"
                  type="button"
                >
                  Editar senha
                </button>
              )}
            </div>
            {showPasswordFields && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-800">Nova senha</label>
                  <input
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    value={draft.password}
                    onChange={(e) => onChange("password", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white focus:border-neutral-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-neutral-800">Codigo 2FA</label>
                    <button
                      type="button"
                      onClick={onSendCode}
                      disabled={sendingCode}
                      className="text-sm text-neutral-700 hover:text-neutral-900 underline disabled:opacity-60"
                    >
                      {sendingCode ? "Enviando..." : "Enviar codigo"}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={draft.twofa_code}
                    onChange={(e) => onChange("twofa_code", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white focus:border-neutral-500"
                  />
                  {draft.twofa_code_id && (
                    <p className="text-xs text-neutral-500">
                      Codigo enviado. ID: {draft.twofa_code_id}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onTogglePasswordFields(false);
                      onChange("password", "");
                      onChange("twofa_code", "");
                      onChange("twofa_code_id", "");
                    }}
                    className="text-xs text-neutral-600 underline"
                  >
                    Cancelar troca de senha
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t bg-neutral-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-neutral-300 hover:border-neutral-500">
            Fechar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar dados"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState("staff");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", action: null });
  const [canEditUsers, setCanEditUsers] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [permissionModal, setPermissionModal] = useState({ open: false, user: null });
  const [permDraft, setPermDraft] = useState({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [editModal, setEditModal] = useState({ open: false, user: null });
  const [profileDraft, setProfileDraft] = useState({ name: "", email: "", password: "", twofa_code: "", twofa_code_id: "" });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await ensureSession();
        const perms = me?.user?.permissions || {};
        if (!me?.user || !(perms.view_users || perms.edit_users)) {
          setError("Acesso restrito a administradores");
          setAuthorized(false);
          setLoading(false);
          return;
        }
        setCanEditUsers(!!perms.edit_users);
        setAuthorized(true);
        const { users } = await listUsers();
        setUsers(users);
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter((u) => {
      const inTab = tab === "staff"
        ? u.role !== "client" && u.role !== "pending"
        : tab === "clients"
          ? u.role === "client"
          : u.role === "pending";
      if (!inTab) return false;
      if (!term) return true;
      return (u.name || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term);
    });
  }, [users, tab, search]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [tab, search, pageSize]);

  function openConfirm(title, message, action) {
    setConfirm({ open: true, title, message, action });
  }
  function closeConfirm() {
    setConfirm({ open: false, title: "", message: "", action: null });
  }

  function openPermission(user) {
    if (!canEditUsers) return;
    setPermissionModal({ open: true, user });
    const draft = {};
    PERMISSION_LIST.forEach((p) => { draft[p.key] = !!user[p.key]; });
    setPermDraft(draft);
  }

  function closePermissionModal() {
    setPermissionModal({ open: false, user: null });
    setSavingPermissions(false);
  }

  function openEdit(user) {
    if (!canEditUsers) return;
    setEditModal({ open: true, user });
    setProfileDraft({
      name: user.name || "",
      email: user.email || "",
      password: "",
      twofa_code: "",
      twofa_code_id: ""
    });
    setShowPasswordFields(false);
  }

  function closeEditModal() {
    setEditModal({ open: false, user: null });
    setProfileDraft({ name: "", email: "", password: "", twofa_code: "", twofa_code_id: "" });
    setShowPasswordFields(false);
    setSendingCode(false);
  }

  async function onChangeRole(id, role) {
    if (!canEditUsers) return;
    openConfirm("Confirmar alteracao", `Confirmar mudanca de perfil para ${role}?`, async () => {
      try {
        const { user } = await updateUserRole(id, role);
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: user.role } : u)));
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      }
    });
  }

  async function onLogoutUser(id) {
    if (!canEditUsers) return;
    openConfirm("Deslogar usuario", "Revogar tokens e desconectar este usuario?", async () => {
      try {
        await logoutUser(id);
        toast.success("Usuario desconectado.");
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      }
    });
  }

  async function handleSavePermissions() {
    if (!canEditUsers || !permissionModal.user) return;
    setSavingPermissions(true);
    try {
      const { user } = await updateUserPermissions(permissionModal.user.id, permDraft);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...user } : u)));
      toast.success("Permissoes atualizadas.");
      closePermissionModal();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleSendCode() {
    if (!showPasswordFields) return;
    try {
      setSendingCode(true);
      const sent = await send2fa({ purpose: "password_change" });
      setProfileDraft((prev) => ({ ...prev, twofa_code_id: sent.codeId }));
      toast.success("Codigo de 2FA enviado.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSaveProfile() {
    if (!canEditUsers || !editModal.user) return;
    const payload = {};
    const trimmedName = profileDraft.name.trim();
    const trimmedEmail = profileDraft.email.trim();

    if (trimmedName && trimmedName !== (editModal.user.name || "")) payload.name = trimmedName;
    if (trimmedEmail && trimmedEmail !== (editModal.user.email || "")) payload.email = trimmedEmail;

    if (showPasswordFields) {
      if (!profileDraft.password) {
        toast.error("Informe a nova senha.");
        return;
      }
      if (!profileDraft.twofa_code_id || !profileDraft.twofa_code) {
        toast.error("Envie e informe o codigo de 2FA para trocar a senha.");
        return;
      }
      payload.password = profileDraft.password;
      payload.twofa_code = profileDraft.twofa_code;
      payload.twofa_code_id = profileDraft.twofa_code_id;
    }

    if (!Object.keys(payload).length) {
      toast.info("Nenhuma alteracao para salvar.");
      return;
    }

    setSavingProfile(true);
    try {
      const { user } = await updateUserProfile(editModal.user.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...user } : u)));
      toast.success("Dados do usuario atualizados.");
      closeEditModal();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  const grantedPerms = (u) => PERMISSION_LIST.filter((p) => u[p.key]);

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Gerenciar usuarios</h1>
          <p className="text-neutral-600 text-sm">Defina quem pode visualizar o painel, editar cards e observacoes.</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email"
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white shadow-sm w-full md:w-72"
        />
      </header>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("staff")}
          className={`px-3 py-2 rounded-lg border text-sm ${tab === "staff" ? "bg-neutral-900 text-white" : "bg-white border-neutral-200"}`}
        >
          Usuarios do sistema
        </button>
        <button
          onClick={() => setTab("clients")}
          className={`px-3 py-2 rounded-lg border text-sm ${tab === "clients" ? "bg-neutral-900 text-white" : "bg-white border-neutral-200"}`}
        >
          Clientes
        </button>
        <button
          onClick={() => setTab("pending")}
          className={`px-3 py-2 rounded-lg border text-sm ${tab === "pending" ? "bg-neutral-900 text-white" : "bg-white border-neutral-200"}`}
        >
          Pendentes
        </button>
      </div>
      {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</div>}
      {loading ? (
        <div>Carregando usuarios...</div>
      ) : !authorized ? (
        <div className="text-neutral-600">Acesso restrito a administradores.</div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Papel</th>
                <th className="text-left px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-left">Permissoes ativas</th>
                <th className="px-4 py-3 text-left">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((u) => (
                <tr key={u.id} className="border-t border-neutral-200">
                  <td className="px-4 py-3">{u.name || "Sem nome"}</td>
                  <td className="px-4 py-3 text-neutral-800">{u.email || "-"}</td>
                  <td className="px-4 py-3 capitalize">
                    <select
                      defaultValue={u.role}
                      disabled={!canEditUsers}
                      onChange={(e) => onChangeRole(u.id, e.target.value)}
                      className="border border-neutral-300 rounded-lg px-3 py-2 bg-white disabled:opacity-60"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    {grantedPerms(u).length ? (
                      <div className="flex flex-wrap gap-2">
                        {grantedPerms(u).map((p) => (
                          <span key={p.key} className="px-2 py-1 rounded-full border border-neutral-200 bg-neutral-50 text-xs text-neutral-800">
                            {p.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-500">Sem permissoes</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openEdit(u)}
                        disabled={!canEditUsers}
                        className="px-3 py-2 text-sm rounded-lg border border-neutral-300 hover:border-neutral-500 disabled:opacity-60"
                      >
                        Editar dados
                      </button>
                      <button
                        onClick={() => openPermission(u)}
                        disabled={!canEditUsers}
                        className="px-3 py-2 text-sm rounded-lg border border-neutral-300 hover:border-neutral-500 disabled:opacity-60"
                      >
                        Permissoes
                      </button>
                      <button
                        onClick={() => onLogoutUser(u.id)}
                        disabled={!canEditUsers}
                        className="px-3 py-2 text-sm rounded-lg border border-neutral-300 hover:border-neutral-500 disabled:opacity-60"
                      >
                        Deslogar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={6} className="text-center text-neutral-500 py-6">Nenhum usuario.</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-neutral-50 border-t border-neutral-200">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <span>Linhas por pagina</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-neutral-300 rounded-lg px-2 py-1 bg-white"
              >
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-neutral-500">
                {filtered.length ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filtered.length)} de ${filtered.length}` : "0 de 0"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
              >
                {"<"}
              </button>
              <span className="text-sm text-neutral-700">Pagina {page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 rounded border border-neutral-300 disabled:opacity-50"
              >
                {">"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PermissionModal
        open={permissionModal.open}
        user={permissionModal.user}
        draft={permDraft}
        onToggle={(field, value) => setPermDraft((prev) => ({ ...prev, [field]: value }))}
        onClose={closePermissionModal}
        onSave={handleSavePermissions}
        saving={savingPermissions}
      />

      <EditUserModal
        open={editModal.open}
        user={editModal.user}
        draft={profileDraft}
        onChange={(field, value) => setProfileDraft((prev) => ({ ...prev, [field]: value }))}
        onClose={closeEditModal}
        onSave={handleSaveProfile}
        onSendCode={handleSendCode}
        showPasswordFields={showPasswordFields}
        onTogglePasswordFields={setShowPasswordFields}
        sendingCode={sendingCode}
        saving={savingProfile}
      />

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onCancel={closeConfirm}
        onConfirm={async () => {
          if (confirm.action) await confirm.action();
          closeConfirm();
        }}
      />
    </main>
  );
}
