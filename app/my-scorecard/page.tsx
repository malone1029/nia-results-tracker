// app/my-scorecard/page.tsx
// Redirects to /owner/[current-user-id]
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function MyScorecardRedirect() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace(`/owner/${user.id}`);
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  return null;
}
