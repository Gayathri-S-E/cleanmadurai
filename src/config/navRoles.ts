import type { UserRole } from '../types';

/**
 * Role-based access: single source of truth for who can see which nav items and routes.
 * Order matters: items appear in sidebar in the order defined here.
 */

/** Roles that can access the full Admin Panel (/admin) */
export const ADMIN_PANEL_ROLES: UserRole[] = ['corp_admin', 'system_admin', 'super_admin'];

/** Only super_admin sees System Mgmt + Settings */
export const SUPER_ADMIN_ROLES: UserRole[] = ['super_admin'];

/** Roles that can access the Officer Dashboard (/dashboard) but NOT Admin Panel */
export const OFFICER_DASHBOARD_ROLES: UserRole[] = [
  'corp_officer',
  'zonal_officer',
  'ward_officer',
  'sanitation_worker',
];

/** Roles that can see AI Predictions tab in officer dashboard */
export const PREDICTIONS_ROLES: UserRole[] = ['corp_officer', 'zonal_officer', 'ward_officer', 'corp_admin', 'system_admin', 'super_admin'];

/** Roles that can see Worker Welfare tab (corp officer level and above) */
export const WORKER_WELFARE_ROLES: UserRole[] = ['corp_officer', 'corp_admin', 'system_admin', 'super_admin'];

/** Waste Exchange roles */
export const WASTE_EXCHANGE_ROLES: UserRole[] = [
  'shop_owner',
  'hotel_owner',
  'market_vendor',
  'farmer',
  'animal_shelter',
  'recycler',
];

/** All roles that can access some form of dashboard (officer or admin) */
export const DASHBOARD_ACCESS_ROLES: UserRole[] = [
  ...ADMIN_PANEL_ROLES,
  ...OFFICER_DASHBOARD_ROLES,
];

/**
 * Citizen/public roles: can browse reports, map, leaderboard, adopt-a-block.
 * Admins and officers do NOT need these citizen-facing pages.
 */
const CITIZEN_ROLES: UserRole[] = [
  'citizen',
  'volunteer',
  'college_admin',
  ...WASTE_EXCHANGE_ROLES,
];

export type NavIconId =
  | 'home'
  | 'report'
  | 'map'
  | 'exchange'
  | 'adopt'
  | 'leaderboard'
  | 'mirror'
  | 'my_reports'
  | 'dashboard'
  | 'admin'
  | 'admin_overview'
  | 'admin_governance'
  | 'admin_wcs'
  | 'admin_kpi'
  | 'admin_wards'
  | 'admin_roles'
  | 'admin_users'
  | 'admin_zones'
  | 'admin_reports'
  | 'admin_blocks'
  | 'admin_settings'
  | 'admin_system'
  | 'officer_dashboard'
  | 'officer_queue'
  | 'officer_predictions'
  | 'officer_workers'
  | 'officer_bins'
  | 'officer_route'
  | 'officer_nightwatch'
  | 'officer_broadcast'
  | 'officer_restrooms'
  | 'profile'
  | 'settings'
  | 'logout'
  | 'restrooms'
  | 'events'
  | 'badges'
  | 'request_bin';

export interface NavItemConfig {
  to: string;
  labelKey: string;
  iconId: NavIconId;
  /** If set, only these roles see this item. If undefined, all authenticated users see it. */
  roles?: UserRole[];
  /** exact match for NavLink active state */
  end?: boolean;
}

export interface NavSectionConfig {
  sectionKey: string;
  /** Label for the collapsible section header */
  label: string;
  items: NavItemConfig[];
  /** If set, the whole section is hidden unless user has at least one of these roles */
  roles?: UserRole[];
}

/**
 * Sidebar sections with collapsible groups.
 * Each section can be expanded / collapsed independently.
 */
export const SIDEBAR_NAV_SECTIONS: NavSectionConfig[] = [
  // ─── Officer Dashboard tabs (each as its own sidebar link) ──────────────
  {
    sectionKey: 'officer',
    label: 'My Dashboard',
    roles: OFFICER_DASHBOARD_ROLES,
    items: [
      // All officer roles see the queue
      { to: '/dashboard/queue', labelKey: 'nav.officer.queue', iconId: 'officer_queue', roles: OFFICER_DASHBOARD_ROLES },
      // Predictions: not for sanitation_worker
      { to: '/dashboard/predictions', labelKey: 'nav.officer.predictions', iconId: 'officer_predictions', roles: PREDICTIONS_ROLES },
      // Worker welfare: corp_officer and above only
      { to: '/dashboard/workers', labelKey: 'nav.officer.workers', iconId: 'officer_workers', roles: WORKER_WELFARE_ROLES },
      // Intelligence modules (officer level and above)
      { to: '/dashboard/bins', labelKey: 'nav.officer.bins', iconId: 'officer_bins', roles: PREDICTIONS_ROLES },
      { to: '/dashboard/route', labelKey: 'nav.officer.route', iconId: 'officer_route', roles: PREDICTIONS_ROLES },
      { to: '/dashboard/nightwatch', labelKey: 'nav.officer.nightwatch', iconId: 'officer_nightwatch', roles: PREDICTIONS_ROLES },
      { to: '/dashboard/broadcast', labelKey: 'nav.officer.broadcast', iconId: 'officer_broadcast', roles: OFFICER_DASHBOARD_ROLES },
      { to: '/restroom-management', labelKey: 'nav.officer.restrooms', iconId: 'officer_restrooms', roles: ['corp_admin', 'system_admin', 'super_admin', 'corp_officer', 'zonal_officer', 'ward_officer'] },
    ],
  },

  // ─── Admin Panel (all tabs as individual links) ───────────────────────────
  {
    sectionKey: 'admin',
    label: 'Admin Panel',
    roles: ADMIN_PANEL_ROLES,
    items: [
      { to: '/admin/overview', labelKey: 'nav.admin.overview', iconId: 'admin_overview', roles: ADMIN_PANEL_ROLES, end: true },
      { to: '/admin/governance', labelKey: 'nav.admin.governance', iconId: 'admin_governance', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/survekshan', labelKey: 'nav.admin.survekshan', iconId: 'admin_wcs', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/wcs', labelKey: 'nav.admin.wcs', iconId: 'admin_wcs', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/kpi', labelKey: 'nav.admin.kpi', iconId: 'admin_kpi', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/wards', labelKey: 'nav.admin.wards', iconId: 'admin_wards', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/reports', labelKey: 'nav.admin.reports', iconId: 'admin_reports', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/roles', labelKey: 'nav.admin.roles', iconId: 'admin_roles', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/users', labelKey: 'nav.admin.users', iconId: 'admin_users', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/zones', labelKey: 'nav.admin.zones', iconId: 'admin_zones', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/blocks', labelKey: 'nav.admin.blocks', iconId: 'admin_blocks', roles: ADMIN_PANEL_ROLES },
      { to: '/admin/settings', labelKey: 'nav.admin.settings', iconId: 'admin_settings', roles: SUPER_ADMIN_ROLES },
      { to: '/admin/system', labelKey: 'nav.admin.system', iconId: 'admin_system', roles: SUPER_ADMIN_ROLES },
    ],
  },

  // ─── Citizen / Community ─────────────────────────────────────────────────
  {
    sectionKey: 'community',
    label: 'Community',
    roles: CITIZEN_ROLES,
    items: [
      { to: '/home', labelKey: 'nav.home', iconId: 'home', roles: CITIZEN_ROLES },
      { to: '/report', labelKey: 'nav.report', iconId: 'report', roles: CITIZEN_ROLES },
      { to: '/map', labelKey: 'nav.map', iconId: 'map', roles: CITIZEN_ROLES },
      { to: '/restrooms', labelKey: 'nav.restrooms', iconId: 'restrooms', roles: CITIZEN_ROLES },
      { to: '/events', labelKey: 'nav.events', iconId: 'events', roles: CITIZEN_ROLES },
      { to: '/adopt', labelKey: 'nav.adopt', iconId: 'adopt', roles: CITIZEN_ROLES },
      { to: '/my-reports', labelKey: 'nav.my_reports', iconId: 'my_reports', roles: CITIZEN_ROLES },
      { to: '/leaderboard', labelKey: 'nav.leaderboard', iconId: 'leaderboard', roles: CITIZEN_ROLES },
      { to: '/badges', labelKey: 'nav.badges', iconId: 'badges', roles: CITIZEN_ROLES },
      { to: '/mirror', labelKey: 'nav.mirror', iconId: 'mirror', roles: CITIZEN_ROLES },
      { to: '/request-bin', labelKey: 'nav.request_bin', iconId: 'request_bin', roles: CITIZEN_ROLES },
    ],
  },

  // ─── Business / Exchange ─────────────────────────────────────────────────
  {
    sectionKey: 'business',
    label: 'Business',
    roles: WASTE_EXCHANGE_ROLES,
    items: [
      { to: '/exchange', labelKey: 'nav.exchange', iconId: 'exchange', roles: WASTE_EXCHANGE_ROLES },
    ],
  },
];

/**
 * Flat list — used for backwards-compatible helpers.
 */
export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = SIDEBAR_NAV_SECTIONS.flatMap((s) => s.items);

/**
 * Returns nav items visible for the given user roles.
 */
export function getVisibleNavItems(userRoles: UserRole[]): NavItemConfig[] {
  return SIDEBAR_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => userRoles.includes(r));
  });
}

/**
 * Returns sections (with their items) visible for the given user roles.
 * Sections with no visible items are excluded.
 */
export function getVisibleNavSections(userRoles: UserRole[]): NavSectionConfig[] {
  return SIDEBAR_NAV_SECTIONS
    .filter((section) => {
      if (!section.roles) return true;
      return section.roles.some((r) => userRoles.includes(r));
    })
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles) return true;
        return item.roles.some((r) => userRoles.includes(r));
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function canAccessAdminPanel(roles: UserRole[]): boolean {
  return ADMIN_PANEL_ROLES.some((r) => roles.includes(r));
}

export function canAccessOfficerDashboard(roles: UserRole[]): boolean {
  return OFFICER_DASHBOARD_ROLES.some((r) => roles.includes(r));
}

export function canAccessWasteExchange(roles: UserRole[]): boolean {
  return WASTE_EXCHANGE_ROLES.some((r) => roles.includes(r));
}

export function canAccessSuperAdminOnly(roles: UserRole[]): boolean {
  return SUPER_ADMIN_ROLES.some((r) => roles.includes(r));
}
