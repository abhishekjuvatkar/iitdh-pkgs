import { I as IITDHUser, d as IITDHClientConfig, G as GoogleCredentialResponse, b as GoogleTokenResponse } from '../types-z6LlfDC0.js';

/**
 * Token and localStorage / sessionStorage state manager for IITDH Auth
 */
declare class IITDHTokenManager {
    private storageKey;
    constructor(storageKey?: string);
    getStoredUser(): IITDHUser | null;
    setStoredUser(user: IITDHUser | null | undefined): void;
    clear(): void;
}
declare const tokenManager: IITDHTokenManager;

/**
 * Loads the Google Identity Services SDK script asynchronously.
 */
declare function loadGoogleGsiScript(): Promise<void>;
/**
 * IIT Dharwad Universal Google Auth Client
 */
declare class IITDHAuthClient {
    config: Required<IITDHClientConfig>;
    tokenManager: IITDHTokenManager;
    constructor(config?: IITDHClientConfig);
    /**
     * Authenticate with Google Credential or Access Token with Backend
     */
    loginWithGoogle(response: GoogleCredentialResponse | GoogleTokenResponse | string): Promise<IITDHUser>;
    /**
     * Check and restore active session via HTTP cookies
     */
    getCurrentUser(): Promise<IITDHUser | null>;
    /**
     * Sign out and prohibit auto-select loop
     */
    logout(): Promise<void>;
}

export { IITDHAuthClient, IITDHTokenManager, loadGoogleGsiScript, tokenManager };
