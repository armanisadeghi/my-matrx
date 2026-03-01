import React, { useState, useEffect } from 'react';
import { 
  Menu, Home, PieChart, Users, Settings, 
  Moon, Sun, LogIn, User, Search, Bell, 
  Database, Shield, ChevronRight, Activity 
} from 'lucide-react';

// --- CONFIGURATION & TOKENS ---
const NAV_ITEMS = [
  { id: 'home', icon: Home, label: 'Dashboard' },
  { id: 'analytics', icon: PieChart, label: 'Analytics' },
  { id: 'users', icon: Users, label: 'User Directory' },
  { id: 'database', icon: Database, label: 'Data Sources' },
  { id: 'shield', icon: Shield, label: 'Security' },
  { id: 'activity', icon: Activity, label: 'System Logs' },
];

export default function AdminShell() {
  const [isDark, setIsDark] = useState(false);
  const [activeRoute, setActiveRoute] = useState('home');
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize Theme & Hydration Simulation
  useEffect(() => {
    // Simulate progressive hydration for dynamic components (Auth Island)
    const timer = setTimeout(() => setIsHydrated(true), 1200);
    
    // Static-compatible theming check
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <>
      {/* INJECTED CSS
        Defines the mandatory iOS-grade easing and base structural variables.
      */}
      <style>{`
        :root {
          --ease-ios: cubic-bezier(0.34, 1.56, 0.64, 1);
          --header-height: 5rem;
          --dock-height: 5rem;
        }
        
        /* Base Glassmorphic Material */
        .glass-panel {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.05);
        }
        .dark .glass-panel {
          background: rgba(15, 23, 42, 0.5); /* Slate 900 base */
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.3);
        }

        /* Tactile UI Node */
        .ui-node {
          transition: all 400ms var(--ease-ios);
        }
        .ui-node:hover {
          transform: scale(1.05);
        }
        .ui-node:active {
          transform: scale(0.95);
        }

        /* Smooth Layout Transitions */
        .layout-transition {
          transition: width 500ms var(--ease-ios), padding 500ms var(--ease-ios), margin 500ms var(--ease-ios);
        }

        /* Background Pattern to emphasize Glass depth */
        .enterprise-bg {
          background-image: radial-gradient(rgba(148, 163, 184, 0.2) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .dark .enterprise-bg {
          background-image: radial-gradient(rgba(51, 65, 85, 0.4) 1px, transparent 1px);
        }
        
        /* Hide scrollbar for nav rail */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* GLOBAL VIEWPORT LOCK
        100vh, overflow-hidden, with underlying enterprise pattern
      */}
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 enterprise-bg relative font-sans selection:bg-indigo-500/30">
        
        {/* CSS-DRIVEN STATE (Zero-JS layout toggle) */}
        <input type="checkbox" id="desktop-sidebar-toggle" className="hidden peer/sidebar" />
        <input type="checkbox" id="mobile-sidebar-toggle" className="hidden peer/mobile" />

        {/* =========================================
            DESKTOP SIDEBAR (Fixed App-Shell)
            ========================================= */}
        <aside className="hidden md:flex flex-col z-40 h-screen layout-transition w-20 peer-checked/sidebar:w-64 glass-panel border-r border-t-0 border-b-0 border-l-0">
          
          {/* Top (Brand Area) */}
          <div className="h-[var(--header-height)] flex items-center px-4 shrink-0 overflow-hidden relative">
            <label 
              htmlFor="desktop-sidebar-toggle" 
              className="ui-node glass-panel cursor-pointer rounded-full w-12 h-12 flex items-center justify-center shrink-0 z-10"
            >
              <Menu size={20} strokeWidth={2.5} className="text-slate-700 dark:text-slate-300" />
            </label>
            <div className="absolute left-20 flex items-center whitespace-nowrap opacity-0 peer-checked/sidebar:opacity-100 transition-opacity duration-300 delay-100">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center mr-3 shadow-md">
                <Activity size={18} className="text-white" strokeWidth={3} />
              </div>
              <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-slate-100 dark:to-slate-400">
                AI Matrx
              </span>
            </div>
          </div>

          {/* Middle (Nav Rail - Independent Scroll) */}
          <nav className="flex-1 overflow-y-auto no-scrollbar py-6 px-3 flex flex-col gap-3 relative">
            {NAV_ITEMS.map((item) => {
              const isActive = activeRoute === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveRoute(item.id)}
                  className={`
                    group relative flex items-center h-12 rounded-full overflow-hidden shrink-0 ui-node
                    ${isActive 
                      ? 'bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-600/20 dark:border-indigo-400/20' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent'
                    }
                  `}
                >
                  {/* Icon centered perfectly when collapsed via absolute positioning matching parent width (w-14 relative to w-20 container padding) */}
                  <div className="w-14 h-12 absolute left-0 flex items-center justify-center shrink-0">
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  {/* Label area pushed to the right, hidden when collapsed */}
                  <div className="pl-14 whitespace-nowrap font-medium text-sm tracking-wide">
                    {item.label}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Bottom (Preferences/Settings) */}
          <div className="p-3 shrink-0 flex flex-col gap-3 pb-6">
            <button 
              onClick={toggleTheme}
              className="group relative flex items-center h-12 rounded-full overflow-hidden shrink-0 ui-node text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent"
            >
              <div className="w-14 h-12 absolute left-0 flex items-center justify-center shrink-0">
                {isDark ? <Sun size={22} strokeWidth={2} /> : <Moon size={22} strokeWidth={2} />}
              </div>
              <div className="pl-14 whitespace-nowrap font-medium text-sm">
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </div>
            </button>
            <button className="group relative flex items-center h-12 rounded-full overflow-hidden shrink-0 ui-node text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent">
              <div className="w-14 h-12 absolute left-0 flex items-center justify-center shrink-0">
                <Settings size={22} strokeWidth={2} />
              </div>
              <div className="pl-14 whitespace-nowrap font-medium text-sm">
                System Settings
              </div>
            </button>
          </div>
        </aside>

        {/* =========================================
            MOBILE OFF-CANVAS SIDE SHEET (CSS-Driven)
            ========================================= */}
        <div className="fixed inset-0 z-50 pointer-events-none md:hidden peer-checked/mobile:pointer-events-auto">
          {/* Backdrop */}
          <label 
            htmlFor="mobile-sidebar-toggle" 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm opacity-0 peer-checked/mobile:opacity-100 transition-opacity duration-500 var(--ease-ios) cursor-pointer"
          />
          {/* Sheet */}
          <aside className="absolute left-0 top-0 bottom-0 w-[80vw] max-w-sm glass-panel border-r border-white/20 dark:border-white/10 -translate-x-full peer-checked/mobile:translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col pointer-events-auto shadow-2xl">
             <div className="h-[var(--header-height)] flex items-center px-6 border-b border-slate-200/50 dark:border-slate-800/50">
               <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center mr-3 shadow-md">
                <Activity size={18} className="text-white" strokeWidth={3} />
               </div>
               <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">AI Matrx</span>
             </div>
             <nav className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeRoute === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={`mob-${item.id}`}
                      onClick={() => {
                        setActiveRoute(item.id);
                        document.getElementById('mobile-sidebar-toggle').checked = false;
                      }}
                      className={`flex items-center h-14 px-4 rounded-2xl ui-node ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
                    >
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="mr-4" />
                      <span className="font-medium text-base">{item.label}</span>
                    </button>
                  )
                })}
             </nav>
          </aside>
        </div>


        {/* =========================================
            MAIN CONTENT AREA
            ========================================= */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative z-0">
          
          {/* TOP HEADER 
              Strictly transparent wrapper. Child nodes are glassmorphic. Z-Layer above content. */}
          <header className="h-[var(--header-height)] bg-transparent w-full flex items-center justify-between px-4 md:px-8 absolute top-0 left-0 right-0 z-30 pointer-events-none">
            
            {/* Left: Mobile Hamburger (Desktop hides this, uses sidebar left toggle) */}
            <div className="flex items-center pointer-events-auto md:hidden">
               <label 
                htmlFor="mobile-sidebar-toggle" 
                className="ui-node glass-panel cursor-pointer rounded-full w-12 h-12 flex items-center justify-center"
              >
                <Menu size={20} strokeWidth={2.5} />
              </label>
            </div>

            {/* Center: Dynamic Injection Zone (Empty at root, ready for route titles/controls) */}
            <div className="flex-1 flex justify-center pointer-events-auto px-4">
              <div className="hidden md:flex ui-node glass-panel rounded-full h-12 items-center px-4 max-w-md w-full shadow-sm">
                <Search size={18} className="text-slate-400 mr-3" />
                <input 
                  type="text" 
                  placeholder="Press ⌘K to search..." 
                  className="bg-transparent border-none outline-none text-sm w-full text-slate-800 dark:text-slate-200 placeholder-slate-400/70"
                />
              </div>
            </div>

            {/* Right: Global Actions & Auth Island */}
            <div className="flex items-center gap-3 pointer-events-auto">
              
              <button className="hidden md:flex ui-node glass-panel rounded-full w-12 h-12 items-center justify-center relative text-slate-600 dark:text-slate-300">
                <Bell size={20} strokeWidth={2} />
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-slate-50 dark:border-slate-900"></span>
              </button>

              {/* AUTH ISLAND: Immutable Structure, Progressive Hydration */}
              <button className="ui-node glass-panel rounded-full h-12 flex items-center pr-4 pl-1 shadow-sm overflow-hidden min-w-[120px]">
                {isHydrated ? (
                  // Hydrated State
                  <>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mr-3 shrink-0 shadow-inner">
                      <User size={18} className="text-indigo-600 dark:text-indigo-400" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-semibold tracking-wide whitespace-nowrap animate-in fade-in slide-in-from-right-2 duration-300">
                      C. Administrator
                    </span>
                  </>
                ) : (
                  // Static / Pre-hydration Shell
                  <>
                    <div className="w-10 h-10 rounded-full bg-slate-200/50 dark:bg-slate-700/50 flex items-center justify-center mr-3 shrink-0">
                      <LogIn size={18} className="text-slate-500 dark:text-slate-400" />
                    </div>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Authenticating...
                    </span>
                  </>
                )}
              </button>

            </div>
          </header>

          {/* INDEPENDENT SCROLL CONTEXT (Main Content) 
              Content scrolls beautifully under the transparent header and mobile dock */}
          <div className="flex-1 overflow-y-auto pt-[var(--header-height)] pb-[calc(var(--dock-height)+2rem)] md:pb-8 px-4 md:px-8 relative z-10">
             
             {/* Layout Geometry & Micro-loading Suspense Simulator */}
             <div className="max-w-7xl mx-auto mt-8 animate-in fade-in duration-700 zoom-in-95">
                
                {/* Header Area */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                      {NAV_ITEMS.find(i => i.id === activeRoute)?.label || 'Overview'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base max-w-2xl">
                      Enterprise application core operating normally. Subsystems are routing and structural integrity is 100%.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button className="ui-node glass-panel h-10 px-4 rounded-full text-sm font-medium">Export Data</button>
                    <button className="ui-node bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 h-10 px-6 rounded-full text-sm font-medium transition-colors">
                      Generate Report
                    </button>
                  </div>
                </div>

                {/* Dashboard Grid Simulation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {[1, 2, 3].map((card) => (
                    <div key={card} className="glass-panel p-6 rounded-3xl ui-node hover:scale-[1.02] flex flex-col justify-between h-48">
                      <div className="w-10 h-10 rounded-full bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                        <Activity size={20} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Bandwidth</div>
                        <div className="text-3xl font-bold">128.4 TB</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Main Data Table Area (Simulated Suspense Boundary Shell) */}
                <div className="glass-panel rounded-3xl p-6 min-h-[400px]">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-semibold">Active Sessions</h3>
                    <button className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  
                  {/* Micro-loader shell structure */}
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((row) => (
                      <div key={row} className="flex items-center p-3 rounded-2xl hover:bg-slate-200/30 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group">
                        <div className="w-10 h-10 rounded-full bg-slate-300/50 dark:bg-slate-700/50 mr-4 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors"></div>
                        <div className="flex-1">
                          <div className="h-4 w-1/3 bg-slate-300/50 dark:bg-slate-700/50 rounded mb-2"></div>
                          <div className="h-3 w-1/4 bg-slate-200/50 dark:bg-slate-800/50 rounded"></div>
                        </div>
                        <div className="h-8 w-24 bg-slate-200/50 dark:bg-slate-800/50 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                </div>

             </div>
          </div>
        </main>

        {/* =========================================
            MOBILE NAVIGATION DOCK (Bottom Fixed)
            ========================================= */}
        <div className="md:hidden fixed bottom-6 left-4 right-4 z-40 flex justify-center pointer-events-none">
          {/* Glass Dock Container */}
          <nav className="glass-panel rounded-[2rem] h-[var(--dock-height)] w-full max-w-[400px] px-2 flex items-center justify-around pointer-events-auto shadow-2xl">
            {NAV_ITEMS.slice(0, 5).map((item) => {
              const isActive = activeRoute === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={`dock-${item.id}`}
                  onClick={() => setActiveRoute(item.id)}
                  className="relative ui-node flex flex-col items-center justify-center w-14 h-14 rounded-full"
                >
                  {/* Active Magic Pill (Mobile) */}
                  {isActive && (
                    <div className="absolute inset-0 bg-indigo-600/10 dark:bg-indigo-500/20 rounded-full -z-10 animate-in zoom-in duration-300 var(--ease-ios)"></div>
                  )}
                  <Icon 
                    size={24} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'} 
                  />
                  {isActive && (
                     <span className="absolute -bottom-1 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

      </div>
    </>
  );
}