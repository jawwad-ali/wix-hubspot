"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface WixInstanceContextValue {
  instanceId: string | null;
  connectionId: string | null;
  isLoading: boolean;
  error: string | null;
}

const WixInstanceContext = createContext<WixInstanceContextValue>({
  instanceId: null,
  connectionId: null,
  isLoading: true,
  error: null,
});

export function useWixInstance() {
  return useContext(WixInstanceContext);
}

export function WixInstanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WixInstanceContextValue>({
    instanceId: null,
    connectionId: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function init() {
      // Read ?instance= or ?instanceId= from URL
      const params = new URLSearchParams(window.location.search);
      const instanceToken = params.get("instance");
      const instanceIdParam = params.get("instanceId");

      if (instanceIdParam) {
        // Direct instanceId (e.g., from OAuth callback redirect)
        setState({
          instanceId: instanceIdParam,
          connectionId: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      if (!instanceToken) {
        // Not in a Wix iframe — use demo mode
        setState({
          instanceId: "demo",
          connectionId: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      try {
        // Exchange the instance token for a connection
        const response = await fetch("/api/auth/wix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instance: instanceToken }),
        });

        const data = await response.json();

        if (data.success) {
          setState({
            instanceId: data.data.instanceId,
            connectionId: data.data.connectionId,
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            instanceId: null,
            connectionId: null,
            isLoading: false,
            error: data.error || "Failed to authenticate",
          });
        }
      } catch (error) {
        setState({
          instanceId: null,
          connectionId: null,
          isLoading: false,
          error: "Failed to connect to Wix",
        });
      }
    }

    init();
  }, []);

  return (
    <WixInstanceContext.Provider value={state}>
      {children}
    </WixInstanceContext.Provider>
  );
}
