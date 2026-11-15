import {
  Bot,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  MapPin,
  Satellite,
  Settings,
  SlidersHorizontal,
  Sprout,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import type { NavSection } from '../../types/rotatewise';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  farmCount: number;
  comparedCount: number;
}

interface NavItemDef {
  id: NavSection;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
}

const NAV_GROUPS: Array<{ group: string; items: NavItemDef[] }> = [
  {
    group: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
      { id: 'farms', label: 'My Farms', shortLabel: 'Farms', icon: MapPin },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { id: 'climate', label: 'Climate Insights', shortLabel: 'Climate', icon: CloudSun },
      { id: 'crops', label: 'Crop Intelligence', shortLabel: 'Crops', icon: Sprout },
      { id: 'comparison', label: 'Crop Comparison', shortLabel: 'Compare', icon: GitCompareArrows },
    ],
  },
  {
    group: 'Planning',
    items: [
      { id: 'planner', label: 'Rotation Planner', shortLabel: 'Planner', icon: CalendarRange },
      { id: 'simulator', label: 'Scenario Simulator', shortLabel: 'Simulator', icon: SlidersHorizontal },
      { id: 'advisor', label: 'AI Farm Advisor', shortLabel: 'Advisor', icon: Bot },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'reports', label: 'Reports', shortLabel: 'Reports', icon: FileText },
      { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
    ],
  },
];

const FLAT_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const MOBILE_BAR_ITEMS: NavSection[] = [
  'dashboard',
  'climate',
  'crops',
  'planner',
  'simulator',
];

export function Sidebar({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
  farmCount,
  comparedCount,
}: SidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileOpen, onCloseMobile]);

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const renderNavContent = (isMobileDrawer: boolean) => {
    const isCollapsed = !isMobileDrawer && collapsed;
    return (
      <div className="flex h-full flex-col bg-white text-[#18231E]">
        <div
          className={`flex h-16 shrink-0 items-center border-b border-[#E7EBE7] ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            title="RotateWise Overview"
            className="flex items-center gap-2.5 text-left"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#174C3C] text-white shadow-[0_1px_2px_rgba(20,37,29,0.12)]">
              <Sprout className="h-4 w-4" aria-hidden="true" />
            </span>
            {!isCollapsed && (
              <span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#18231E] whitespace-nowrap">
                RotateWise
              </span>
            )}
          </button>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[#737D76] transition-colors hover:bg-[#F7F8F6] hover:text-[#18231E] lg:hidden"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            !isCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="hidden h-8 w-8 items-center justify-center rounded-xl text-[#737D76] transition-colors hover:bg-[#F7F8F6] hover:text-[#18231E] lg:flex"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )
          )}
        </div>

        {isCollapsed && !isMobileDrawer && (
          <div className="hidden justify-center border-b border-[#E7EBE7] py-2 lg:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[#737D76] transition-colors hover:bg-[#F7F8F6] hover:text-[#18231E]"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <nav
          aria-label="Primary Navigation"
          className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.group} className="space-y-0.5">
              {!isCollapsed && (
                <p className="px-2.5 pb-1 text-[11px] font-medium text-[#737D76]">
                  {group.group}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                const badgeValue =
                  item.id === 'farms'
                    ? farmCount
                    : item.id === 'comparison' && comparedCount > 0
                      ? comparedCount
                      : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex min-h-[40px] w-full items-center rounded-xl transition-colors duration-150 ${
                      isCollapsed ? 'justify-center px-2' : 'justify-between px-2.5'
                    } ${
                      active
                        ? 'bg-[#EAF2EC]/80 text-[#174C3C] font-semibold'
                        : 'text-[#445149] hover:bg-[#F7F8F6] hover:text-[#18231E] font-medium'
                    } text-[13.5px]`}
                  >
                    {active && !isCollapsed && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#174C3C]"
                      />
                    )}
                    <span className="flex items-center gap-3 whitespace-nowrap">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active
                            ? 'text-[#174C3C]'
                            : 'text-[#737D76] group-hover:text-[#18231E]'
                        }`}
                        aria-hidden="true"
                      />
                      {!isCollapsed && <span>{item.label}</span>}
                    </span>
                    {!isCollapsed && badgeValue !== null && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          active ? 'font-semibold text-[#174C3C]' : 'text-[#737D76]'
                        }`}
                      >
                        {badgeValue}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-[#E7EBE7] px-4 py-3.5">
          {isCollapsed ? (
            <div className="flex justify-center py-0.5" title="NASA POWER AG Telemetry">
              <Satellite className="h-4 w-4 text-[#287A5A]" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-[11px] leading-relaxed text-[#737D76]">
              <Satellite
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#287A5A]"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-[#18231E]">NASA POWER AG</p>
                <p className="text-[11px] text-[#737D76]">
                  Deterministic agronomy workspace
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-[#E7EBE7] bg-white transition-[width] duration-150 lg:block ${
          collapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        {renderNavContent(false)}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            className="fixed inset-0 bg-[#14251D]/40 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full w-72 max-w-[85vw] border-r border-[#E7EBE7] bg-white shadow-2xl">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Samsung One UI bottom bar: compact ergonomic thumb targets */}
      <nav
        aria-label="Quick Mobile Navigation"
        className="fixed right-0 bottom-0 left-0 z-30 flex h-[54px] items-center justify-around border-t border-[#E7EBE7] bg-white/95 px-1 backdrop-blur-md lg:hidden"
      >
        {MOBILE_BAR_ITEMS.map((id) => {
          const item = FLAT_NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[44px] min-w-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium transition-colors ${
                active
                  ? 'text-[#174C3C] font-semibold'
                  : 'text-[#737D76] hover:text-[#18231E]'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  active ? 'text-[#174C3C]' : 'text-[#737D76]'
                }`}
                aria-hidden="true"
              />
              <span className="truncate max-w-full">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
