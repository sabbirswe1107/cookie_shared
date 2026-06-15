"use client";

import { AuthProvider } from "../../context/AuthContext";
import "../css/admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider prefix="admin" loginEndpoint="/api/v1/auth/admin/login">
      {children}
    </AuthProvider>
  );
}
