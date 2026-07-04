"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import portalApi from "@/lib/portalApi";

export interface Customer {
  name: string;
  email: string;
  tenantId?: {
    name: string;
  };
}

interface PortalContextType {
  customer: Customer | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const PortalContext = createContext<PortalContextType>({
  customer: null,
  loading: true,
  refresh: async () => {},
});

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomer = async () => {
    try {
      const res = await portalApi.get("/portal/me");
      if (res.data?.data) {
        setCustomer(res.data.data);
      }
    } catch (error) {
      console.error("Failed to load customer profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if we have a token or expect one
    fetchCustomer();
  }, []);

  return (
    <PortalContext.Provider value={{ customer, loading, refresh: fetchCustomer }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  return useContext(PortalContext);
}
