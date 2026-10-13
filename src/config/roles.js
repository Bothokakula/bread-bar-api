/**
 * Role-Based Access Control (RBAC) definitions.
 * Roles match Section 3 of the Task 1 document. Routes check PERMISSIONS,
 * not role names, so a role's abilities can change in one place.
 */
const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  KITCHEN: 'kitchen',
  DELIVERY: 'delivery',
  MANAGER: 'manager',
  OWNER: 'owner',
  ADMIN: 'admin',
});

const STAFF_ROLES = Object.freeze(['kitchen', 'delivery', 'manager', 'owner', 'admin']);

const MANAGER_PERMISSIONS = [
  'menu:read', 'menu:manage',
  'orders:read', 'orders:update_status',
  'deliveries:read', 'deliveries:assign', 'deliveries:update_status',
  'stock:manage', 'promotions:manage', 'delivery_areas:manage', 'reports:read',
  'staff:read', 'staff:invite', 'staff:deactivate',
];

const PERMISSIONS = Object.freeze({
  customer: ['menu:read', 'orders:create', 'orders:read_own', 'orders:cancel_own', 'reviews:create', 'loyalty:read_own', 'profile:manage_own'],
  kitchen: ['menu:read', 'orders:read', 'orders:update_status'],
  delivery: ['menu:read', 'deliveries:read_assigned', 'deliveries:update_status'],
  manager: MANAGER_PERMISSIONS,
  owner: [...MANAGER_PERMISSIONS, 'audit:read'],
  admin: ['staff:read', 'staff:invite', 'staff:deactivate', 'audit:read', 'config:manage', 'reports:read'],
});

/** Which staff roles each role may invite or deactivate. Nobody can manage the owner. */
const MANAGEABLE_ROLES = Object.freeze({
  manager: ['kitchen', 'delivery'],
  owner: ['kitchen', 'delivery', 'manager', 'admin'],
  admin: ['kitchen', 'delivery', 'manager'],
});

function hasPermission(role, permission) {
  return (PERMISSIONS[role] || []).includes(permission);
}

function canManageRole(actorRole, targetRole) {
  return (MANAGEABLE_ROLES[actorRole] || []).includes(targetRole);
}

module.exports = { ROLES, STAFF_ROLES, PERMISSIONS, MANAGEABLE_ROLES, hasPermission, canManageRole };
