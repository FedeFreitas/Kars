"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ensureSession } from "@/services/auth";

export default function AuthGuard({ children, fallback = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState("checking"); // checking | ok | fail
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await ensureSession();
        if (!alive) return;
        if (data?.user) {
          const role = data.user.role;
          if (role === "pending" && pathname !== "/aguardando") {
            if (!redirecting) {
              setRedirecting(true);
              router.replace("/aguardando");
            }
            setStatus("fail");
          } else if (role === "client" && pathname !== "/cliente" && pathname !== "/aguardando") {
            if (!redirecting) {
              setRedirecting(true);
              router.replace("/cliente");
            }
            setStatus("fail");
          } else {
            setStatus("ok");
          }
        } else {
          setStatus("fail");
          if (!redirecting) {
            setRedirecting(true);
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          }
        }
      } catch {
        setStatus("fail");
        if (!redirecting) {
          setRedirecting(true);
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      }
    })();
    return () => { alive = false; };
  }, [router, pathname, redirecting]);

  if (status === "checking") {
    return fallback ?? <div style={{ padding: 24 }}>Checando sessão…</div>;
  }
  if (status === "ok") return children;
  return null; // redirecionando
}
