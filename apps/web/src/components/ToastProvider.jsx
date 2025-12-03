"use client";

import { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => remove(id), toast.duration ?? 4000);
  }, [remove]);

  const api = useMemo(() => ({
    show: (message, opts = {}) => push({ message, type: opts.type || "info", duration: opts.duration }),
    error: (message, opts = {}) => push({ message, type: "error", duration: opts.duration }),
    success: (message, opts = {}) => push({ message, type: "success", duration: opts.duration }),
    info: (message, opts = {}) => push({ message, type: "info", duration: opts.duration })
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`min-w-[260px] max-w-sm px-4 py-3 rounded-xl shadow-lg border text-sm text-white ${
              t.type === "error" ? "bg-red-600 border-red-700" :
              t.type === "success" ? "bg-emerald-600 border-emerald-700" :
              "bg-neutral-800 border-neutral-700"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || { show: () => {}, error: () => {}, success: () => {}, info: () => {} };
}
