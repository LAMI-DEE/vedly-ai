"use client";

import React, { useEffect, useState } from "react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { Cpu, DownloadCloud, Store, Activity, Bot, Users, Search, Eye, X, ShieldAlert, CheckCircle2, TrendingUp } from "lucide-react";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
// import { isAxiosError } from "axios";

interface Tenant {
  business_id: string;
  business_name: string;
  owner_name: string;
  owner_phone: string;
  status: "ACTIVE" | "SUSPENDED";
  created_at: string;
  staff_count: string | number;
  total_volume: string | number;
}

interface AdminMetrics {
  totalBusinesses: number;
  totalVolume: number;
  totalUsers: number;
  activeAgents: number;
}

interface AdminData {
  metrics: AdminMetrics;
  tenants: Tenant[];
}

const formatNaira = (amount: number | string) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(Number(amount));
};

export default function SuperAdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  
  const [data, setData] = useState<AdminData>({ 
    metrics: { totalBusinesses: 0, totalVolume: 0, totalUsers: 0, activeAgents: 0 }, 
    tenants: [] 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchAdminData = async () => {
    try {
      const res = await api.get('/admin/metrics');
      setData(res.data.data);
    } catch (error) {
      console.error("Admin fetch failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role_type !== "SUPER_ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchAdminData();
  }, [user, router]);

  // Search Filter Logic
  const filteredTenants = data.tenants.filter(t => 
    t.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.owner_phone.includes(searchQuery)
  );

  // Toggle Business Status
  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    setIsUpdating(true);
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await api.put('/admin/tenant/status', { targetBusinessId: tenantId, newStatus });
      // Update local state and selected modal state
      setData(prev => ({ ...prev, tenants: prev.tenants.map(t => t.business_id === tenantId ? { ...t, status: newStatus } : t) }));
      if (selectedTenant) setSelectedTenant({ ...selectedTenant, status: newStatus });
    } catch (error) {
      console.error("Failed to toggle business status", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Export to CSV Logic
  const exportToCSV = () => {
    const headers = ["Business ID,Business Name,Owner Name,Phone Number,Status,Staff Count,Total Volume (NGN),Date Joined"];
    const csvData = data.tenants.map(t => 
      `${t.business_id},"${t.business_name}","${t.owner_name}",${t.owner_phone},${t.status},${t.staff_count},${t.total_volume},${new Date(t.created_at).toLocaleDateString()}`
    );
    const blob = new Blob([[...headers, ...csvData].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradeflow_platform_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const container: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  if (isLoading) return <div className="flex justify-center items-center h-150 text-slate-500">Initializing Command Center...</div>;

  return (
    <div className="bg-slate-950 text-slate-400 min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8 p-4 sm:p-6 lg:p-8">
      <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <motion.header variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-800/60 pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
              <Cpu className="w-8 h-8 text-blue-500" />
              TradeFlow System Core
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mt-2 font-medium">Global platform metrics and tenant management.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-800 shadow-inner">
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
              <span className="text-sm font-medium text-slate-300">System Status: Operational</span>
            </div>
            <button onClick={exportToCSV} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white transition-all text-sm font-medium">
              <DownloadCloud className="w-4 h-4" /> Export Logs
            </button>
          </div>
        </motion.header>

        {/* Global Metrics */}
        <motion.section variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900 rounded-2xl p-6 border-t-2 border-t-blue-500 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div><p className="text-slate-400 text-sm font-medium mb-1">Total SMEs</p><h3 className="text-3xl font-bold text-white">{data.metrics.totalBusinesses}</h3></div>
              <div className="p-2.5 bg-slate-800 rounded-lg text-blue-400"><Store className="w-5 h-5" /></div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-2xl p-6 border-t-2 border-t-emerald-500 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div><p className="text-slate-400 text-sm font-medium mb-1">Total Processed Volume</p><h3 className="text-3xl font-bold text-white">{formatNaira(data.metrics.totalVolume)}</h3></div>
              <div className="p-2.5 bg-slate-800 rounded-lg text-emerald-400"><Activity className="w-5 h-5" /></div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-2xl p-6 border-t-2 border-t-blue-500 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div><p className="text-slate-400 text-sm font-medium mb-1">Active AI Agents</p><h3 className="text-3xl font-bold text-white">{data.metrics.activeAgents}</h3></div>
              <div className="p-2.5 bg-slate-800 rounded-lg text-blue-400"><Bot className="w-5 h-5" /></div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-2xl p-6 border-t-2 border-t-emerald-500 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div><p className="text-slate-400 text-sm font-medium mb-1">Total Users</p><h3 className="text-3xl font-bold text-white">{data.metrics.totalUsers}</h3></div>
              <div className="p-2.5 bg-slate-800 rounded-lg text-emerald-400"><Users className="w-5 h-5" /></div>
            </div>
          </div>
        </motion.section>

        {/* Tenant Database */}
        <motion.section variants={item} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white">Tenant Database</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" placeholder="Search businesses, names..." className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800">
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase">Business Name</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase">Owner</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase">Status</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTenants.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-500">No tenants found matching your search.</td></tr>
                ) : (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.business_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{tenant.business_name}</span>
                          <span className="text-xs text-slate-500">ID: {tenant.business_id.substring(0,8)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-300">{tenant.owner_name}</span>
                          <span className="text-xs text-slate-500">{tenant.owner_phone}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${tenant.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {tenant.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button onClick={() => { setSelectedTenant(tenant); setIsModalOpen(true); }} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.section>

      </motion.div>

      {/* Tenant Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              
              <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedTenant.business_name}</h3>
                  <p className="text-sm text-slate-400 mt-1">Platform Tenant Overview</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6 space-y-6">
                
                {/* Macro Stats (Privacy First) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-2"><Users className="w-3 h-3" /> Total Staff</p>
                    <p className="text-xl font-bold text-white">{selectedTenant.staff_count}</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-2"><TrendingUp className="w-3 h-3" /> Processed Vol</p>
                    <p className="text-xl font-bold text-emerald-400">{formatNaira(selectedTenant.total_volume)}</p>
                  </div>
                </div>

                {/* Owner Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Owner</h4>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800">
                    <span className="text-sm text-slate-400">Name</span>
                    <span className="text-sm font-medium text-white">{selectedTenant.owner_name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800">
                    <span className="text-sm text-slate-400">WhatsApp</span>
                    <span className="text-sm font-medium text-white">{selectedTenant.owner_phone}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800">
                    <span className="text-sm text-slate-400">Joined</span>
                    <span className="text-sm font-medium text-white">{new Date(selectedTenant.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Kill Switch */}
                <div className="pt-4 mt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Platform Access Control</h4>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/50">
                    <div>
                      <p className={`text-sm font-bold ${selectedTenant.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-2`}>
                        {selectedTenant.status === 'ACTIVE' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                        {selectedTenant.status === 'ACTIVE' ? 'Business is Active' : 'Business is Suspended'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Controls login and WhatsApp AI access.</p>
                    </div>
                    <button 
                      onClick={() => handleToggleStatus(selectedTenant.business_id, selectedTenant.status)}
                      disabled={isUpdating}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTenant.status === 'ACTIVE' ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'}`}
                    >
                      {isUpdating ? "Updating..." : selectedTenant.status === 'ACTIVE' ? 'Suspend Business' : 'Reactivate Business'}
                    </button>
                  </div>
                </div>
                
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}