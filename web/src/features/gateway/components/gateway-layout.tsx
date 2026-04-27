import { Key, Server, ShieldCheck, Terminal, Ticket, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { Breadcrumbs } from '@/shared/components/breadcrumbs'
import { LanguageToggle } from '@/shared/components/language-toggle'
import { ModeToggle } from '@/shared/components/mode-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from '@/shared/components/ui/sidebar'
import { UserMenu } from '@/shared/components/user-menu'
import { useAuthInit } from '@/shared/hooks/use-auth-init'

function isNavActive(pathname: string, to: string, end: boolean): boolean {
  if (end)
    return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

const ACTIVE_NAV_CLASS = 'data-active:bg-primary/10 data-active:text-primary data-active:font-semibold [&[data-active=true]_svg]:text-primary'

const accountItems = [
  { to: '/ui/profile', key: 'gateway:nav.profile', icon: User, end: true },
  { to: '/ui/profile/api-tokens', key: 'gateway:pages.apiTokens', icon: Key, end: false },
  { to: '/ui/profile/tickets', key: 'gateway:pages.tickets', icon: Ticket, end: false },
]

export function GatewayLayout() {
  const { t } = useTranslation(['gateway', 'common'])
  const location = useLocation()

  useAuthInit()

  return (
    <SidebarProvider>
      <Sidebar collapsible="none">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link to="/ui" className="gap-3" />}>
                <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold tracking-tight">{t('common:appName')}</span>
                  <span className="text-xs text-sidebar-foreground/60">Gateway</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('gateway:nav.targets')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link to="/ui" />}
                    isActive={location.pathname === '/ui'}
                    tooltip={t('gateway:nav.targets')}
                    className={ACTIVE_NAV_CLASS}
                  >
                    <Server />
                    <span>{t('gateway:nav.allTargets')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>{t('gateway:nav.terminals')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link to="/ui/client" />}
                    tooltip={t('gateway:nav.terminals')}
                    className={ACTIVE_NAV_CLASS}
                  >
                    <Terminal />
                    <span>{t('gateway:nav.terminals')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>{t('gateway:nav.profile')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {accountItems.map(item => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={isNavActive(location.pathname, item.to, item.end)}
                      tooltip={t(item.key)}
                      className={ACTIVE_NAV_CLASS}
                    >
                      <item.icon />
                      <span>{t(item.key)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu variant="sidebar" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-1">
            <LanguageToggle />
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
