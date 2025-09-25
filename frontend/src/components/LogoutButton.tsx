'use client';

import { useRouter } from "next/navigation";
import { supabase } from "../app/utils/supabaseClient";
import { useCallback } from "react";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
    >
      Logout
    </button>
  );
}