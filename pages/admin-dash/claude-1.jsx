import { useState, useEffect, useRef, Suspense, lazy } from "react";
import {
  LayoutDashboard, TrendingUp, Users, FolderOpen, MessageSquare,
  Database, Settings, Bell, Search, Menu, X, LogIn, ChevronRight,
  ArrowUpRight, ArrowDownRight, Activity, Zap, Shield, Globe,
  MoreHorizontal, Circle, CheckCircle2, AlertCircle, Clock,
  Star, Package, GitBranch, Cpu, Layers, Filter, Plus,
  ChevronLeft, UserCircle2, Sparkles, BarChart3, PanelLeftClose,
  PanelLeft, Hash, Radio, Signal
} from "lucide-react";

// ─── INJECTED STYLES ────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --sidebar-width-expanded: 240px;
    --sidebar-width-collapsed: 72px;
    --header-height: 64px;
    --dock-height: 80px;
    --sidebar-width: var(--sidebar-width-expanded);

    /* Void palette */
    --void: #03030f;
    --void-1: #080818;
    --void-2: #0d0d22;
    --void-3: #12122e;

    /* Glass system */
    --glass-1: rgba(255,255,255,0.03);
    --glass-2: rgba(255,255,255,0.06);
    --glass-3: rgba(255,255,255,0.09);
    --glass-4: rgba(255,255,255,0.12);

    /* Borders */
    --border: rgba(255,255,255,0.07);
    --border-active: rgba(255,255,255,0.14);
    --border-bright: rgba(255,255,255,0.22);

    /* Accents */
    --violet: #7c5cfc;
    --violet-dim: rgba(124,92,252,0.15);
    --violet-glow: rgba(124,92,252,0.35);
    --cyan: #00d4ff;
    --cyan-dim: rgba(0,212,255,0.12);
    --green: #00e87a;
    --amber: #ff9f0a;
    --red: #ff3b5c;

    /* Typography */
    --text-primary: rgba(255,255,255,0.95);
    --text-secondary: rgba(255,255,255,0.55);
    --text-tertiary: rgba(255,255,255,0.28);

    /* Spring easing */
    --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --ease-out: cubic-bezier(0.22, 1, 0.36, 1);

    /* Sidebar state (toggled by JS in this demo) */
    --sidebar-current-width: var(--sidebar-width-expanded);
  }

  html, body, #root {
    height: 100%;
    background: var(--void);
    font-family: 'Sora', sans-serif;
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--glass-4); border-radius: 99px; }

  /* ── App Shell ── */
  .app-shell {
    display: grid;
    grid-template-columns: var(--sidebar-current-width) 1fr;
    grid-template-rows: var(--header-height) 1fr;
    height: 100dvh;
    overflow: hidden;
    transition: grid-template-columns 0.45s var(--spring);
  }
  .app-shell.collapsed {
    --sidebar-current-width: var(--sidebar-width-collapsed);
  }
  @media (max-width: 768px) {
    .app-shell {
      grid-template-columns: 1fr;
      grid-template-rows: var(--header-height) 1fr;
      --sidebar-current-width: 0px;
    }
  }

  /* ── Background mesh ── */
  .bg-mesh {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 80% 60% at 20% 10%, rgba(124,92,252,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 80%, rgba(0,212,255,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 50% 50%, rgba(124,92,252,0.04) 0%, transparent 70%),
      var(--void-1);
  }
  .bg-noise {
    position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px;
  }

  /* ── Glass mixin ── */
  .glass {
    background: var(--glass-2);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid var(--border);
  }
  .glass-bright {
    background: var(--glass-3);
    backdrop-filter: blur(32px) saturate(200%);
    -webkit-backdrop-filter: blur(32px) saturate(200%);
    border: 1px solid var(--border-active);
  }

  /* ── Sidebar ── */
  .sidebar {
    grid-row: 1 / -1;
    position: relative; z-index: 50;
    display: flex; flex-direction: column;
    height: 100dvh;
    background: var(--glass-1);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border-right: 1px solid var(--border);
    overflow: hidden;
    transition: width 0.45s var(--spring);
  }
  @media (max-width: 768px) { .sidebar { display: none; } }

  .sidebar-brand {
    height: var(--header-height);
    display: flex; align-items: center;
    /* toggle at start, brand-group follows */
    padding: 0 17px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 12px;
    overflow: hidden;
    white-space: nowrap;
    justify-content: flex-start;
    transition: padding 0.4s var(--ease-out), gap 0.4s var(--ease-out);
  }
  /* When collapsed: zero gap+padding so toggle centers in the 72px rail */
  .collapsed .sidebar-brand {
    padding: 0;
    gap: 0;
    justify-content: center;
  }

  .brand-group {
    display: flex; align-items: center; gap: 10px;
    overflow: hidden;
    opacity: 1;
    max-width: 200px;
    transition: opacity 0.2s var(--ease-out), max-width 0.38s var(--ease-out);
  }
  .collapsed .brand-group {
    opacity: 0;
    max-width: 0;
  }

  /* The sidebar toggle button — always visible, shifts to center when collapsed */
  .sidebar-toggle {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--glass-2); border: 1px solid var(--border);
    cursor: pointer;
    color: var(--text-secondary);
    transition: background 0.15s, border-color 0.15s,
                transform 0.15s var(--spring), color 0.15s;
  }
  .sidebar-toggle:hover {
    background: var(--glass-4); border-color: var(--border-active);
    color: var(--text-primary); transform: scale(1.1);
  }
  .sidebar-toggle:active { transform: scale(0.92); }

  .brand-icon {
    width: 32px; height: 32px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--violet), var(--cyan));
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 20px var(--violet-glow), inset 0 1px 0 rgba(255,255,255,0.2);
  }

  .brand-text {
    font-size: 14px; font-weight: 700; letter-spacing: 0.08em;
    background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }

  /* ── Sidebar Nav ── */
  .sidebar-nav {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding: 12px 10px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .nav-section-label {
    font-size: 9px; font-weight: 600; letter-spacing: 0.12em;
    color: var(--text-tertiary); text-transform: uppercase;
    padding: 8px 12px 4px;
    opacity: 1; transition: opacity 0.2s;
    overflow: hidden; white-space: nowrap;
  }
  .collapsed .nav-section-label { opacity: 0; }

  .nav-item {
    position: relative;
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
    transition:
      background 0.2s,
      border-color 0.2s;
    border: 1px solid transparent;
    color: var(--text-secondary);
    font-size: 13.5px; font-weight: 500;
    min-height: 44px;
  }
  .nav-item:hover {
    background: var(--glass-3);
    border-color: var(--border);
    color: var(--text-primary);
    transform: scale(1.01);
    transition: background 0.15s, transform 0.15s var(--spring);
  }
  .nav-item:active { transform: scale(0.97); }
  .nav-item .nav-icon { flex-shrink: 0; transition: color 0.2s; }
  .nav-item .nav-label {
    opacity: 1;
    max-width: 160px;
    overflow: hidden;
    transition: opacity 0.18s var(--ease-out), max-width 0.35s var(--ease-out);
  }
  /* Label collapses to true zero-width so it cannot displace the centered icon */
  .collapsed .nav-item .nav-label {
    opacity: 0;
    max-width: 0;
  }
  .collapsed .nav-item {
    justify-content: center;
    padding: 10px;
    gap: 0; /* zero gap means only the icon participates in centering */
  }

  /* ── Magic Pill ── */
  .nav-item.active {
    color: var(--text-primary);
    background: rgba(124,92,252,0.18);
    border-color: rgba(124,92,252,0.3);
    box-shadow: 0 0 20px rgba(124,92,252,0.12), inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .nav-item.active .nav-icon { color: var(--violet); }
  .nav-item.active::before {
    content: '';
    position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 60%; border-radius: 0 3px 3px 0;
    background: linear-gradient(to bottom, var(--violet), var(--cyan));
    box-shadow: 0 0 8px var(--violet);
  }
  .collapsed .nav-item.active { justify-content: center; }
  .collapsed .nav-item.active::before { display: none; }

  .nav-badge {
    margin-left: auto; flex-shrink: 0;
    background: var(--violet);
    color: white; font-size: 10px; font-weight: 700;
    padding: 1px 6px; border-radius: 99px;
    min-width: 18px; text-align: center;
    opacity: 1;
    max-width: 48px; overflow: hidden;
    transition: opacity 0.2s var(--ease-out), max-width 0.3s var(--ease-out),
                padding 0.3s var(--ease-out), margin 0.3s var(--ease-out);
  }
  /* Collapse to zero dimensions so it cannot push the icon at all */
  .collapsed .nav-badge {
    opacity: 0;
    max-width: 0;
    padding: 0;
    margin-left: 0;
    min-width: 0;
  }

  /* ── Sidebar Footer ── */
  .sidebar-footer {
    padding: 12px 10px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  /* ── Header ── */
  .header {
    grid-column: 2;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    padding: 0 20px;
    height: var(--header-height);
    gap: 12px;
    position: relative; z-index: 40;
    /* Fully transparent — backdrop-filter IS the background */
    background: transparent;
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border-bottom: 1px solid var(--border);
  }
  @media (max-width: 768px) {
    .header { grid-column: 1; padding: 0 12px; gap: 8px; }
  }

  /* ── Header zones ── */
  .header-left {
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0;
  }
  .header-center {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    overflow: hidden;
    min-width: 0;
  }
  .header-right {
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0;
  }

  /* Header context: title + status pill */
  .header-context {
    display: flex; align-items: center; gap: 8px;
    overflow: hidden;
    flex-shrink: 1; min-width: 0;
    /* fade in/out transition for mobile search expand */
    opacity: 1; max-width: 400px;
    transition: opacity 0.2s var(--ease-out), max-width 0.35s var(--ease-out);
    white-space: nowrap;
  }

  /* ── Search Bar ── */
  .search-bar {
    display: flex; align-items: center; gap: 10px;
    background: var(--glass-2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0 14px;
    height: 40px;
    /* Desktop: fixed comfortable width */
    width: 280px;
    flex-shrink: 0;
    transition: border-color 0.2s, background 0.2s, width 0.38s var(--spring), box-shadow 0.2s;
  }
  .search-bar:focus-within {
    border-color: rgba(124,92,252,0.5);
    background: var(--glass-3);
    box-shadow: 0 0 0 3px rgba(124,92,252,0.1);
  }
  .search-bar input {
    background: none; border: none; outline: none;
    color: var(--text-primary); font-family: 'Sora', sans-serif;
    font-size: 13px;
    flex: 1; min-width: 0;
  }
  .search-bar input::placeholder { color: var(--text-tertiary); }
  .search-bar .search-kbd {
    font-size: 10px; color: var(--text-tertiary);
    background: var(--glass-3); border: 1px solid var(--border);
    border-radius: 5px; padding: 1px 5px;
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
    opacity: 1; transition: opacity 0.15s;
  }
  .search-bar:focus-within .search-kbd { opacity: 0; }

  /* ── Mobile search: icon-only → expand on focus ── */
  @media (max-width: 768px) {
    .search-bar {
      /* Collapsed: just the icon circle */
      width: 40px;
      padding: 0;
      justify-content: center;
      border-radius: 50%;
      overflow: hidden;
    }
    .search-bar input {
      width: 0; opacity: 0; pointer-events: none;
      transition: opacity 0.2s, width 0s;
    }
    .search-bar .search-kbd { display: none; }

    /* Expanded: full width, hides sibling context */
    .search-bar:focus-within {
      width: 100%;
      padding: 0 14px;
      border-radius: 12px;
      justify-content: flex-start;
    }
    .search-bar:focus-within input {
      width: auto; opacity: 1; pointer-events: all;
      transition: opacity 0.2s 0.15s;
    }

    /* CSS-only: hide context when search is expanding on mobile */
    /* .header-center:focus-within targets when any child (the input) is focused */
    .header-center:focus-within .header-context {
      opacity: 0;
      max-width: 0;
      overflow: hidden;
    }
  }

  /* ── Icon Button ── */
  .icon-btn {
    width: 40px; height: 40px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--glass-2); border: 1px solid var(--border);
    cursor: pointer; flex-shrink: 0;
    transition: background 0.15s, transform 0.15s var(--spring), border-color 0.15s;
    color: var(--text-secondary);
  }
  .icon-btn:hover {
    background: var(--glass-4); border-color: var(--border-active);
    color: var(--text-primary); transform: scale(1.08);
  }
  .icon-btn:active { transform: scale(0.93); }
  .icon-btn.has-dot { position: relative; }
  .icon-btn.has-dot::after {
    content: ''; position: absolute; top: 6px; right: 6px;
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--violet);
    box-shadow: 0 0 6px var(--violet);
    border: 2px solid var(--void-1);
  }

  /* ── Auth Island ── */
  .auth-island {
    display: flex; align-items: center; gap: 10px;
    background: var(--glass-2);
    border: 1px solid var(--border);
    border-radius: 99px;
    padding: 5px 14px 5px 5px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.15s var(--spring);
  }
  .auth-island:hover {
    background: var(--glass-4); border-color: var(--border-active);
    transform: scale(1.03);
  }
  .auth-island:active { transform: scale(0.97); }
  .auth-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, var(--violet), var(--cyan));
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: white;
    box-shadow: 0 0 10px var(--violet-glow);
    flex-shrink: 0;
  }
  .auth-name {
    font-size: 13px; font-weight: 600;
    white-space: nowrap; max-width: 100px; overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Mobile Header Menu Button ── */
  .mobile-menu-btn {
    display: none;
  }
  @media (max-width: 768px) { .mobile-menu-btn { display: flex; } }

  /* ── Main Content ── */
  .main-content {
    grid-column: 2;
    overflow-y: auto;
    position: relative; z-index: 10;
    padding: 28px 28px 100px;
  }
  @media (max-width: 768px) {
    .main-content {
      grid-column: 1;
      padding: 20px 16px calc(var(--dock-height) + 20px);
    }
  }

  /* ── Mobile Dock ── */
  .mobile-dock {
    display: none;
  }
  @media (max-width: 768px) {
    .mobile-dock {
      display: flex;
      position: fixed;
      /* Float above safe area with a gap */
      bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
      left: 16px; right: 16px;
      z-index: 100;
      height: 64px;
      align-items: center; justify-content: space-around;
      /* Pure glass — no solid background */
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(40px) saturate(220%);
      -webkit-backdrop-filter: blur(40px) saturate(220%);
      border: 1px solid var(--border-active);
      border-radius: 24px;
      padding: 0 8px;
      /* Elevation shadow to sell the floating effect */
      box-shadow:
        0 8px 32px rgba(0,0,0,0.45),
        0 2px 8px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.08);
    }
  }
  .dock-item {
    display: flex; align-items: center; justify-content: center;
    width: 48px; height: 48px;
    border-radius: 16px;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s var(--spring), color 0.15s;
    color: var(--text-tertiary);
    border: 1px solid transparent;
    flex-shrink: 0;
  }
  .dock-item:hover { background: var(--glass-3); color: var(--text-secondary); }
  .dock-item:active { transform: scale(0.88); }
  .dock-item.active {
    background: rgba(124,92,252,0.2);
    border-color: rgba(124,92,252,0.3);
    color: var(--violet);
    box-shadow: 0 0 16px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.06);
  }

  /* ── Mobile Drawer ── */
  .drawer-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    opacity: 0; pointer-events: none;
    transition: opacity 0.3s var(--ease-out);
  }
  .drawer-overlay.open { opacity: 1; pointer-events: all; }
  .drawer-panel {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 201;
    width: min(300px, 85vw);
    background: rgba(10,10,28,0.92);
    backdrop-filter: blur(48px) saturate(200%);
    -webkit-backdrop-filter: blur(48px) saturate(200%);
    border-right: 1px solid var(--border);
    transform: translateX(-100%);
    transition: transform 0.45s var(--spring);
    display: flex; flex-direction: column;
  }
  .drawer-panel.open { transform: translateX(0); }

  /* ── Cards ── */
  .card {
    background: var(--glass-2);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid var(--border);
    border-radius: 20px;
    transition: border-color 0.2s, transform 0.2s var(--spring);
  }
  .card:hover { border-color: var(--border-active); }

  .card-interactive {
    cursor: pointer;
  }
  .card-interactive:hover { transform: translateY(-2px); }
  .card-interactive:active { transform: scale(0.985); }

  /* ── KPI Cards ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  @media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .kpi-grid { grid-template-columns: 1fr; } }

  .kpi-card {
    padding: 22px;
    position: relative;
    overflow: hidden;
  }
  .kpi-card::before {
    content: '';
    position: absolute; top: 0; right: 0;
    width: 100px; height: 100px;
    border-radius: 50%;
    opacity: 0.08;
    background: var(--accent-color, var(--violet));
    filter: blur(30px);
    transform: translate(20%, -30%);
  }
  .kpi-icon-wrap {
    width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
    border: 1px solid var(--border);
  }
  .kpi-value {
    font-size: 28px; font-weight: 700;
    letter-spacing: -0.02em; line-height: 1;
    margin-bottom: 6px;
  }
  .kpi-label {
    font-size: 12px; color: var(--text-secondary);
    font-weight: 500; margin-bottom: 12px;
  }
  .kpi-trend {
    display: flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }
  .kpi-trend.up { color: var(--green); }
  .kpi-trend.down { color: var(--red); }

  /* ── Chart ── */
  .chart-area {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }
  @media (max-width: 1024px) { .chart-area { grid-template-columns: 1fr; } }

  /* ── Table ── */
  .data-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
  }
  .data-table th {
    text-align: left; padding: 12px 16px;
    color: var(--text-tertiary); font-weight: 600;
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .data-table td {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--text-secondary);
    vertical-align: middle;
  }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tbody tr {
    transition: background 0.15s;
  }
  .data-table tbody tr:hover { background: var(--glass-2); }

  /* ── Status Pill ── */
  .status-pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 99px;
    font-size: 11px; font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }
  .status-active { background: rgba(0,232,122,0.1); color: var(--green); border: 1px solid rgba(0,232,122,0.2); }
  .status-pending { background: rgba(255,159,10,0.1); color: var(--amber); border: 1px solid rgba(255,159,10,0.2); }
  .status-inactive { background: rgba(255,255,255,0.05); color: var(--text-tertiary); border: 1px solid var(--border); }
  .status-error { background: rgba(255,59,92,0.1); color: var(--red); border: 1px solid rgba(255,59,92,0.2); }

  /* ── Activity Feed ── */
  .activity-item {
    display: flex; gap: 12px; padding: 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .activity-item:last-child { border-bottom: none; }
  .activity-dot {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Heading Styles ── */
  .page-title {
    font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
    color: var(--text-primary);
  }
  .page-subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
  .section-title {
    font-size: 14px; font-weight: 700;
    color: var(--text-primary); margin-bottom: 16px;
  }

  /* ── Skeleton ── */
  @keyframes shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .skeleton {
    background: linear-gradient(90deg,
      rgba(255,255,255,0.04) 25%,
      rgba(255,255,255,0.08) 50%,
      rgba(255,255,255,0.04) 75%
    );
    background-size: 800px 100%;
    animation: shimmer 1.6s infinite;
    border-radius: 8px;
  }

  /* ── Glow effects ── */
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 6px var(--violet-glow); }
    50% { box-shadow: 0 0 16px var(--violet-glow), 0 0 32px rgba(124,92,252,0.2); }
  }
  .glow-pulse { animation: pulse-glow 2.4s ease-in-out infinite; }

  @keyframes float-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: float-up 0.5s var(--ease-out) both; }

  /* ── Tag ── */
  .tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 6px;
    font-size: 11px; font-weight: 600;
    background: var(--glass-3); border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  /* ── Progress Bar ── */
  .progress-track {
    height: 4px; background: var(--glass-3);
    border-radius: 99px; overflow: hidden;
  }
  .progress-fill {
    height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, var(--violet), var(--cyan));
    box-shadow: 0 0 8px var(--violet-glow);
    transition: width 1s var(--ease-out);
  }

  /* ── Divider ── */
  .divider { height: 1px; background: var(--border); margin: 8px 0; }
`;

// ─── DATA ────────────────────────────────────────────────────────────────────
// Badge counts are NOT part of the static nav definition.
// They are fetched client-side only (via useBadgeCounts) and injected after hydration.
// This preserves SSG cacheability — the shell renders without any dynamic counts.
const NAV_PRIMARY = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "users", label: "Users", icon: Users },
  { id: "projects", label: "Projects", icon: Layers },
  { id: "messages", label: "Messages", icon: MessageSquare },
];
const NAV_SECONDARY = [
  { id: "database", label: "Database", icon: Database },
  { id: "api", label: "API Keys", icon: Zap },
  { id: "security", label: "Security", icon: Shield },
];
const DOCK_ITEMS = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "analytics", label: "Stats", icon: TrendingUp },
  { id: "users", label: "Users", icon: Users },
  { id: "messages", label: "Inbox", icon: MessageSquare },
  { id: "settings", label: "Settings", icon: Settings },
];
const KPI_DATA = [
  { label: "Total Revenue", value: "$2.84M", trend: "+18.4%", up: true, icon: TrendingUp, color: "#7c5cfc" },
  { label: "Active Users", value: "124,932", trend: "+9.2%", up: true, icon: Users, color: "#00d4ff" },
  { label: "AI Requests", value: "4.7B", trend: "+32.1%", up: true, icon: Cpu, color: "#00e87a" },
  { label: "Error Rate", value: "0.08%", trend: "-0.03%", up: false, icon: AlertCircle, color: "#ff9f0a" },
];
const TABLE_DATA = [
  { name: "RealSingles App", type: "Mobile", status: "active", users: "48.2k", requests: "1.2B", uptime: "99.98%", avatar: "RS" },
  { name: "AI Workflow Engine", type: "Core", status: "active", users: "12.8k", requests: "890M", uptime: "99.95%", avatar: "AW" },
  { name: "Content Manager", type: "Web", status: "active", users: "8.4k", requests: "440M", uptime: "99.91%", avatar: "CM" },
  { name: "All Green ITAD", type: "Web", status: "active", users: "3.1k", requests: "120M", uptime: "99.99%", avatar: "AG" },
  { name: "Analytics Engine", type: "Core", status: "pending", users: "—", requests: "—", uptime: "—", avatar: "AE" },
  { name: "MCP Gateway", type: "API", status: "active", users: "22.7k", requests: "2.1B", uptime: "99.87%", avatar: "MG" },
];
const ACTIVITY = [
  { icon: CheckCircle2, color: "#00e87a", bg: "rgba(0,232,122,0.1)", text: "Deployment to production completed", sub: "ai-workflow-engine v2.4.1", time: "2m ago" },
  { icon: Users, color: "#7c5cfc", bg: "rgba(124,92,252,0.1)", text: "New enterprise account activated", sub: "Acme Corp · 500 seats", time: "14m ago" },
  { icon: AlertCircle, color: "#ff9f0a", bg: "rgba(255,159,10,0.1)", text: "Rate limit threshold reached", sub: "OpenAI provider · Auto-scaled", time: "28m ago" },
  { icon: Zap, color: "#00d4ff", bg: "rgba(0,212,255,0.1)", text: "AI model configuration updated", sub: "claude-sonnet-4-6 · Primary", time: "1h ago" },
  { icon: Shield, color: "#7c5cfc", bg: "rgba(124,92,252,0.1)", text: "Security audit completed", sub: "0 critical, 2 low severity", time: "3h ago" },
];

// ─── CLIENT-ONLY BADGE COUNTS ────────────────────────────────────────────────
// Returns null until after first client render, preventing any SSR/SSG mismatch.
// In production this would be replaced with a real data fetch (SWR, React Query, etc.)
function useBadgeCounts() {
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    // Simulate async fetch — replace with real API call
    const controller = new AbortController();
    Promise.resolve({ users: "2.4k", messages: "12" }).then(data => {
      if (!controller.signal.aborted) setCounts(data);
    });
    return () => controller.abort();
  }, []);
  return counts; // null until hydrated — callers must guard against this
}



function SkeletonBlock({ w = "100%", h = 20, radius = 8 }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: radius }} />;
}

function SVGChart() {
  const data = [42, 68, 55, 82, 71, 95, 88, 120, 104, 135, 118, 158, 142, 180, 165, 200, 188, 220, 195, 240, 225, 260, 248, 280];
  const W = 600, H = 180;
  const max = Math.max(...data);
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * W, y: H - (v / max) * (H - 20) }));
  const path = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `C${pts[i-1].x + 20},${pts[i-1].y} ${p.x - 20},${p.y} ${p.x},${p.y}`)).join(" ");
  const area = path + ` L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c5cfc" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7c5cfc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c5cfc" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={area} fill="url(#chartGrad)" />
      <path d={path} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" filter="url(#glow)" />
      {pts.slice(-1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={5} fill="#7c5cfc" stroke="#fff" strokeWidth={2} filter="url(#glow)" />
      ))}
    </svg>
  );
}

function DonutChart({ value = 72, color = "#7c5cfc", label }) {
  const r = 36, cx = 44, cy = 44;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={88} height={88} style={{ transform: "rotate(-90deg)" }}>
      <defs>
        <linearGradient id={`dg-${label}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#dg-${label})`} strokeWidth={9}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

function AuthIsland({ authed = true }) {
  return (
    <div className="auth-island">
      <div className="auth-avatar">
        {authed ? "A" : <LogIn size={14} />}
      </div>
      <span className="auth-name" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
        {authed ? "Arman" : "Login"}
      </span>
    </div>
  );
}

function NavItem({ route, active, collapsed, onClick, badge }) {
  const Icon = route.icon;
  return (
    <div className={`nav-item${active ? " active" : ""}`} onClick={onClick} title={collapsed ? route.label : undefined}>
      <Icon size={18} className="nav-icon" strokeWidth={active ? 2.5 : 1.8} />
      <span className="nav-label">{route.label}</span>
      {/* Badge only renders if a value was passed — never from static data */}
      {badge != null && <span className="nav-badge">{badge}</span>}
    </div>
  );
}

function Sidebar({ active, setActive, collapsed, setCollapsed }) {
  // Null until client hydration — badges never appear in SSR output
  const badgeCounts = useBadgeCounts();
  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}
      style={{ width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width-expanded)" }}>

      {/* Brand — toggle first so it sits left of logo/name; brand-group fades when collapsed */}
      <div className="sidebar-brand">
        <div className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
        </div>
        <div className="brand-group">
          <div className="brand-icon glow-pulse">
            <Sparkles size={15} color="white" strokeWidth={2} />
          </div>
          <div className="brand-text">AI MATRX</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Platform</div>
        {NAV_PRIMARY.map(r => (
          <NavItem key={r.id} route={r} active={active === r.id} collapsed={collapsed}
            onClick={() => setActive(r.id)}
            badge={badgeCounts?.[r.id] ?? null} />
        ))}
        <div className="divider" style={{ margin: "10px 0" }} />
        <div className="nav-section-label">Infrastructure</div>
        {NAV_SECONDARY.map(r => (
          <NavItem key={r.id} route={r} active={active === r.id} collapsed={collapsed}
            onClick={() => setActive(r.id)}
            badge={badgeCounts?.[r.id] ?? null} />
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <NavItem route={{ id: "settings", label: "Settings", icon: Settings }}
          active={active === "settings"} collapsed={collapsed} onClick={() => setActive("settings")} />
      </div>
    </aside>
  );
}

function Header({ active, onMenuToggle }) {
  const title = [...NAV_PRIMARY, ...NAV_SECONDARY, { id: "settings", label: "Settings" }]
    .find(r => r.id === active)?.label ?? "Dashboard";

  return (
    <header className="header">

      {/* LEFT: hamburger (mobile only — desktop left is empty, sidebar owns its own toggle) */}
      <div className="header-left">
        <div className="mobile-menu-btn icon-btn" onClick={onMenuToggle}>
          <Menu size={16} />
        </div>
      </div>

      {/* CENTER: context (title + status) + search — truly centered via grid */}
      <div className="header-center">
        {/* Context block — hidden on mobile when search expands */}
        <div className="header-context">
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
            {title}
          </span>
          <span style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, color: "var(--green)",
            background: "rgba(0,232,122,0.08)", border: "1px solid rgba(0,232,122,0.15)",
            padding: "2px 8px", borderRadius: 99,
            fontFamily: "JetBrains Mono, monospace", fontWeight: 600,
            whiteSpace: "nowrap",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)",
              boxShadow: "0 0 6px var(--green)", display: "inline-block", flexShrink: 0 }} />
            All systems nominal
          </span>
        </div>

        {/* Search — full bar on desktop, icon→expand on mobile */}
        <div className="search-bar">
          <Search size={14} color="var(--text-tertiary)" strokeWidth={2} style={{ flexShrink: 0 }} />
          <input placeholder="Search anything..." />
          <kbd className="search-kbd">⌘K</kbd>
        </div>
      </div>

      {/* RIGHT: bell + auth */}
      <div className="header-right">
        <div className="icon-btn has-dot">
          <Bell size={15} />
        </div>
        <AuthIsland authed={true} />
      </div>

    </header>
  );
}

function MobileDock({ active, setActive }) {
  return (
    <nav className="mobile-dock">
      {DOCK_ITEMS.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.id} className={`dock-item${active === item.id ? " active" : ""}`}
            onClick={() => setActive(item.id)}
            title={item.label}>
            <Icon size={22} strokeWidth={active === item.id ? 2.5 : 1.8} />
          </div>
        );
      })}
    </nav>
  );
}

function MobileDrawer({ open, onClose, active, setActive }) {
  return (
    <>
      <div className={`drawer-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`drawer-panel${open ? " open" : ""}`}>
        <div className="sidebar-brand" style={{ justifyContent: "flex-start" }}>
          <div className="icon-btn" style={{ flexShrink: 0 }} onClick={onClose}>
            <X size={16} />
          </div>
          <div className="brand-group" style={{ opacity: 1, maxWidth: "none" }}>
            <div className="brand-icon"><Sparkles size={15} color="white" /></div>
            <div className="brand-text">AI MATRX</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label" style={{ opacity: 1 }}>Platform</div>
          {NAV_PRIMARY.map(r => (
            <NavItem key={r.id} route={r} active={active === r.id} collapsed={false}
              onClick={() => { setActive(r.id); onClose(); }} />
          ))}
          <div className="divider" style={{ margin: "10px 0" }} />
          <div className="nav-section-label" style={{ opacity: 1 }}>Infrastructure</div>
          {NAV_SECONDARY.map(r => (
            <NavItem key={r.id} route={r} active={active === r.id} collapsed={false}
              onClick={() => { setActive(r.id); onClose(); }} />
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavItem route={{ id: "settings", label: "Settings", icon: Settings }}
            active={active === "settings"} collapsed={false} onClick={() => { setActive("settings"); onClose(); }} />
        </div>
      </div>
    </>
  );
}

// ── Dashboard Content ──────────────────────────────────────────────────────
function DashboardContent() {
  const [tableLoaded, setTableLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTableLoaded(true), 800); return () => clearTimeout(t); }, []);

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">February 27, 2026 · All 20 apps healthy</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="icon-btn"><Filter size={15} /></div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--violet)", borderRadius: 12, padding: "9px 16px",
            cursor: "pointer", fontSize: 13, fontWeight: 600, color: "white",
            boxShadow: "0 0 20px var(--violet-glow)",
            transition: "transform 0.15s var(--spring), box-shadow 0.15s"
          }}>
            <Plus size={14} /> New App
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {KPI_DATA.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="card card-interactive kpi-card fade-up"
              style={{ animationDelay: `${i * 0.07}s`, "--accent-color": k.color }}>
              <div className="kpi-icon-wrap" style={{ background: `${k.color}18`, borderColor: `${k.color}25` }}>
                <Icon size={18} color={k.color} strokeWidth={2} />
              </div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
              <div className={`kpi-trend ${k.up ? "up" : "down"}`}>
                {k.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {k.trend} vs last month
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + Activity */}
      <div className="chart-area">
        {/* Main Chart */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>Revenue Overview</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Last 24 data points</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["1W","1M","3M","1Y"].map((t, i) => (
                <div key={t} style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: i === 1 ? "var(--violet)" : "var(--glass-3)",
                  color: i === 1 ? "white" : "var(--text-secondary)",
                  border: "1px solid " + (i === 1 ? "var(--violet)" : "var(--border)")
                }}>{t}</div>
              ))}
            </div>
          </div>
          {/* Y-axis labels */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between",
              fontSize: 10, color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace",
              paddingBottom: 4, flexShrink: 0 }}>
              <span>$280k</span><span>$210k</span><span>$140k</span><span>$70k</span><span>$0</span>
            </div>
            <div style={{ flex: 1, height: 180 }}><SVGChart /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8,
            fontSize: 10, color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>
            {["Feb 1","Feb 5","Feb 10","Feb 15","Feb 20","Feb 25","Feb 27"].map(d => <span key={d}>{d}</span>)}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            {[["Total Revenue", "#7c5cfc"], ["Projections", "#00d4ff"]].map(([l, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 24, height: 2, borderRadius: 2, background: c }} />
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card" style={{ padding: 22 }}>
          <div className="section-title">Live Activity</div>
          {ACTIVITY.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className="activity-item">
                <div className="activity-dot" style={{ background: a.bg }}>
                  <Icon size={15} color={a.color} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)",
                    marginBottom: 2, lineHeight: 1.4 }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.sub}</div>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0,
                  fontFamily: "JetBrains Mono, monospace" }}>{a.time}</div>
              </div>
            );
          })}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: "var(--violet)", cursor: "pointer", fontWeight: 600 }}>
              View all events →
            </span>
          </div>
        </div>
      </div>

      {/* Performance Rings */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Infrastructure Health</div>
          <div className="tag"><Signal size={10} /> Live</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "API Uptime", value: 99.97, color: "#00e87a" },
            { label: "DB Health", value: 87, color: "#7c5cfc" },
            { label: "Cache Hit", value: 94, color: "#00d4ff" },
            { label: "Edge CDN", value: 78, color: "#ff9f0a" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <DonutChart value={value} color={color} label={label} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", flexDirection: "column", transform: "rotate(90deg) translateY(2px)" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
                    fontFamily: "JetBrains Mono, monospace", transform: "rotate(0)" }}>
                    {value}%
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textAlign: "center" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ padding: "20px 22px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Applications</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="tag" style={{ cursor: "pointer" }}><Filter size={10} /> Filter</div>
            <div className="tag" style={{ cursor: "pointer", background: "var(--violet-dim)",
              borderColor: "rgba(124,92,252,0.3)", color: "var(--violet)" }}>
              <Plus size={10} /> Add App
            </div>
          </div>
        </div>
        <Suspense fallback={
          <div style={{ padding: "0 22px 22px" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: "flex", gap: 16, padding: "14px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                <SkeletonBlock w={32} h={32} radius={8} />
                <SkeletonBlock w={140} h={12} />
                <div style={{ flex: 1 }} />
                <SkeletonBlock w={60} h={22} radius={99} />
              </div>
            ))}
          </div>
        }>
          {tableLoaded ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>API Requests</th>
                  <th>Uptime</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {TABLE_DATA.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                          background: `hsl(${i * 45 + 240}, 70%, 45%)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 800, color: "white",
                          fontFamily: "JetBrains Mono, monospace"
                        }}>{row.avatar}</div>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>{row.name}</span>
                      </div>
                    </td>
                    <td><div className="tag">{row.type}</div></td>
                    <td>
                      <div className={`status-pill status-${row.status}`}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%",
                          background: row.status === "active" ? "var(--green)" : "var(--amber)" }} />
                        {row.status}
                      </div>
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>{row.users}</td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>{row.requests}</td>
                    <td>
                      {row.uptime !== "—" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 60 }}>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: row.uptime }} />
                            </div>
                          </div>
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                            color: "var(--green)", fontWeight: 600, flexShrink: 0 }}>{row.uptime}</span>
                        </div>
                      ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                    </td>
                    <td>
                      <div className="icon-btn" style={{ width: 28, height: 28 }}>
                        <MoreHorizontal size={13} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "0 22px 22px" }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 16, padding: "14px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                  <SkeletonBlock w={32} h={32} radius={9} />
                  <SkeletonBlock w={i % 2 === 0 ? 160 : 120} h={12} />
                  <div style={{ flex: 1 }} />
                  <SkeletonBlock w={70} h={22} radius={99} />
                </div>
              ))}
            </div>
          )}
        </Suspense>
        {tableLoaded && (
          <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: 12, color: "var(--text-secondary)" }}>
            <span>Showing 6 of 20 applications</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[1,2,3,"...","12"].map((p, i) => (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: p === 1 ? "var(--violet)" : "var(--glass-3)",
                  color: p === 1 ? "white" : "var(--text-secondary)",
                  border: "1px solid " + (p === 1 ? "transparent" : "var(--border)")
                }}>{p}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderContent({ route }) {
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "60vh", gap: 16, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--violet-dim)",
        border: "1px solid rgba(124,92,252,0.2)", display: "flex", alignItems: "center",
        justifyContent: "center", boxShadow: "0 0 32px var(--violet-glow)" }}>
        <Sparkles size={28} color="var(--violet)" />
      </div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{route} Module</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 320 }}>
          This section is under active development. The full module will be available in the next sprint.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <div className="status-pill status-pending">In Progress</div>
        <div className="tag"><Clock size={10} /> Sprint 12</div>
      </div>
    </div>
  );
}

// ─── ROOT SHELL ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Active route display name
  const routeLabel = [...NAV_PRIMARY, ...NAV_SECONDARY, { id: "settings", label: "Settings" }]
    .find(r => r.id === active)?.label ?? "Dashboard";

  return (
    <>
      {/* Inject global styles */}
      <style>{STYLES}</style>

      {/* Background */}
      <div className="bg-mesh" />
      <div className="bg-noise" />

      {/* App Shell */}
      <div className={`app-shell${collapsed ? " collapsed" : ""}`} style={{ position: "relative", zIndex: 2 }}>
        {/* Sidebar (desktop) */}
        <Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />

        {/* Header */}
        <Header active={active} onMenuToggle={() => setDrawerOpen(true)} />

        {/* Main content */}
        <main className="main-content">
          {active === "dashboard" ? (
            <DashboardContent />
          ) : (
            <PlaceholderContent route={routeLabel} />
          )}
        </main>

        {/* Mobile dock */}
        <MobileDock active={active} setActive={setActive} />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        active={active} setActive={setActive} />
    </>
  );
}