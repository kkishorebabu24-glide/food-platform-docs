// Canonical roles are resident / partner / admin / super_admin.
// Legacy buyer / seller values are still accepted from older tokens and clients.
const ROLE_ALIASES = { buyer: 'resident', seller: 'partner' };

export const normalizeRole = (role) => ROLE_ALIASES[role] || role || 'resident';

export const isPartnerRole = (role) => normalizeRole(role) === 'partner';

export const isAdminRole = (role) => ['admin', 'super_admin'].includes(normalizeRole(role));

/** True when `role` satisfies one of `allowedRoles` (super_admin inherits admin). */
export const hasAllowedRole = (role, allowedRoles) => {
  const userRole = normalizeRole(role);
  const allowed = new Set(allowedRoles.map(normalizeRole));
  if (allowed.has('admin')) allowed.add('super_admin');
  return allowed.has(userRole);
};

export const homePathForRole = (role) => {
  if (isAdminRole(role)) return '/admin';
  if (isPartnerRole(role)) return '/partner';
  return '/buyer';
};
