import React from 'react';
import { IITDHAuthClient } from '../client/index.cjs';
import { I as IITDHUser, d as IITDHClientConfig } from '../types-z6LlfDC0.cjs';

interface IITDHAuthContextValue {
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
interface IITDHAuthProviderProps extends IITDHClientConfig {
    children: React.ReactNode;
    fallbackLoader?: React.ReactNode;
}
declare function IITDHAuthProvider({ children, clientId, apiUrl, allowedDomain, autoSelect, storageKey, onSuccess, onError, }: IITDHAuthProviderProps): React.JSX.Element;
declare const useIITDHAuth: () => IITDHAuthContextValue;

interface ProtectedRouteProps {
    roles?: string[];
    allowedRoles?: string[];
    children: React.ReactNode;
    fallbackLoader?: React.ReactNode;
    fallbackUnauthenticated?: React.ReactNode;
    fallbackForbidden?: React.ReactNode;
}
declare const ProtectedRoute: React.FC<ProtectedRouteProps>;

interface IITDHLoginButtonProps {
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    width?: number | string;
    className?: string;
    customButton?: React.ReactNode;
}
declare const IITDHLoginButton: React.FC<IITDHLoginButtonProps>;

interface IITDHAppLoaderProps {
    title?: string;
    subtitle?: string;
    minHeight?: string | number;
    className?: string;
}
declare const IITDHAppLoader: React.FC<IITDHAppLoaderProps>;

export { IITDHAppLoader, type IITDHAppLoaderProps, type IITDHAuthContextValue, IITDHAuthProvider, type IITDHAuthProviderProps, IITDHLoginButton, type IITDHLoginButtonProps, ProtectedRoute, type ProtectedRouteProps, useIITDHAuth };
