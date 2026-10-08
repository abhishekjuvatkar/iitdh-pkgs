import { IITDHUser, IITDHUserRole } from "./types.js";

/**
 * Validates whether an email belongs to the allowed IIT Dharwad domain.
 */
export function validateDomain(
  email: string | undefined | null,
  allowedDomain: string = "iitdh.ac.in",
  hd?: string
): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  const cleanDomain = allowedDomain.toLowerCase().trim();

  if (cleanEmail.endsWith(`@${cleanDomain}`)) {
    return true;
  }

  if (hd && hd.toLowerCase().trim() === cleanDomain) {
    return true;
  }

  return false;
}

/**
 * Normalizes user and employee metadata for seamless interop across components.
 */
export function normalizeUser(user: Partial<IITDHUser> | null | undefined): IITDHUser | null {
  if (!user || !user.email) return null;

  const email = user.email.toLowerCase().trim();
  const name = user.name || user.employeeName || email.split("@")[0];
  const role = user.role || "USER";

  const rawRoles = user.roles || (user.employee && user.employee.roles) || [{ roleName: role, roleId: 0 }];
  const roles: IITDHUserRole[] = Array.isArray(rawRoles)
    ? rawRoles.map((r: any) => (typeof r === "string" ? { roleName: r } : r))
    : [{ roleName: String(rawRoles) }];

  const employee = user.employee || {
    EmployeeId: user.employeeId || user.id || "1",
    UserName: user.username || email.split("@")[0],
    EmployeeName: name,
    EmployeeDesignationName: user.designation || role,
    DepartmentName: user.department || user.departmentName || "General Section",
    OfficialMailID: email,
    roles,
  };

  return {
    ...user,
    id: user.id || user.uid || 1,
    email,
    name,
    role,
    roles,
    employeeId: employee.EmployeeId || user.employeeId || "1",
    username: employee.UserName || user.username || email.split("@")[0],
    designation: employee.EmployeeDesignationName || user.designation || role,
    department: employee.DepartmentName || user.department || "General Section",
    departmentName: employee.DepartmentName || user.departmentName || "General Section",
    employee,
    isActive: user.isActive !== false,
  };
}

/**
 * Checks whether the user satisfies at least one required role.
 */
export function checkRoleAccess(
  user: IITDHUser | null | undefined,
  allowedRoles?: string[] | null
): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!user) return false;

  const userRole = String(user.role || "").trim().toUpperCase();
  const userRolesList = (user.roles || []).map((r: any) =>
    String(r?.roleName || r?.role_name || r || "").trim().toUpperCase()
  );

  return allowedRoles.some((targetRole) => {
    const target = String(targetRole || "").trim().toUpperCase();
    if (!target) return false;

    if (userRole === target || userRole.includes(target) || target.includes(userRole)) {
      return true;
    }

    return userRolesList.some(
      (ur) => ur === target || ur.includes(target) || target.includes(ur)
    );
  });
}
