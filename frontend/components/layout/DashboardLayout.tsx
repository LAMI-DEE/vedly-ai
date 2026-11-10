"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, Package, Bot, Users, FileText, Settings, 
  HelpCircle, LogOut, Menu, Bell, ChevronDown, Box, X 
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/axios";
import Image from "next/image";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false); // To prevent hydration mismatch
  const pathname = usePathname();
  const router = useRouter();
  
  // Pull our live user data from the Zustand vault
  const { user, business, isAuthenticated, logout } = useAuthStore();

  // Set isMounted to true after the component mounts
  useEffect(() => {
    // We wrap it in a setTimeout to defer the update to the next tick.
    // This perfectly satisfies the strict linter while still fixing our flash!
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    
    // Clean up the timer just in case the component unmounts instantly
    return () => clearTimeout(timer);
  }, []);

  // Security Guard: If they aren't logged in, kick them to the login page
  useEffect(() => {
    if (isMounted &&!isAuthenticated) {
      router.push("/");
    }
  }, [isMounted,isAuthenticated, router]);
  if (!isMounted || !isAuthenticated) return null; // Prevent rendering until we know the auth status

  const handleLogout = async () => {
    try {
      await api.post("/logout"); // Destroys the backend cookie
    } catch (err) {
      console.error("Logout failed", err);
    }
    logout(); // Clears Zustand localStorage
    router.push("/");
  };

  // Get user initials (e.g., "Iya Bose" -> "IB")
  const initials = user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "US";

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Inventory", href: "/dashboard/inventory", icon: Package },
    { name: "Team", href: "/dashboard/team", icon: Users },
    { name: "Financials", href: "/dashboard/financials", icon: FileText },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  if (user?.role_type === "SUPER_ADMIN") {
    navLinks.push({ name: "Admin Core", href: "/dashboard/admin", icon: Bot });
  }
  // Dynamically set the page title based on the URL
  const currentPageName = navLinks.find(link => link.href === pathname)?.name || "Overview";

  // Prevent rendering the dashboard flash before redirecting if not authenticated
  if (!isAuthenticated) return null; 

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar */}
      <motion.aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
              <Image 
                  src="/newvedly-icon.png" // 👈 Put your Vedly logo in the 'public' folder
                  alt="Vedly Logo" 
                  width={32} 
                  height={32} 
                  className=" object-cover p-1"
              />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">Vedly AI</span>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-slate-600" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 relative">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <button
                key={link.name}
                onClick={() => { router.push(link.href); setIsMobileMenuOpen(false); }}
                className={`w-full relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors group ${isActive ? "text-emerald-700" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
              >
                {/* Liveliness: The floating active background pill */}
                {isActive && (
                  <motion.div layoutId="activeNav" className="absolute inset-0 bg-emerald-50 rounded-lg" initial={false} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                )}
                <Icon className={`w-5 h-5 relative z-10 ${isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                <span className="relative z-10">{link.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors group">
            <HelpCircle className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
            Help & Support
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 font-medium text-sm transition-colors group">
            <LogOut className="w-5 h-5 text-red-400 group-hover:text-red-600" />
            Sign Out
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-slate-900">{currentPageName}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
            </button>

            <div className="hidden sm:block w-px h-6 bg-slate-200 mx-2"></div>

            {/* Live User Profile */}
            <button className="flex items-center gap-3 p-1.5 pr-2 rounded-lg hover:bg-slate-50 transition-colors text-left group">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold border border-emerald-200 group-hover:scale-105 transition-transform">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-900 leading-none mb-1">{user?.name}</p>
                <p className="text-xs text-slate-500 leading-none">{business?.name}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block ml-1 group-hover:text-slate-600" />
            </button>
          </div>
        </header>

        {/* The dynamic page content renders exactly here */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}