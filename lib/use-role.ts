"use client";

import { useState, useEffect } from "react";
import type { AppRole } from "@/lib/auth-helpers";

interface RoleState {
  role: AppRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
}

export function useRole(): RoleState {
  const [state, setState] = useState<RoleState>({
    role: "member",
    isAdmin: false,
    isSuperAdmin: false,
    loading: true,
  });

  useEffect(() => {
    async function fetchRole() {
      try {
        const res = await fetch("/api/auth/role");
        if (res.ok) {
          const data = await res.json();
          setState({
            role: data.role,
            isAdmin: data.isAdmin,
            isSuperAdmin: data.isSuperAdmin,
            loading: false,
          });
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } catch {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchRole();
  }, []);

  return state;
}
