// Single source of truth for the primary navigation, page titles, and breadcrumbs.
export const NAV_GROUPS = [
  {
    label: "Monitor",
    items: [{ href: "/dashboard", label: "Overview", icon: "overview" }],
  },
  {
    label: "Scans",
    items: [
      { href: "/url-scan", label: "URL Scan", icon: "globe" },
      { href: "/source-scan", label: "Source Code Scan", icon: "code" },
      { href: "/scans", label: "Scan History", icon: "history" },
    ],
  },
  {
    label: "Results",
    items: [
      { href: "/findings", label: "Findings", icon: "bug" },
      { href: "/reports", label: "Reports", icon: "report" },
    ],
  },
  {
    label: "Workspace",
    items: [{ href: "/settings", label: "Settings", icon: "settings" }],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

// Pages below a navigation item, keyed by a pattern on the full path.
const SUBPAGES = [{ pattern: /^\/scans\/[^/]+$/, label: "Scan details" }];

export function isActivePath(pathname, href) {
  return pathname === href || pathname?.startsWith(`${href}/`);
}

export function getPageTitle(pathname) {
  return NAV_ITEMS.find(({ href }) => isActivePath(pathname, href))?.label ?? "AppCheck";
}

/** [{ label, href? }] from the section down to the current page; the last item has no href. */
export function getBreadcrumbs(pathname) {
  const section = NAV_ITEMS.find(({ href }) => isActivePath(pathname, href));
  if (!section) return [{ label: "AppCheck" }];
  const subpage = SUBPAGES.find(({ pattern }) => pattern.test(pathname ?? ""));
  return subpage ? [{ label: section.label, href: section.href }, { label: subpage.label }] : [{ label: section.label }];
}
