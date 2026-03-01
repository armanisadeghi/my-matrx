import React, { useState, useEffect, Suspense } from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  Settings, 
  Cpu, 
  Menu, 
  X, 
  User, 
  LogOut,
  Bell,
  Search,
  ChevronRight,
  MoreHorizontal,
  Database,
  Shield
} from 'lucide-react';

// --- CONFIG & CONSTANTS ---
const BEZIER = 'ease-[cubic-bezier(0.34,1.56,0.64,1)]';
const TACTILE = `transition-all duration-300 ${BEZIER} active:scale-95 hover:scale-105`;
const GLASS_BASE = 'bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]';
const GLASS_CONTROL = `bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] backdrop-blur-md ${TACTILE}`;

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'analytics', label: 'Telemetry', icon: Activity },
  { id: 'nodes', label: 'Neural Nodes', icon: Cpu },
  { id: 'database', label: 'Storage', icon: Database },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'users', label: 'Access', icon: Users },
];

// --- MOCK COMPONENTS FOR ATOMIC SUSPENSE ---
const SkeletonPulse = ({ className }) => (
  <div className={`animate-pulse bg-white/5 rounded-2xl ${className}`} />
);

const TelemetryChart = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 1200); }, []);

  if (!loaded) return <SkeletonPulse className="h-64 w-full" />;
  
  return (
    <div className="h-64 w-full flex items-end gap-2 pt-8">
      {[40, 70, 45, 90, 65, 85, 120, 95, 110, 80, 60, 100].map((h, i) => (
        <div key={i} className="flex-1 bg-gradient-to-t from-indigo-500/40 to-cyan-400/20 rounded-t-sm" style={{ height: `${(h / 120) * 100}%` }} />
      ))}
    </div>
  );
};

const NodeDataGrid = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 1800); }, []);

  if (!loaded) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <SkeletonPulse key={i} className="h-16 w-full" />)}
    </div>
  );

  return (
    <div className="w-full space-y-2 text-sm">
      {[
        { id: 'NX-01', status: 'Optimal', load: '24%', ping: '12ms' },
        { id: 'NX-02', status: 'Syncing', load: '89%', ping: '45ms' },
        { id: 'NX-03', status: 'Optimal', load: '41%', ping: '18ms' },
      ].map((node) => (
        <div key={node.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${node.status === 'Optimal' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'}`} />
            <span className="font-mono text-slate-200">{node.id}</span>
          </div>
          <span className="text-slate-400 w-20">{node.status}</span>
          <span className="text-cyan-400 font-mono w-16 text-right">{node.load}</span>
          <span className="text-slate-500 font-mono w-16 text-right">{node.ping}</span>
        </div>
      ))}
    </div>
  );
};

// --- MAIN APPLICATION SHELL ---
export default function AdminShell() {
  const [activeRoute, setActiveRoute] = useState('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isAuth, setIsAuth] = useState(true);

  // --- SUB-COMPONENTS ---
  const AuthIsland = () => (
    <button 
      onClick={() => setIsAuth(!isAuth)}
      className={`h-10 px-4 rounded-full flex items-center justify-center gap-2 overflow-hidden ${GLASS_CONTROL} ${isAuth ? 'w-32' : 'w-28'}`}
    >
      <div className={`flex items-center gap-2 transition-all duration-500 ${BEZIER} ${isAuth ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute'}`}>
        <span className="text-sm font-medium text-slate-200">Admin</span>
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-inner" />
      </div>
      <div className={`flex items-center gap-2 transition-all duration-500 ${BEZIER} ${!isAuth ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 absolute'}`}>
        <span className="text-sm font-medium text-slate-300">Login</span>
        <User size={16} className="text-slate-300" />
      </div>
    </button>
  );

  const NavItem = ({ item, isMobile = false }) => {
    const isActive = activeRoute === item.id;
    return (
      <button
        onClick={() => {
          setActiveRoute(item.id);
          if (isMobile) setIsMobileSheetOpen(false);
        }}
        className={`
          relative flex items-center gap-3 w-full group rounded-full
          ${TACTILE}
          ${isMobile ? 'p-4' : 'p-3'} 
          ${isActive && !isMobile ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]' : 'text-slate-400 hover:text-slate-200'}
          ${isActive && isMobile ? 'text-indigo-400' : ''}
          ${!isSidebarExpanded && !isMobile ? 'justify-center' : ''}
        `}
      >
        <item.icon size={20} className={`relative z-10 ${isActive ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''}`} />
        {(isSidebarExpanded || isMobile) && (
          <span className="text-sm font-medium relative z-10">{item.label}</span>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-950 text-slate-50 selection:bg-indigo-500/30 font-sans">
      {/* GLOBAL BACKGROUND CHOREOGRAPHY */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[60%] w-[30vw] h-[30vw] rounded-full bg-violet-600/10 blur-[100px]" />
        {/* Subtle grid texture overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
      </div>

      <div className="relative z-10 flex h-full w-full">
        
        {/* ================= DESKTOP SIDEBAR ================= */}
        <nav 
          className={`
            hidden md:flex flex-col h-full border-r border-white/5 bg-slate-950/20 backdrop-blur-2xl
            transition-all duration-500 ${BEZIER} pt-6 pb-6 z-40
            ${isSidebarExpanded ? 'w-64 px-4' : 'w-16 px-2'}
          `}
        >
          {/* Brand Identity */}
          <div className={`flex items-center mb-10 gap-3 ${isSidebarExpanded ? 'px-2' : 'justify-center'}`}>
            <button 
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className={`flex-shrink-0 p-2 rounded-full ${GLASS_CONTROL}`}
            >
              <Menu size={16} />
            </button>
            <div className={`flex items-center gap-3 overflow-hidden transition-all duration-500 ${BEZIER} ${isSidebarExpanded ? 'w-full opacity-100' : 'w-0 opacity-0 hidden'}`}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                <Cpu size={16} className="text-white" />
              </div>
              <span className="font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 whitespace-nowrap">
                AI MATRX
              </span>
            </div>
          </div>

          {/* Primary Nav */}
          <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
            {NAV_ITEMS.map(item => (
              <NavItem key={item.id} item={item} />
            ))}
          </div>

          {/* Persistent Footer Icon */}
          <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
            <button className={`w-full flex items-center gap-3 p-3 rounded-full text-slate-400 ${GLASS_CONTROL} ${!isSidebarExpanded && 'justify-center'}`}>
              <Settings size={20} />
              {isSidebarExpanded && <span className="text-sm font-medium">System Prefs</span>}
            </button>
          </div>
        </nav>

        {/* ================= MAIN CONTENT CONTEXT ================= */}
        <main className="flex-1 flex flex-col h-full relative min-w-0">
          
          {/* DESKTOP/MOBILE HEADER */}
          <header className={`
            absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 md:px-8 z-30
            bg-white/5 border-b border-white/10 backdrop-blur-xl shadow-[0_4px_24px_0_rgba(0,0,0,0.2)]
          `}>
            {/* Mobile Left: Hamburger */}
            <div className="flex items-center md:hidden">
              <button onClick={() => setIsMobileSheetOpen(true)} className={`p-3 rounded-full ${GLASS_CONTROL}`}>
                <Menu size={20} />
              </button>
            </div>

            {/* Header Center: Contextual Route Injection Zone (Static Shell) */}
            <div className="flex-1 flex justify-center md:justify-start md:ml-4">
              <h1 className="text-lg font-medium text-slate-200 capitalize tracking-wide hidden md:block mt-1">
                {activeRoute.replace('-', ' ')}
              </h1>
            </div>

            {/* Header Right: Auth Island & Global Tools */}
            <div className="flex items-center gap-3">
              <button className={`hidden md:flex p-2 rounded-full ${GLASS_CONTROL}`}>
                <Search size={16} />
              </button>
              <button className={`hidden md:flex p-2 rounded-full ${GLASS_CONTROL}`}>
                <Bell size={16} />
              </button>
              <AuthIsland />
            </div>
          </header>

          {/* INDEPENDENT SCROLL AREA */}
          <div className="absolute inset-0 overflow-y-auto px-4 md:px-8 pb-24 md:pb-8 pt-20 custom-scrollbar">
            
            {/* Viewport Content - Utilizing atomic suspense hollow shell concepts */}
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Header metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Active Streams', val: '1,204', trend: '+12%' },
                  { label: 'Latency', val: '24ms', trend: '-2ms' },
                  { label: 'Compute Load', val: '86%', trend: '+4%' },
                  { label: 'Anomalies', val: '0', trend: '0%' }
                ].map((stat, i) => (
                  <div key={i} className={`p-5 rounded-3xl ${GLASS_BASE} flex flex-col gap-2 relative overflow-hidden group`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</span>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl md:text-3xl font-light text-white">{stat.val}</span>
                      <span className="text-xs text-emerald-400 mb-1">{stat.trend}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Structural Core (Progressively Hydrated Zones) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Chart Area */}
                <div className={`col-span-1 lg:col-span-2 p-6 rounded-3xl ${GLASS_BASE} flex flex-col min-h-[300px]`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium">System Telemetry</h2>
                    <button className={`p-2 rounded-full ${GLASS_CONTROL}`}><MoreHorizontal size={16} /></button>
                  </div>
                  {/* Micro-loading Boundary */}
                  <div className="flex-1 flex items-end">
                    <TelemetryChart />
                  </div>
                </div>

                {/* List Area */}
                <div className={`col-span-1 p-6 rounded-3xl ${GLASS_BASE} flex flex-col min-h-[300px]`}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium">Neural Nodes</h2>
                    <button className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">View All</button>
                  </div>
                  {/* Micro-loading Boundary */}
                  <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                    <NodeDataGrid />
                  </div>
                </div>

              </div>

            </div>
          </div>
        </main>

        {/* ================= MOBILE BOTTOM DOCK ================= */}
        <div className="md:hidden fixed bottom-4 left-2 right-2 z-50 flex justify-center pb-[env(safe-area-inset-bottom)]">
          <div className={`
            w-full flex items-center justify-between px-2 py-2 rounded-full ${GLASS_BASE} shadow-2xl
          `}>
            {NAV_ITEMS.map(item => {
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveRoute(item.id)}
                  className={`
                    relative p-2.5 sm:p-3 rounded-full flex flex-col items-center justify-center
                    ${TACTILE}
                    ${isActive ? 'bg-white/10 text-indigo-300' : 'text-slate-400'}
                  `}
                >
                  <item.icon size={20} className={isActive ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''} />
                  {isActive && (
                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-400 shadow-[0_0_5px_rgba(99,102,241,0.8)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= MOBILE OFF-CANVAS SHEET ================= */}
        <div 
          className={`
            md:hidden fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm transition-opacity duration-500 ${BEZIER}
            ${isMobileSheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          onClick={() => setIsMobileSheetOpen(false)}
        >
          <div 
            className={`
              absolute top-0 left-0 w-72 h-full ${GLASS_BASE} rounded-r-3xl p-6
              transition-transform duration-500 ${BEZIER}
              ${isMobileSheetOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
            onClick={e => e.stopPropagation()} // Prevent close on sheet click
          >
            <div className="flex items-center justify-between mb-8">
              <span className="font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                AI MATRX
              </span>
              <button 
                onClick={() => setIsMobileSheetOpen(false)}
                className={`p-2 rounded-full ${GLASS_CONTROL}`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {NAV_ITEMS.map(item => (
                <NavItem key={item.id} item={item} isMobile={true} />
              ))}
              <div className="h-px w-full bg-white/5 my-4" />
              <button className={`w-full flex items-center gap-3 p-4 rounded-full text-slate-400 ${GLASS_CONTROL}`}>
                <Settings size={20} />
                <span className="text-sm font-medium">System Prefs</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Global CSS Overrides for structural hiding of scrollbars to maintain clean UI */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}} />
    </div>
  );
}