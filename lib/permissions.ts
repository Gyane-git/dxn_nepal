/// Single source of truth for the admin-panel permission catalog: seeded into the `Permission`
/// table (prisma/seed.ts) and rendered as the checkbox matrix in the Roles UI. Keys follow
/// "<module>.<action>" and mirror the actual app/api/admin/** modules.
export interface PermissionDef {
  key: string;
  module: string;
  action: string;
  label: string;
}

interface ModuleDef {
  module: string;
  moduleLabel: string;
  actions: { action: string; label: string }[];
}

const MODULES: ModuleDef[] = [
  { module: "dashboard", moduleLabel: "Dashboard", actions: [{ action: "view", label: "View Dashboard" }] },
  {
    module: "users",
    moduleLabel: "Users",
    actions: [
      { action: "view", label: "View Users" },
      { action: "create", label: "Create User" },
      { action: "edit", label: "Edit User" },
      { action: "delete", label: "Disable/Enable User" },
    ],
  },
  {
    module: "roles",
    moduleLabel: "Roles & Permissions",
    actions: [
      { action: "view", label: "View Roles" },
      { action: "create", label: "Create Role" },
      { action: "edit", label: "Edit Role" },
      { action: "delete", label: "Delete Role" },
      { action: "manage_permissions", label: "Manage Role Permissions" },
    ],
  },
  {
    module: "categories",
    moduleLabel: "Categories",
    actions: [
      { action: "view", label: "View Categories" },
      { action: "create", label: "Create Category" },
      { action: "edit", label: "Edit Category" },
      { action: "delete", label: "Delete Category" },
    ],
  },
  {
    module: "brands",
    moduleLabel: "Brands",
    actions: [
      { action: "view", label: "View Brands" },
      { action: "create", label: "Create Brand" },
      { action: "edit", label: "Edit Brand" },
      { action: "delete", label: "Delete Brand" },
    ],
  },
  {
    module: "attributes",
    moduleLabel: "Attributes",
    actions: [
      { action: "view", label: "View Attributes" },
      { action: "create", label: "Create Attribute" },
      { action: "edit", label: "Edit Attribute" },
      { action: "delete", label: "Delete Attribute" },
    ],
  },
  {
    module: "products",
    moduleLabel: "Products",
    actions: [
      { action: "view", label: "View Products" },
      { action: "create", label: "Create Product" },
      { action: "edit", label: "Edit Product" },
      { action: "delete", label: "Delete Product" },
      { action: "export", label: "Export Products" },
    ],
  },
  {
    module: "orders",
    moduleLabel: "Orders",
    actions: [
      { action: "view", label: "View Orders" },
      { action: "edit", label: "Edit/Update Order" },
      { action: "cancel", label: "Cancel Order" },
      { action: "export", label: "Export Orders" },
    ],
  },
  {
    module: "coupons",
    moduleLabel: "Coupons",
    actions: [
      { action: "view", label: "View Coupons" },
      { action: "create", label: "Create Coupon" },
      { action: "edit", label: "Edit Coupon" },
      { action: "delete", label: "Delete Coupon" },
    ],
  },
  {
    module: "banners",
    moduleLabel: "Home Banners",
    actions: [
      { action: "view", label: "View Banners" },
      { action: "create", label: "Create Banner" },
      { action: "edit", label: "Edit Banner" },
      { action: "delete", label: "Delete Banner" },
    ],
  },
  {
    module: "reviews",
    moduleLabel: "Reviews",
    actions: [
      { action: "view", label: "View Reviews" },
      { action: "approve", label: "Approve/Reject Review" },
      { action: "delete", label: "Delete Review" },
    ],
  },
  {
    module: "distributors",
    moduleLabel: "Distributors",
    actions: [
      { action: "view", label: "View Distributors & Applications" },
      { action: "approve", label: "Approve Distributor Application" },
      { action: "reject", label: "Reject Distributor Application" },
    ],
  },
  {
    module: "dealers",
    moduleLabel: "Dealers",
    actions: [
      { action: "view", label: "View Dealers" },
      { action: "create", label: "Create Dealer" },
      { action: "edit", label: "Edit Dealer" },
      { action: "delete", label: "Delete Dealer" },
    ],
  },
  {
    module: "settings",
    moduleLabel: "Settings",
    actions: [
      { action: "view", label: "View Settings" },
      { action: "manage", label: "Manage Settings" },
    ],
  },
  {
    module: "dealer_inventory",
    moduleLabel: "Dealer Inventory (Dealer Portal)",
    actions: [
      { action: "view", label: "View My Assigned Products & Stock" },
      { action: "update", label: "Update My Stock Quantities" },
    ],
  },
];

export const PERMISSIONS: PermissionDef[] = MODULES.flatMap((m) =>
  m.actions.map((a) => ({
    key: `${m.module}.${a.action}`,
    module: m.module,
    action: a.action,
    label: a.label,
  })),
);

export const PERMISSION_MODULES: { module: string; label: string; permissions: PermissionDef[] }[] = MODULES.map((m) => ({
  module: m.module,
  label: m.moduleLabel,
  permissions: m.actions.map((a) => ({ key: `${m.module}.${a.action}`, module: m.module, action: a.action, label: a.label })),
}));

export const ALL_PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

/**
 * Permission keys relevant to the storefront Dealer portal (account/dealer-*). Used both to seed
 * the default "Dealer Portal Access" role and as the "unrestricted" fallback returned to a dealer
 * whose Dealer.adminRoleId is null — deliberately a subset of ALL_PERMISSION_KEYS, since an
 * unrestricted dealer should never be shown admin-only keys like `roles.delete`.
 */
export const DEALER_PORTAL_PERMISSION_KEYS: string[] = ["dashboard.view", "products.view", "dealer_inventory.view", "dealer_inventory.update", "orders.view", "orders.edit"];
