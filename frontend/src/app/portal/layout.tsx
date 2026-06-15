"use client";

import { AuthProvider } from "../../context/AuthContext";
import "../css/portal.css";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider prefix="portal" loginEndpoint="/api/v1/auth/login">
      {children}
    </AuthProvider>
  );
}
