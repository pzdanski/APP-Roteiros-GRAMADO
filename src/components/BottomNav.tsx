import React from 'react';
import { Compass, CalendarDays, Map, MessageSquareText } from 'lucide-react';

export type AppTab = 'hoje' | 'roteiro' | 'mapa' | 'guia';

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  unreadGuideMessages?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  unreadGuideMessages = 0
}) => {
  interface TabItem {
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const tabs: TabItem[] = [
    { id: 'hoje', label: 'HOJE', icon: Compass },
    { id: 'roteiro', label: 'ROTEIRO', icon: CalendarDays },
    { id: 'mapa', label: 'MAPA', icon: Map },
    { id: 'guia', label: 'GUIA', icon: MessageSquareText, badge: unreadGuideMessages }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E7DFCE] pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div className="max-w-md mx-auto grid grid-cols-4 h-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              id={`tab-btn-${tab.id}`}
              key={tab.id}
              onClick={() => onChangeTab(tab.id as AppTab)}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-[#1B4332]' : 'text-[#94A3B8] hover:text-[#64748B]'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-[#1B4332] rounded-full" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>

              <span className={`text-[10px] tracking-wider uppercase ${
                isActive ? 'font-extrabold' : 'font-semibold'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
