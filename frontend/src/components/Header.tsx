'use client';

import { useRouter } from "next/navigation";
import { supabase } from "../app/utils/supabaseClient";
import { useCallback } from "react";

export default function Header() {
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-white shadow-md flex items-center justify-between px-8 py-4 h-16">
      <div className="text-xl font-bold text-gray-800 tracking-tight">
        NIfTI to DICOM Viewer
      </div>
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
      >
        Logout
      </button>
    </header>
  );
}