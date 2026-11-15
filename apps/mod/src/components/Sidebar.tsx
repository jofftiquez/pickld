'use client';

import {
  ChartColumn,
  CircleHelp,
  Flag,
  Inbox,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  type LucideIcon,
  Network,
  Scale,
  ScrollText,
  Sticker,
  Ticket,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { Mark } from './Mark';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from '~/components/ui/breadcrumb';
import { Separator } from '~/components/ui/separator';
import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from '~/components/ui/sidebar';
import { t } from '~/i18n/t';

const icons = {
  overview: LayoutDashboard,
  queue: Inbox,
  reports: Flag,
  appeals: Scale,
  users: Users,
  invites: Ticket,
  network: Network,
  stickers: Sticker,
  waitlist: ListOrdered,
  analytics: ChartColumn,
  audit: ScrollText,
  help: CircleHelp,
} satisfies Record<string, LucideIcon>;

export interface NavItem {
  href: string;
  label: string;
  /** An icon name (the layout is a server component, so it can't pass the icon itself). */
  icon?: keyof typeof icons;
  count?: number;
  /** Pages nested under this item; the item itself is then a heading, not a link. */
  children?: NavItem[];
}

/** Which nav link is the current page. Reports and Appeals are queue filters, so Queue lights up only for the others. */
function useActive(items: NavItem[]) {
  const path = usePathname();
  const params = useSearchParams();
  const filter = params.get('filter');
  const here = filter && filter !== 'all' ? `${path}?filter=${filter}` : path;
  return (item: NavItem) =>
    item.href === '/'
      ? path === '/'
      : item.href.includes('?')
        ? here === item.href
        : item.href === '/queue'
          ? path === '/queue' && !items.some((other) => other.href.includes('?') && other.href === here)
          : path.startsWith(item.href);
}

// The design's rail: brand green under the current page with ink text, 44 px rows.
const row =
  'h-11 text-[15px] font-semibold text-sidebar-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:font-extrabold data-[active=true]:text-sidebar-primary-foreground';

/**
 * The dark left rail (design: ModConsole), built on shadcn/ui's Sidebar: name, sections with their open counts,
 * and who is signed in. It stays fixed while pages scroll, hides with the header's button (or Ctrl/⌘ B), and
 * becomes a sheet on narrow screens.
 */
export function Sidebar({ items, name }: { items: NavItem[]; name: string }) {
  const params = useSearchParams();
  const path = usePathname();
  const isActive = useActive(items);
  // Analytics' window (?days=) carries over between its pages.
  const days = path.startsWith('/analytics') ? params.get('days') : null;
  return (
    <ShadSidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 pt-6 pb-4">
        <p className="m-0 flex items-center gap-2.5 text-[17px] font-extrabold">
          <Mark />
          {t('site.name')}
        </p>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t('nav.label')}>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {items.map((item) => {
                  const Icon = item.icon ? icons[item.icon] : null;
                  if (item.children) {
                    return (
                      <SidebarMenuItem key={item.href} role="group" aria-labelledby={`nav-${item.href}`}>
                        <SidebarGroupLabel
                          id={`nav-${item.href}`}
                          className="h-11 gap-2 px-2 text-[15px] font-semibold text-sidebar-foreground"
                        >
                          {Icon ? <Icon aria-hidden /> : null}
                          {item.label}
                        </SidebarGroupLabel>
                        <SidebarMenuSub className="mr-0 border-sidebar-border pr-0">
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={path.startsWith(child.href)}
                                className="h-10 text-sm font-semibold text-sidebar-muted data-[active=true]:bg-sidebar-primary data-[active=true]:font-extrabold data-[active=true]:text-sidebar-primary-foreground"
                              >
                                <Link
                                  href={days ? `${child.href}?days=${days}` : child.href}
                                  aria-current={path.startsWith(child.href) ? 'page' : undefined}
                                >
                                  {child.label}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </SidebarMenuItem>
                    );
                  }
                  const active = isActive(item);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} className={row}>
                        <Link href={item.href} aria-current={active ? 'page' : undefined}>
                          {Icon ? <Icon aria-hidden /> : null}
                          <span>{item.label}</span>
                          {item.count !== undefined ? (
                            <SidebarMenuBadge
                              aria-label={t('nav.count', { count: item.count })}
                              className={
                                active
                                  ? 'top-3 bg-sidebar text-sidebar-foreground'
                                  : 'top-3 rounded-full bg-sidebar-accent text-sidebar-foreground'
                              }
                            >
                              {item.count}
                            </SidebarMenuBadge>
                          ) : null}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter className="px-4 pb-5">
        <p className="m-0 text-sm font-bold">{t('nav.role', { name })}</p>
        <form action="/sign-out" method="post">
          <button
            type="submit"
            className="-ml-1 flex min-h-11 items-center gap-2 rounded-md px-1 text-[13px] text-sidebar-muted hover:text-sidebar-foreground"
          >
            <LogOut aria-hidden className="size-4" />
            {t('nav.signOut')}
          </button>
        </form>
      </SidebarFooter>
    </ShadSidebar>
  );
}

/** The bar above every page: the button that hides the rail, and where you are. It stays at the top while pages scroll. */
export function ConsoleHeader({ items }: { items: NavItem[] }) {
  const isActive = useActive(items);
  const path = usePathname();
  const flat: (NavItem & { parent?: NavItem })[] = items.flatMap((item) =>
    item.children ? item.children.map((child) => ({ ...child, parent: item })) : [item],
  );
  const current = flat.find((item) => (item.parent ? path.startsWith(item.href) : isActive(item)));
  const parent = current?.parent;
  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1 size-11" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-5" />
      {current ? (
        <Breadcrumb>
          <BreadcrumbList>
            {parent ? (
              <>
                <BreadcrumbItem>{parent.label}</BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : null}
            <BreadcrumbItem>
              <span className="font-bold text-foreground">{current.label}</span>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
    </header>
  );
}
