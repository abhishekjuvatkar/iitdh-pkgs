/**
 * Core type definitions for @iitdh/google-auth
 */
interface IITDHUserRole {
    roleId?: number | string;
    roleName: string;
    roleCode?: string;
    description?: string;
}
interface IITDHEmployeeMetadata {
    EmployeeId?: string | number;
    UserName?: string;
    EmployeeName?: string;
    EmployeeDesignationId?: number | string;
    EmployeeDesignationName?: string;
    DepartmentId?: number | string;
    DepartmentName?: string;
    OfficialMailID?: string;
    ReportingOfficer?: string;
    ReportingOfficerEmployeeId?: string | number;
    ReportingOfficerUserName?: string;
    ReportingOfficerEmail?: string;
    roles?: IITDHUserRole[] | string[];
    [key: string]: any;
}
interface IITDHUser {
    id?: string | number;
    uid?: string | number;
    email: string;
    name: string;
    role?: string;
    roles?: IITDHUserRole[] | string[];
    employeeId?: string | number;
    username?: string;
    designation?: string;
    department?: string;
    departmentName?: string;
    picture?: string;
    hd?: string;
    isActive?: boolean;
    employee?: IITDHEmployeeMetadata | null;
    [key: string]: any;
}
interface IITDHAuthState {
    user: IITDHUser | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}
interface IITDHClientConfig {
    clientId?: string;
    apiUrl?: string;
    allowedDomain?: string;
    autoSelect?: boolean;
    storageKey?: string;
    onSuccess?: (user: IITDHUser) => void;
    onError?: (error: Error) => void;
}
interface GoogleCredentialResponse {
    credential?: string;
    select_by?: "auto" | "user" | "user_1tap" | "user_2tap" | "btn" | "btn_confirm" | "btn_add_account";
    clientId?: string;
    [key: string]: any;
}
interface GoogleTokenResponse {
    access_token?: string;
    id_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    [key: string]: any;
}
interface GoogleIdentityClaims {
    sub: string;
    email: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
    hd?: string;
    [key: string]: any;
}
interface IITDHNodeAuthConfig {
    clientId?: string;
    allowedAudiences?: string[];
    allowedDomain?: string;
    jwtSecret?: string;
    sessionMinutes?: number;
    cookieName?: string;
    secureCookie?: boolean;
    sameSiteCookie?: "lax" | "strict" | "none" | boolean;
    slidingSession?: boolean;
    defaultRole?: string;
    resolveUser?: (identity: {
        provider: string;
        subject: string;
        email: string;
        name: string;
        claims: GoogleIdentityClaims;
    }) => Promise<IITDHUser | null>;
    enrichUser?: (user: IITDHUser) => Promise<IITDHUser>;
    onAudit?: (req: any, auditData: {
        provider: string;
        email?: string;
        userId?: string | number;
        result: "ok" | "denied" | "error";
        reason?: string;
    }) => Promise<void> | void;
}

export type { GoogleCredentialResponse as G, IITDHUser as I, GoogleIdentityClaims as a, GoogleTokenResponse as b, IITDHAuthState as c, IITDHClientConfig as d, IITDHEmployeeMetadata as e, IITDHNodeAuthConfig as f, IITDHUserRole as g };
