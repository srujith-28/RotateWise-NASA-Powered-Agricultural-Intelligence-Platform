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

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
  { id: 'farms', label: 'My Farms', shortLabel: 'Farms', icon: MapPin },
  { id: 'climate', label: 'Climate Insights', shortLabel: 'Climate', icon: CloudSun },
  { id: 'crops', label: 'Crop Intelligence', shortLabel: 'Crops', icon: Sprout },
  { id: 'comparison', label: 'Crop Comparison', shortLabel: 'Compare', icon: GitCompareArrows },
  { id: 'planner', label: 'Rotation Planner', shortLabel: 'Planner', icon: CalendarRange },
  { id: 'simulator', label: 'Scenario Simulator', shortLabel: 'Simulator', icon: SlidersHorizontal },
  { id: 'advisor', label: 'AI Farm Advisor', shortLabel: 'Advisor', icon: Bot },
  { id: 'reports', label: 'Reports', shortLabel: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

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
      <div className="flex h-full flex-col bg-[#174C3C] text-[#EAF2EC]">
        <div
          className={`flex h-16 shrink-0 items-center border-b border-[#255E4C] ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            title="RotateWise Overview"
            className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#287A5A] text-white">
              <Sprout className="h-4 w-4" aria-hidden="true" />
            </span>
            {!isCollapsed && (
              <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
                RotateWise
              </span>
            )}
          </button>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[#CFE0D6] hover:bg-[#1F604C] hover:text-white lg:hidden"
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
                className="hidden h-8 w-8 items-center justify-center rounded-lg text-[#CFE0D6] hover:bg-[#1F604C] hover:text-white lg:flex"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )
          )}
        </div>

        {isCollapsed && !isMobileDrawer && (
          <div className="hidden justify-center border-b border-[#255E4C] py-2 lg:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#CFE0D6] hover:bg-[#1F604C] hover:text-white"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <nav
          aria-label="Primary Navigation"
          className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3"
        >
          {NAV_ITEMS.map((item) => {
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
                className={`flex min-h-[42px] w-full items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                } ${
                  active
                    ? 'bg-[#287A5A] text-white font-semibold'
                    : 'text-[#D4E4DA] hover:bg-[#1F604C] hover:text-white font-medium'
                } text-sm`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-white' : 'text-[#A8CBB7]'
                    }`}
                    aria-hidden="true"
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                </span>
                {!isCollapsed && badgeValue !== null && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      active ? 'text-white' : 'text-[#A8CBB7]'
                    }`}
                  >
                    {badgeValue}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#255E4C] p-3">
          {isCollapsed ? (
            <div className="flex justify-center py-1" title="NASA POWER AG Connected">
              <Satellite className="h-4 w-4 text-[#8ED0AC]" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg bg-[#133F32] px-3 py-2.5 text-xs leading-relaxed text-[#CFE0D6]">
              <Satellite
                className="mt-0.5 h-4 w-4 shrink-0 text-[#8ED0AC]"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-white">Agronomic Workspace</p>
                <p className="mt-0.5 text-[11px] text-[#B0CCC0]">
                  NASA POWER daily telemetry &amp; deterministic crop models
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
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-[#123D30] transition-[width] duration-150 lg:block ${
          collapsed ? 'w-[72px]' : 'w-64'
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
            className="fixed inset-0 bg-[#17231E]/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full w-72 max-w-[85vw]">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Purpose-designed mobile bottom bar for primary agronomy routes */}
      <nav
        aria-label="Quick Mobile Navigation"
        className="fixed right-0 bottom-0 left-0 z-30 flex items-center justify-around border-t border-[#E1E8E2] bg-white px-1 py-1 lg:hidden"
      >
        {MOBILE_BAR_ITEMS.map((id) => {
          const item = NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[44px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors ${
                active
                  ? 'bg-[#EAF2EC] text-[#174C3C] font-semibold'
                  : 'text-[#65736B] hover:text-[#17231E]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-full">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
