import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IITDHAuthClient, loadGoogleGsiScript } from "../client/authClient.js";
import { DEFAULT_ALLOWED_DOMAIN, DEFAULT_STORAGE_KEY } from "../shared/constants.js";
import { IITDHClientConfig, IITDHUser } from "../shared/types.js";

export interface IITDHAuthContextValue {
  user: IITDHUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  client: IITDHAuthClient;
  login: (credentialOrToken: any) => Promise<IITDHUser>;
  triggerGoogleSignIn: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<IITDHUser | null>;
  renderGoogleButton: (container: HTMLElement, options?: any) => void;
}

const IITDHAuthContext = createContext<IITDHAuthContextValue | null>(null);

export interface IITDHAuthProviderProps extends IITDHClientConfig {
  children: React.ReactNode;
  fallbackLoader?: React.ReactNode;
}

export function IITDHAuthProvider({
  children,
  clientId,
  apiUrl,
  allowedDomain = DEFAULT_ALLOWED_DOMAIN,
  autoSelect = true,
  storageKey = DEFAULT_STORAGE_KEY,
  onSuccess,
  onError,
}: IITDHAuthProviderProps) {
  const [user, setUser] = useState<IITDHUser | null>(() => {
    if (typeof window === "undefined") return null;
    const clientInstance = new IITDHAuthClient({ storageKey });
    return clientInstance.tokenManager.getStoredUser();
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const tokenClientRef = useRef<any>(null);
  const hasPromptedRef = useRef<boolean>(false);

  const client = useMemo(() => {
    return new IITDHAuthClient({
      clientId,
      apiUrl,
      allowedDomain,
      autoSelect,
      storageKey,
      onSuccess: (u) => {
        setUser(u);
        setError(null);
        onSuccess?.(u);
      },
      onError: (err) => {
        setError(err.message || "Authentication failed");
        onError?.(err);
      },
    });
  }, [clientId, apiUrl, allowedDomain, autoSelect, storageKey, onSuccess, onError]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const login = useCallback(
    async (response: any) => {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        const u = await client.loginWithGoogle(response);
        if (isMountedRef.current) {
          setUser(u);
          setError(null);
        }
        return u;
      } catch (err: any) {
        if (isMountedRef.current) {
          setUser(null);
          setError(err.message || "Authentication failed");
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [client]
  );

  const logout = useCallback(async () => {
    try {
      await client.logout();
    } finally {
      if (isMountedRef.current) {
        setUser(null);
        setError(null);
      }
    }
  }, [client]);

  const refreshUser = useCallback(async () => {
    try {
      const u = await client.getCurrentUser();
      if (isMountedRef.current) {
        setUser(u);
      }
      return u;
    } catch {
      return null;
    }
  }, [client]);

  const triggerGoogleSignIn = useCallback(() => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: "select_account" });
    } else if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2 && clientId) {
      const oauthClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: (resp: any) => {
          if (resp?.access_token) {
            login(resp);
          }
        },
      });
      tokenClientRef.current = oauthClient;
      oauthClient.requestAccessToken({ prompt: "select_account" });
    } else {
      setError("Google Identity Services loading. Please try again in a moment.");
    }
  }, [clientId, login]);

  const renderGoogleButton = useCallback(
    (container: HTMLElement, options: any = {}) => {
      if (typeof window === "undefined" || !container) return;
      if ((window as any).google?.accounts?.id) {
        try {
          container.innerHTML = "";
          (window as any).google.accounts.id.renderButton(container, {
            theme: "outline",
            size: "large",
            shape: "rectangular",
            width: 280,
            logo_alignment: "left",
            text: "signin_with",
            ...options,
          });
        } catch (e) {
          console.warn("[IITDH Google Auth] renderButton error:", e);
        }
      }
    },
    []
  );

  // Initialize session & Google One Tap on mount
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      // 1. Check for existing active backend session
      try {
        const activeUser = await client.getCurrentUser();
        if (activeUser && !isCancelled) {
          console.log(
            "%c[IITDH GOOGLE AUTH] 🔄 Active session restored for:",
            "color: #10b981; font-weight: bold;",
            activeUser.email
          );
          setUser(activeUser);
          setLoading(false);
          return;
        }
      } catch {
        // session check completed
      }

      if (!clientId) {
        if (!isCancelled) setLoading(false);
        return;
      }

      // 2. Load GSI Library and initialize One Tap
      await loadGoogleGsiScript();

      if (typeof window !== "undefined" && (window as any).google?.accounts && !isCancelled) {
        try {
          // Initialize OAuth2 Popup client
          if ((window as any).google.accounts.oauth2) {
            tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: "openid email profile",
              callback: (resp: any) => {
                if (!isCancelled && resp?.access_token) {
                  login(resp);
                }
              },
            });
          }

          // Initialize One Tap
          if ((window as any).google.accounts.id) {
            const domain = window.location.hostname;
            const stateCookieDomain = domain.endsWith(allowedDomain) ? allowedDomain : undefined;

            (window as any).google.accounts.id.initialize({
              client_id: clientId,
              callback: (res: any) => {
                if (!isCancelled) login(res);
              },
              hd: allowedDomain,
              auto_select: autoSelect,
              use_fedcm_for_prompt: true,
              cancel_on_tap_outside: false,
              state_cookie_domain: stateCookieDomain,
            });

            if (!hasPromptedRef.current) {
              hasPromptedRef.current = true;
              (window as any).google.accounts.id.prompt((notification: any) => {
                if (!isCancelled) setLoading(false);
              });
            }
          }
        } catch (e: any) {
          console.warn("[IITDH Google Auth] One Tap init notice:", e.message);
        }
      }

      if (!isCancelled) {
        setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [client, clientId, allowedDomain, autoSelect, login]);

  const value = useMemo<IITDHAuthContextValue>(() => {
    return {
      user,
      isAuthenticated: !!user,
      loading,
      error,
      client,
      login,
      triggerGoogleSignIn,
      logout,
      refreshUser,
      renderGoogleButton,
    };
  }, [user, loading, error, client, login, triggerGoogleSignIn, logout, refreshUser, renderGoogleButton]);

  return <IITDHAuthContext.Provider value={value}>{children}</IITDHAuthContext.Provider>;
}

export const useIITDHAuth = (): IITDHAuthContextValue => {
  const context = useContext(IITDHAuthContext);
  if (!context) {
    throw new Error("useIITDHAuth must be used within an <IITDHAuthProvider>");
  }
  return context;
};

export default IITDHAuthProvider;
