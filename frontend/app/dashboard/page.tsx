// src/app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { TrendingUp, Wallet, TrendingDown, AlertTriangle, Package, CheckCircle2, Bot, Calendar, Download, User as UserIcon, X, Target } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/axios";

const formatNaira = (amount: number) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);
};

interface LowStockAlert {
  item_name: string;
  total_base_stock: number;
}
interface AiLog {
  message_content: string;
  sender_type: string; 
  created_at: string;
  sender_name: string; 
}

// 🚀 NEW: Smart Audit Badge Generator
const getActivityStyling = (message: string) => {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('sale') || lowerMsg.includes('sold')) {
    return { color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200', label: 'Sale' };
  } else if (lowerMsg.includes('expense') || lowerMsg.includes('spent') || lowerMsg.includes('transport')) {
    return { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200', label: 'Expense' };
  } else if (lowerMsg.includes('reversed') || lowerMsg.includes('cancelled')) {
    return { color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200', label: 'Reversal' };
  } else if (lowerMsg.includes('created') || lowerMsg.includes('added')) {
    return { color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200', label: 'System' };
  }
  return { color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200', label: 'Log' };
};

export default function DashboardHome() {
  const { business, user } = useAuthStore();
  
  const [dateFilter, setDateFilter] = useState("7"); 
  
  // 🚀 FIX: Updated state to match the new backend structure
  const [stats, setStats] = useState({ 
    totalRevenue: 0, grossProfit: 0, operatingExpenses: 0, netProfit: 0, 
    lowStockAlerts: [] as LowStockAlert[], chartData: [] 
  });
  
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("hasSeenWelcome")) {
      setShowWelcomeModal(true);
      sessionStorage.setItem("hasSeenWelcome", "true");
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!business?.id || !user?.id) return;
      setIsLoading(true);
      try {
        const res = await api.get(`/analytics/dashboard?businessId=${business.id}&days=${dateFilter}`);
        setStats(res.data.data);
        setAiLogs(res.data.data.activityLogs); 
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [business?.id, user?.id, dateFilter]); 

  const container: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  if (isLoading && stats.totalRevenue === 0) {
    return <div className="flex h-[600px] items-center justify-center text-slate-500">Syncing with ledger...</div>;
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-10">
      
      {/* Header with Functional Filter */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Track your store&apos;s performance and system activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 outline-none shadow-sm cursor-pointer"
            >
              <option value="1">Today</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
            <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </motion.div>

      {/* 🚀 FIX: Upgraded 4-Card Enterprise Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Total Revenue */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-600">Total Revenue</h3>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><Wallet className="w-5 h-5 text-blue-600" /></div>
          </div>
          <span className="text-3xl font-bold text-slate-900">{formatNaira(stats.totalRevenue)}</span>
          <p className="text-xs text-slate-400 mt-2 font-medium">Money collected from all sales</p>
        </motion.div>

        {/* Gross Profit */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-600">Gross Profit</h3>
            <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center"><Target className="w-5 h-5 text-teal-600" /></div>
          </div>
          <span className="text-3xl font-bold text-slate-900">{formatNaira(stats.grossProfit)}</span>
          <p className="text-xs text-slate-400 mt-2 font-medium">Revenue minus item supplier costs</p>
        </motion.div>

        {/* Operating Expenses */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-600">OpEx (Expenses)</h3>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-500" /></div>
          </div>
          <span className="text-3xl font-bold text-slate-900">{formatNaira(stats.operatingExpenses)}</span>
          <p className="text-xs text-slate-400 mt-2 font-medium">Transport, fuel, subscriptions, e.t.c</p>
        </motion.div>

        {/* Net Profit */}
        <motion.div variants={item} className="bg-emerald-600 rounded-2xl p-6 shadow-md relative overflow-hidden">
           {/* Abstract Background Graphic for the "Hero" card */}
           <div className="absolute -right-6 -top-6 w-24 h-24 bg-white opacity-10 rounded-full"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-sm font-bold text-emerald-100">True Net Profit</h3>
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"><TrendingUp className="w-5 h-5 text-white" /></div>
          </div>
          <span className="text-3xl font-bold text-white relative z-10">{formatNaira(stats.netProfit)}</span>
          <p className="text-[11px] text-emerald-100 mt-2 font-medium relative z-10">Actual take-home profit (grossprofit - expense)</p>
        </motion.div>

      </div>

      {/* Dynamic Main Chart */}
      <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900">Revenue Overview</h2>
        </div>
        <div className="h-[300px] w-full">
          {stats.chartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400">No revenue data for this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `₦${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number | string | readonly (number | string)[] | undefined) => {
                    const numericValue = Array.isArray(value) ? value[0] : value;
                    return [formatNaira(Number(numericValue || 0)), "Revenue"];
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Alerts */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-yellow-500" /></div>
            <h2 className="text-lg font-bold text-slate-900">Low Stock Alerts</h2>
          </div>
          <div className="space-y-2">
            {stats.lowStockAlerts.length === 0 ? (
               <p className="text-sm text-slate-500 py-4">All stock levels are healthy! ✅</p>
            ) : (
              stats.lowStockAlerts.map((alert: LowStockAlert, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><Package className="w-5 h-5 text-slate-500" /></div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{alert.item_name}</p>
                      <p className="text-xs text-red-600 font-medium mt-0.5">{alert.total_base_stock} remaining</p>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg">Restock</button>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Live System Activity */}
        <motion.div variants={item} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col h-[350px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center"><Bot className="w-4 h-4 text-emerald-600" /></div>
              <h2 className="text-lg font-bold text-slate-900">Live System Activity</h2>
            </div>
            <button onClick={() => setIsActivityModalOpen(true)} className="text-sm font-medium text-emerald-600 hover:underline">View All</button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-0 relative before:absolute before:inset-y-0 before:left-[15px] before:w-px before:bg-slate-200">
            {aiLogs.length === 0 ? (
              <p className="text-sm text-slate-500 pl-10 py-2">No activity yet.</p>
            ) : (
              aiLogs.slice(0, 5).map((log, i) => {
                const style = getActivityStyling(log.message_content);
                return (
                  <div key={i} className="relative pl-10 py-3 group">
                    {/* The Timeline Dot (Mathematically centered on the 15px line) */}
                      <div className={`absolute left-4.5 -translate-x-1/2 top-4 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center z-10 transition-colors ${style.border}`}>
                        <Bot className={`w-4 h-4 ${style.color}`} />
                      </div>
                    
                    {/* The Log Card */}
                    <div className={`rounded-xl p-3 border transition-all shadow-sm ${style.bg} ${style.border}`}>
                      <div className="flex items-center justify-between mb-1">
                        {/* 🚀 FIX: Now it strictly shows the employee's name who triggered the action! */}
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <UserIcon className="w-3 h-3 text-slate-500" />
                          {log.sender_name || 'System Admin'}
                        </span>
                        
                        {/* 🚀 NEW: The Visual Category Badge */}
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/60 ${style.color}`}>
                          {style.label}
                        </span>
                      </div>
                      
                      <p className="text-sm font-medium text-slate-800 leading-snug">{log.message_content}</p>
                      
                      <p className="text-[10px] font-semibold text-slate-500 mt-2 uppercase tracking-wide">
                        {new Date(log.created_at).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Activity Full View Modal */}
      <AnimatePresence>
        {isActivityModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsActivityModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg h-[80vh] flex flex-col border border-slate-200">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">Full Activity Log</h3>
                <button onClick={() => setIsActivityModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-0 relative before:absolute before:inset-y-0 before:left-[15px] before:w-px before:bg-slate-200">
              {aiLogs.length === 0 ? (
                <p className="text-sm text-slate-500 pl-10 py-2">No activity yet.</p>
              ) : (
                aiLogs.slice(0, 5).map((log, i) => {
                  const style = getActivityStyling(log.message_content);
                  return (
                    <div key={i} className="relative pl-10  py-3  group">
                      {/* The Timeline Dot (Mathematically centered on the 15px line) */}
                      <div className={`absolute left-4.5 -translate-x-1/2 top-4 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center z-10 transition-colors ${style.border}`}>
                        <Bot className={`w-4 h-4 ${style.color}`} />
                      </div>
                        
                      {/* The Log Card */}
                      <div className={`rounded-xl p-3 border transition-all shadow-sm ${style.bg} ${style.border}`}>
                        <div className="flex items-center justify-between mb-1">
                          {/* 🚀 FIX: Now it strictly shows the employee's name who triggered the action! */}
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <UserIcon className="w-3 h-3 text-slate-500" />
                            {log.sender_name || 'System Admin'}
                          </span>
                          
                          {/* 🚀 NEW: The Visual Category Badge */}
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/60 ${style.color}`}>
                            {style.label}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium text-slate-800 leading-snug">{log.message_content}</p>
                        
                        <p className="text-[10px] font-semibold text-slate-500 mt-2 uppercase tracking-wide">
                          {new Date(log.created_at).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* THE INVENTORY PUSH MODAL */}
      <AnimatePresence>
        {showWelcomeModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowWelcomeModal(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white rounded-4xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <button 
                onClick={() => setShowWelcomeModal(false)} 
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-white backdrop-blur-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="h-48 w-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-800 relative overflow-hidden flex items-center justify-center">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                 <Package className="w-24 h-24 text-white/20 absolute -right-4 -bottom-4 transform rotate-12" />
                 <h2 className="text-3xl font-extrabold text-white z-10 tracking-tight text-center px-6 leading-snug">
                   Your AI is ready.<br/> Let&apos;s stock the shelves.
                 </h2>
              </div>

              <div className="p-8 text-center">
                <p className="text-slate-600 text-lg leading-relaxed mb-8">
                  Vedly AI needs to know what you sell before it can help you track sales on WhatsApp. Import your products now and let the magic begin.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button 
                    onClick={() => {
                      setShowWelcomeModal(false);
                      window.location.href = '/dashboard/inventory'; 
                    }} 
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-xl font-semibold text-base transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    <Package className="w-5 h-5" />
                    Go To Inventory
                  </button>
                  <button 
                    onClick={() => setShowWelcomeModal(false)} 
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-6 py-3.5 rounded-xl font-semibold text-base transition-all"
                  >
                    Explore Dashboard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}