"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Seal, Wordmark } from '@/components/brand/wordmark';
import { IconArrowLeft, IconArrowRight, IconBuilding, IconCalendar, IconHome, IconInbox, IconMore, IconSettings, IconPlus } from '@/components/ui/icons';

const ITEMS = [
  { href: '/dashboard', label: 'Home', Icon: IconHome },
  { href: '/dashboard/properties', label: 'Properties', Icon: IconBuilding },
  { href: '/dashboard/inbox', label: 'Inbox', Icon: IconInbox, upcoming: true },
  { href: '/dashboard/calendar', label: 'Calendar', Icon: IconCalendar },
  { href: '/dashboard/settings', label: 'Settings', Icon: IconSettings },
];
export function DashboardNav({ organizationName, userEmail }: { organizationName?: string; userEmail?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let frame: number | undefined;
    try { if (localStorage.getItem('qayam-sidebar') === 'collapsed') frame = requestAnimationFrame(() => setCollapsed(true)); } catch { /* Storage can be disabled. */ }
    return () => { if (frame !== undefined) cancelAnimationFrame(frame); };
  }, []);
  function toggle() { setCollapsed(!collapsed); try { localStorage.setItem('qayam-sidebar', collapsed ? 'expanded' : 'collapsed'); } catch {} }
  const active = (href: string) => href === '/dashboard' ? pathname === href : !!pathname?.startsWith(href);
  return <>
    <nav data-testid="dashboard-sidebar" aria-label="Main" className={`workspace-sidebar hidden md:flex ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar-brand"><Link href="/dashboard" aria-label="Qayam home">{collapsed ? <Seal /> : <Wordmark />}</Link><button type="button" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} className="sidebar-toggle">{collapsed ? <IconArrowRight /> : <IconArrowLeft />}</button></div>
      <div className="sidebar-org"><span className="org-avatar">{(organizationName || 'Q').charAt(0)}</span><span className="sidebar-label"><strong>{organizationName || 'Your workspace'}</strong><small>Host workspace</small></span></div>
      <p className="sidebar-section sidebar-label">Workspace</p>
      <div className="sidebar-links">{ITEMS.map(({ href, label, Icon, upcoming }) => upcoming ? <div key={href} className="sidebar-link unavailable" title={`${label} is coming soon`} aria-disabled="true"><Icon /><span className="sidebar-label">{label}</span><small className="sidebar-label">Soon</small></div> : <Link key={href} href={href} title={collapsed ? label : undefined} aria-label={label} aria-current={active(href) ? 'page' : undefined} className={`sidebar-link ${active(href) ? 'active' : ''}`}><Icon /><span className="sidebar-label">{label}</span></Link>)}</div>
      <div className="sidebar-tip sidebar-label"><span className="text-accent"><IconBuilding /></span><strong>A place worth sharing.</strong><p>Bring your next property into your workspace.</p><Link href="/dashboard/properties/new">Add property <IconPlus className="size-4" /></Link></div>
      <Link href="/dashboard/settings/account" className="sidebar-account" aria-label="Account settings" title={userEmail || 'Account settings'}><span className="account-avatar">{(userEmail || 'H').charAt(0).toUpperCase()}</span><span className="sidebar-label"><strong>Your account</strong><small>{userEmail || 'Manage your profile'}</small></span><IconSettings className="size-4 sidebar-label" /></Link>
    </nav>
    <nav data-testid="dashboard-tabbar" aria-label="Main" className="workspace-mobile-nav md:hidden">{[{ href:'/dashboard',label:'Home',Icon:IconHome },{href:'/dashboard/properties',label:'Properties',Icon:IconBuilding},{href:'/dashboard/calendar',label:'Calendar',Icon:IconCalendar},{href:'/dashboard/settings',label:'More',Icon:IconMore}].map(({href,label,Icon})=><Link href={href} key={href} aria-current={active(href)?'page':undefined}><Icon /><span>{label}</span></Link>)}</nav>
  </>;
}

export function WorkspaceHeader({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();
  const section = pathname?.includes('/settings') ? 'Settings' : pathname?.includes('/properties') ? 'Properties' : 'Overview';
  return <header className="workspace-topbar"><div className="workspace-breadcrumb"><span className="md:hidden"><Seal className="size-7" /></span><span className="hidden sm:inline">Workspace</span><span className="hidden sm:inline text-ruling">/</span><strong>{section}</strong></div><div className="topbar-actions"><span className="hidden sm:block">{organizationName}</span><Link href="/dashboard/settings/account" aria-label="Account settings" className="topbar-avatar">{organizationName.charAt(0).toUpperCase()}</Link></div></header>;
}
