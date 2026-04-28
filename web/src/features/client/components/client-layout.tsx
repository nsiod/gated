import type { TargetKind, TargetSnapshot } from '@/features/gateway/lib/api-client'
import { ArrowLeft, Boxes, ChevronDown, ChevronRight, Database, FolderOpen, Monitor, PanelLeftClose, PanelLeftOpen, Plus, Search, Server, Terminal, TerminalSquare, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useTargetsQuery } from '@/features/gateway/api'
import { DatabaseConsole } from '@/shared/components/database-console'
import { Button } from '@/shared/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Input } from '@/shared/components/ui/input'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from '@/shared/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { useAuthInit } from '@/shared/hooks/use-auth-init'
import { TerminalPanel } from '../pages/terminal-panel'

const OPENABLE_KINDS: readonly TargetKind[] = ['Ssh', 'MySql', 'Postgres', 'Kubernetes']

type TabMode = 'cli' | 'gui'

interface WorkspaceTab {
  id: string
  targetName: string
  kind: TargetKind
  mode: TabMode
}

let tabCounter = 0

function kindIcon(kind: TargetKind) {
  switch (kind) {
    case 'MySql':
    case 'Postgres':
      return Database
    case 'Ssh':
      return TerminalSquare
    case 'Kubernetes':
      return Boxes
    case 'WebAdmin':
    case 'Api':
      return Server
  }
}

function kindIconColor(kind: TargetKind): string {
  switch (kind) {
    case 'MySql':
      return 'text-tone-orange-fg'
    case 'Postgres':
      return 'text-tone-indigo-fg'
    case 'Ssh':
      return 'text-tone-blue-fg'
    case 'Kubernetes':
      return 'text-tone-green-fg'
    case 'WebAdmin':
    case 'Api':
      return 'text-muted-foreground'
  }
}

function SidebarToggle() {
  const { toggleSidebar, open } = useSidebar()
  return (
    <Tooltip>
      <TooltipTrigger render={(
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          aria-expanded={open}
        />
      )}
      >
        {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
      </TooltipTrigger>
      <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
    </Tooltip>
  )
}

function groupTargets(targets: TargetSnapshot[]): { name: string, items: TargetSnapshot[] }[] {
  const connectable = targets.filter(t => OPENABLE_KINDS.includes(t.kind))
  const groups = new Map<string, TargetSnapshot[]>()
  for (const target of connectable) {
    const groupName = target.group?.name ?? 'Ungrouped'
    const existing = groups.get(groupName)
    if (existing == null)
      groups.set(groupName, [target])
    else
      existing.push(target)
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({
      name,
      items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

interface TabPaneProps {
  tab: WorkspaceTab
  isActive: boolean
}

function TabPane({ tab, isActive }: TabPaneProps) {
  if (tab.kind === 'MySql') {
    return tab.mode === 'cli'
      ? <TerminalPanel kind="mysql" targetName={tab.targetName} tabId={tab.id} isActive={isActive} />
      : <DatabaseConsole kind="mysql" targetName={tab.targetName} />
  }
  if (tab.kind === 'Postgres') {
    return tab.mode === 'cli'
      ? <TerminalPanel kind="postgres" targetName={tab.targetName} tabId={tab.id} isActive={isActive} />
      : <DatabaseConsole kind="postgres" targetName={tab.targetName} />
  }
  return <TerminalPanel targetName={tab.targetName} tabId={tab.id} isActive={isActive} />
}

export function ClientLayout() {
  const { t } = useTranslation(['gateway', 'common'])
  const { data: targets = [] } = useTargetsQuery()
  const [tabs, setTabs] = useState<WorkspaceTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  useAuthInit()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q === '')
      return targets
    return targets.filter(t => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q))
  }, [targets, search])
  const grouped = useMemo(() => groupTargets(filtered), [filtered])

  const defaultModeFor = (_kind: TargetKind): TabMode => 'cli'

  const openOrFocus = useCallback((target: TargetSnapshot, mode?: TabMode) => {
    const resolvedMode = mode ?? defaultModeFor(target.kind)
    setTabs((prev) => {
      const existing = prev.find(
        x => x.targetName === target.name && x.kind === target.kind && x.mode === resolvedMode,
      )
      if (existing != null) {
        setActiveTabId(existing.id)
        return prev
      }
      tabCounter += 1
      const id = `tab-${tabCounter}`
      setActiveTabId(id)
      return [...prev, { id, targetName: target.name, kind: target.kind, mode: resolvedMode }]
    })
  }, [])

  const forceNewTab = useCallback((target: TargetSnapshot, mode?: TabMode) => {
    const resolvedMode = mode ?? defaultModeFor(target.kind)
    tabCounter += 1
    const id = `tab-${tabCounter}`
    setTabs(prev => [...prev, { id, targetName: target.name, kind: target.kind, mode: resolvedMode }])
    setActiveTabId(id)
  }, [])

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter(x => x.id !== tabId)
      if (activeTabId === tabId)
        setActiveTabId(next.length > 0 ? next.at(-1)!.id : null)
      return next
    })
  }, [activeTabId])

  const toggleGroup = (name: string) => {
    setCollapsedGroups(prev => ({ ...prev, [name]: !(prev[name] ?? false) }))
  }

  const allConnectable = grouped.flatMap(g => g.items)
  const rowKey = (target: TargetSnapshot) => `${target.kind}:${target.name}`

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon" className="border-r border-border">
          <SidebarHeader className="h-10 flex-row items-center px-3 border-b border-border gap-2">
            <Monitor className="size-4 text-sidebar-primary shrink-0" />
            <span className="text-sm font-semibold truncate group-data-[collapsible=icon]:hidden">{t('gateway:client.myAssets')}</span>
          </SidebarHeader>

          <div className="px-2 pt-2 group-data-[collapsible=icon]:hidden">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={t('gateway:client.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>

          <SidebarContent>
            {grouped.map(group => (
              <SidebarGroup key={group.name}>
                <button
                  type="button"
                  className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
                  onClick={() => toggleGroup(group.name)}
                >
                  {collapsedGroups[group.name]
                    ? <ChevronRight className="size-3" />
                    : <ChevronDown className="size-3" />}
                  <FolderOpen className="size-3.5" />
                  <span className="truncate">{group.name}</span>
                  <span className="ml-auto text-muted-foreground/60">{group.items.length}</span>
                </button>
                <SidebarGroupContent hidden={collapsedGroups[group.name] === true}>
                  <SidebarMenu>
                    {group.items.map((target) => {
                      const Icon = kindIcon(target.kind)
                      const iconColor = kindIconColor(target.kind)
                      const matchingTabs = tabs.filter(x => x.targetName === target.name && x.kind === target.kind)
                      const hasTab = matchingTabs.length > 0
                      const isActive = matchingTabs.some(tab => tab.id === activeTabId)
                      const isDb = target.kind === 'MySql' || target.kind === 'Postgres'
                      return (
                        <ContextMenu key={rowKey(target)}>
                          <SidebarMenuItem>
                            <ContextMenuTrigger
                              render={(
                                <SidebarMenuButton
                                  className="cursor-pointer"
                                  onClick={() => openOrFocus(target)}
                                  isActive={isActive}
                                  tooltip={target.name}
                                />
                              )}
                            >
                              <Icon className={`size-4 shrink-0 ${iconColor}`} />
                              <span className="truncate">{target.name}</span>
                              {hasTab && <span className="ml-auto size-1.5 rounded-full bg-tone-green-fg shrink-0 group-data-[collapsible=icon]:hidden" />}
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              {isDb
                                ? (
                                    <>
                                      <ContextMenuItem onClick={() => openOrFocus(target, 'gui')}>
                                        <Database className="size-4 mr-2" />
                                        {t('gateway:client.openSqlConsole')}
                                      </ContextMenuItem>
                                      <ContextMenuItem onClick={() => openOrFocus(target, 'cli')}>
                                        <Terminal className="size-4 mr-2" />
                                        {t('gateway:client.openCliTerminal')}
                                      </ContextMenuItem>
                                    </>
                                  )
                                : (
                                    <ContextMenuItem onClick={() => openOrFocus(target)}>
                                      <Terminal className="size-4 mr-2" />
                                      {t('gateway:client.connect')}
                                    </ContextMenuItem>
                                  )}
                              <ContextMenuItem onClick={() => forceNewTab(target)}>
                                <Plus className="size-4 mr-2" />
                                {t('gateway:client.newConnection')}
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </SidebarMenuItem>
                        </ContextMenu>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
            {allConnectable.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t('gateway:targetList.empty')}</div>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/ui" />} tooltip={t('gateway:client.backToHome')}>
                  <ArrowLeft className="size-4" />
                  <span>{t('gateway:client.backToHome')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col h-screen overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center h-10 shrink-0 border-b border-border bg-muted/30">
            <SidebarToggle />
            <div className="flex items-center flex-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = kindIcon(tab.kind)
                const iconColor = kindIconColor(tab.kind)
                const isDb = tab.kind === 'MySql' || tab.kind === 'Postgres'
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`flex items-center gap-1.5 h-10 px-3 text-sm border-r border-border shrink-0 transition-colors cursor-pointer ${
                      tab.id === activeTabId
                        ? 'bg-background text-foreground'
                        : 'text-muted-foreground hover:bg-background/50'
                    }`}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <Icon className={`size-3.5 shrink-0 ${iconColor}`} />
                    <span className="max-w-32 truncate">{tab.targetName}</span>
                    {isDb && (
                      <span className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground/70 shrink-0">
                        {tab.mode}
                      </span>
                    )}
                    <button
                      type="button"
                      className="ml-0.5 p-0.5 rounded hover:bg-muted-foreground/20 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.id)
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </button>
                )
              })}
            </div>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={(
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="size-10 shrink-0" />}
                    >
                      <Plus className="size-3.5" />
                    </DropdownMenuTrigger>
                  )}
                >
                  <Plus className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('gateway:client.newTab')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {allConnectable.map((target) => {
                  const Icon = kindIcon(target.kind)
                  const iconColor = kindIconColor(target.kind)
                  return (
                    <DropdownMenuItem key={`${target.kind}:${target.name}`} onClick={() => forceNewTab(target)}>
                      <Icon className={`size-4 mr-2 ${iconColor}`} />
                      {target.name}
                    </DropdownMenuItem>
                  )
                })}
                {allConnectable.length === 0 && (
                  <DropdownMenuItem disabled>
                    {t('gateway:targetList.empty')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tab panes */}
          <div className="flex-1 relative overflow-hidden bg-background">
            {tabs.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center space-y-3">
                  <Terminal className="size-12 mx-auto opacity-20" />
                  <p className="text-sm font-medium">{t('gateway:client.noTabs')}</p>
                  <p className="text-xs text-muted-foreground/60">{t('gateway:client.selectServer')}</p>
                </div>
              </div>
            )}
            {tabs.map(tab => (
              <div
                key={tab.id}
                className="absolute inset-0"
                style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
              >
                <TabPane tab={tab} isActive={tab.id === activeTabId} />
              </div>
            ))}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
