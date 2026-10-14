import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Menu, X, LayoutDashboard, Calendar, Users, Award, FileText, ShieldCheck, Building2, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { Button } from './ui/Button';
import { cn } from '@/lib/cn';
import { AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/participants', label: 'Participants', icon: Users },
  { href: '/certificates', label: 'Certificates', icon: Award },
];

// Council leads manage their own committee here; super admins manage everyone.
const usersNavItems = [
  { href: '/users', label: 'Users', icon: FileText },
];

// Only the super admin manages councils and reviews incoming Council Lead requests.
const superAdminNavItems = [
  { href: '/councils', label: 'Councils', icon: Building2 },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
];

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const { user, clear } = useAuth();
  const location = useLocation();

  const handleThemeToggle = () => {
    const root = document.documentElement;
    const newDark = !isDark;
    if (newDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setIsDark(newDark);
  };

  const handleLogout = () => {
    clear();
    window.location.href = '/login';
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const canManageUsers = isSuperAdmin || user?.role === 'council_lead';

  const currentNav = [
    ...navItems,
    ...(canManageUsers ? usersNavItems : []),
    ...(isSuperAdmin ? superAdminNavItems : []),
  ];

  return (
    <div className="flex h-screen bg-bg">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ duration: 0.2 }}
            className="w-64 bg-surface border-r border-border flex flex-col"
          >
            {/* Logo */}
            <div className="p-6 border-b border-border">
              <h1 className="text-xl font-bold text-primary">Tech Council</h1>
            </div>

            {/* Nav items */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {currentNav.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2 rounded-md transition-colors',
                    location.pathname === item.href
                      ? 'bg-primary text-primary-fg'
                      : 'text-text hover:bg-surface-2'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border space-y-2">
              <div className="text-sm">
                <p className="font-medium text-text">{user?.name}</p>
                <p className="text-xs text-muted capitalize">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleThemeToggle} className="flex-1">
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleLogout} className="flex-1">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-16 bg-surface border-b border-border flex items-center px-4 gap-4">
          <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
