"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Users, UserCheck, TrendingUp, Plus, Edit2, Trash2, X, Phone, Info, Loader2, Eye, AlertTriangle, ShieldCheck, ShoppingBag, Calendar, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/lib/store";
import { isAxiosError } from "axios";

// 🚀 UPDATED MODAL TYPES
type ModalType = "ADD" | "EDIT" | "DETAILS" | "DELETE" | "WELCOME_PROMPT" | null;

interface StaffMember {
  id: string;
  name: string;
  phone_number: string;
  role_type: "SME_OWNER" | "SME_STAFF";
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  total_sales: string | number;
  total_transactions: string | number;
}

interface BreakdownItem {
  item_name: string;
  quantity: number | string; 
  amount: number | string;
}

interface DetailedStats {
  total_sales: number | string;
  total_transactions: number | string;
  breakdown: BreakdownItem[];
}

const formatCurrency = (amount: number | string) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(Number(amount || 0));
};

export default function TeamPage() {
  const { business } = useAuthStore();
  
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal & Error States
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");

  // Form State & New Staff Tracker
  const [formData, setFormData] = useState({ name: "", phone_number: "", role_type: "SME_STAFF" as "SME_OWNER" | "SME_STAFF" });
  const [newStaffTracker, setNewStaffTracker] = useState({ name: "", phone: "" }); // 👈 Tracks who to send the invite to!

  // Details Modal Specific States
  const [detailsFilter, setDetailsFilter] = useState("7");
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [detailedStats, setDetailedStats] = useState<DetailedStats>({ 
    total_sales: 0, 
    total_transactions: 0, 
    breakdown: [] 
  });
  const [showItemsBreakdown, setShowItemsBreakdown] = useState(false);

  const fetchStaff = async () => {
    if (!business?.id) return;
    try {
      const res = await api.get(`/team/list?businessId=${business.id}`);
      setStaff(res.data.data);
    } catch (error) {
      console.error("Failed to fetch staff", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, [business?.id]);

  useEffect(() => {
    const fetchStats = async () => {
      if (activeModal !== "DETAILS" || !selectedStaff) return;
      setIsLoadingStats(true);
      try {
        const res = await api.get(`/team/stats?staffId=${selectedStaff.id}&businessId=${business?.id}&days=${detailsFilter}`);
        setDetailedStats(res.data.data);
      } catch (err) {
        console.error("Failed to fetch detailed stats", err);
      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchStats();
  }, [activeModal, selectedStaff, detailsFilter, business?.id]);

  const activeCount = staff.filter(s => s.status === "ACTIVE").length;
  const totalSalesVolume = staff.reduce((acc, curr) => acc + Number(curr.total_sales), 0);
  const avgSalesPerRep = staff.length > 0 ? totalSalesVolume / staff.length : 0;

  const handleCopyInvite = (member: StaffMember) => {
    const botNumber = "2348119135218"; 
    const message = `Hello ${member.name}, you have been added to our Vedly AI team! 🚀\n\nClick this link to message the bot and start logging your sales: https://wa.me/${botNumber}?text=Hello`;
    navigator.clipboard.writeText(message);
    alert("Invite message copied to clipboard!");
  };

  const openModal = (type: ModalType, member?: StaffMember) => {
    setError("");
    setPageError("");
    setSelectedStaff(member || null);
    
    if (type === "ADD") {
      setFormData({ name: "", phone_number: "", role_type: "SME_STAFF" });
    } else if (type === "EDIT" && member) {
      setFormData({ name: member.name, phone_number: member.phone_number, role_type: member.role_type });
    } else if (type === "DETAILS") {
      setDetailsFilter("7"); 
    }
    
    setActiveModal(type);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      if (activeModal === "ADD") {
        await api.post("/team/add", { businessId: business?.id, ...formData });
        setNewStaffTracker({ name: formData.name, phone: formData.phone_number }); // Save details for the popup
        fetchStaff(); 
        setIsSubmitting(false);
        setActiveModal("WELCOME_PROMPT"); // 🚀 Instantly slide to the Welcome Popup!
        return; 
      } else if (activeModal === "EDIT" && selectedStaff) {
        await api.put("/team/edit", { staffId: selectedStaff.id, businessId: business?.id, name: formData.name, role_type: formData.role_type });
      }
      setActiveModal(null);
      fetchStaff(); 
    } catch (err) {
      if (isAxiosError(err)) setError(err.response?.data?.message || "Failed to save staff member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🚀 The New Automated Welcome Trigger
  const handleSendWelcomePrompt = async () => {
    setIsSubmitting(true);
    try {
      await api.post("/team/welcome", { 
        staffName: newStaffTracker.name, 
        staffPhone: newStaffTracker.phone, 
        businessId: business?.id 
      });
      setActiveModal(null); // Close the popup after success
    } catch (err) {
      if (isAxiosError(err)) setError(err.response?.data?.message || "Failed to send message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;
    setIsSubmitting(true);
    setError("");
    try {
      await api.delete(`/team/remove?staffId=${selectedStaff.id}&businessId=${business?.id}`);
      setActiveModal(null);
      fetchStaff();
    } catch (err) {
      if (isAxiosError(err)) setError(err.response?.data?.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (member: StaffMember) => {
    setPageError("");
    const newStatus = member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setStaff(staff.map(s => s.id === member.id ? { ...s, status: newStatus } : s));
    try {
      await api.put("/team/status", { staffId: member.id, businessId: business?.id, newStatus });
    } catch (error) {
      fetchStaff(); 
      if (isAxiosError(error)) setPageError(error.response?.data?.message || "Failed to update status.");
    }
  };

  const container: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8 pb-10">
      
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your staff, roles, and WhatsApp AI access.</p>
        </div>
        <button onClick={() => openModal("ADD")} className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Staff Member
        </button>
      </motion.div>

      {/* Mini-Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Users className="w-5 h-5" /></div>
            <h3 className="text-sm font-medium text-slate-600">Total Staff</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{staff.length}</p>
        </motion.div>
        <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><UserCheck className="w-5 h-5" /></div>
            <h3 className="text-sm font-medium text-slate-600">Active Accounts</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
        </motion.div>
        <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
            <h3 className="text-sm font-medium text-slate-600">Avg Sales per Rep</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(avgSalesPerRep)}</p>
        </motion.div>
      </div>

      {pageError && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-800">Action Blocked</h3>
            <p className="text-sm text-red-700 mt-1">{pageError}</p>
          </div>
          <button onClick={() => setPageError("")} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {/* Staff Directory Table */}
      <motion.div variants={item} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Staff Member</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Total Logged Sales</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Access Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">Loading team...</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">No team members found.</td></tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className={`hover:bg-slate-50 transition-colors group ${member.status === 'INACTIVE' ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold border ${member.role_type === 'SME_OWNER' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                          {member.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.phone_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${member.role_type === 'SME_OWNER' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {member.role_type === 'SME_OWNER' ? 'Store Owner' : 'Sales Staff'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(member.total_sales)}</span>
                      <span className="text-xs text-slate-500 ml-1 block">{member.total_transactions} txns</span>
                    </td>
                    <td className="px-6 py-4">
                      <label className="relative inline-flex items-center cursor-pointer" title="Toggle Access">
                        <input type="checkbox" className="sr-only peer" checked={member.status === "ACTIVE"} onChange={() => toggleStatus(member)} />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ml-3 text-xs font-medium text-slate-700">{member.status === "ACTIVE" ? "Active" : "Suspended"}</span>
                      </label>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal("DETAILS", member)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openModal("EDIT", member)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => openModal("DELETE", member)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Add / Edit Form Modal */}
      <AnimatePresence>
        {(activeModal === "ADD" || activeModal === "EDIT") && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveModal(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">{activeModal === "ADD" ? "Add Staff Member" : "Edit Staff Member"}</h3>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="px-6 py-5">
                {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}
                <form onSubmit={handleSave} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Aanuoluwapo" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone className="h-4 w-4 text-slate-400" /></div>
                      <input disabled={activeModal === "EDIT"} required value={formData.phone_number} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} type="tel" className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="+234 800 000 0000" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                    <select value={formData.role_type} onChange={(e) => setFormData({...formData, role_type: e.target.value as "SME_OWNER" | "SME_STAFF"})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                      <option value="SME_STAFF">Sales Staff</option>
                      <option value="SME_OWNER">Store Owner (Co-Admin)</option>
                    </select>
                  </div>
                  <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                    <button disabled={isSubmitting} type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center shadow-sm">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save Details"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 THE NEW AUTOMATED WELCOME PROMPT MODAL */}
      <AnimatePresence>
        {activeModal === "WELCOME_PROMPT" && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center border border-slate-100 overflow-hidden">
              
              <div className="bg-emerald-600 p-6 flex flex-col items-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-md">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Staff Member Added!</h2>
              </div>
              
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-6">
                  You successfully added <strong>{newStaffTracker.name}</strong>. Would you like Vedly AI to send an automated WhatsApp welcome message to them right now so they can start logging sales?
                </p>

                {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-left">{error}</div>}

                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={handleSendWelcomePrompt} 
                    disabled={isSubmitting} 
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold flex justify-center items-center hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Yes, Send Invite</>}
                  </button>
                  <button onClick={() => setActiveModal(null)} className="w-full py-3 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                    No thanks, I&apos;ll tell them myself
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {activeModal === "DETAILS" && selectedStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveModal(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-8 text-center border-b border-slate-100 relative">
                <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
                <div className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 mb-3 ${selectedStaff.role_type === 'SME_OWNER' ? 'bg-indigo-100 text-indigo-600 border-indigo-50' : 'bg-emerald-100 text-emerald-600 border-emerald-50'}`}>
                  {selectedStaff.name.substring(0, 2).toUpperCase()}
                </div>
                <h3 className="text-xl font-bold text-slate-900">{selectedStaff.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{selectedStaff.phone_number}</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${selectedStaff.role_type === 'SME_OWNER' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {selectedStaff.role_type === 'SME_OWNER' ? <ShieldCheck className="w-3 h-3 mr-1" /> : <ShoppingBag className="w-3 h-3 mr-1" />}
                    {selectedStaff.role_type === 'SME_OWNER' ? 'Store Owner' : 'Sales Staff'}
                  </span>
                </div>
              </div>

              <div className="p-6 bg-white space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-bold text-slate-900">Performance</h4>
                  <div className="relative">
                    <select value={detailsFilter} onChange={(e) => setDetailsFilter(e.target.value)} className="appearance-none pl-8 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 outline-none cursor-pointer">
                      <option value="1">Today</option>
                      <option value="7">Last 7 Days</option>
                      <option value="30">Last 30 Days</option>
                    </select>
                    <Calendar className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-500">Value Sold</span>
                    <button onClick={() => setShowItemsBreakdown(!showItemsBreakdown)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"><Info className="w-4 h-4" /></button>
                  </div>
                  {isLoadingStats ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <span className="text-sm font-bold text-slate-900">{formatCurrency(detailedStats.total_sales)}</span>}
                </div>

                <AnimatePresence>
                  {showItemsBreakdown && detailedStats.breakdown && detailedStats.breakdown.length > 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                      {detailedStats.breakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-700">{item.quantity}x {item.item_name}</span>
                          <span className="text-slate-900 font-bold">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Transactions Logged</span>
                  {isLoadingStats ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <span className="text-sm font-bold text-slate-900">{detailedStats.total_transactions} txns</span>}
                </div>

                <div className="pt-4">
                  <button onClick={() => handleCopyInvite(selectedStaff)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium transition-colors">
                    <Phone className="w-4 h-4" /> Copy WhatsApp Invite
                  </button>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Date Joined</span>
                  <span className="text-sm font-bold text-slate-900">{new Date(selectedStaff.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {activeModal === "DELETE" && selectedStaff && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-100">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-50"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Remove Staff Member?</h2>
              {error ? (
                 <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-left">{error}</div>
              ) : (
                <p className="text-sm text-slate-500 mb-6">Are you sure you want to remove <strong className="text-slate-900">{selectedStaff.name}</strong>? This action cannot be undone.</p>
              )}
              <div className="flex gap-3 w-full">
                <button onClick={() => setActiveModal(null)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={isSubmitting} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex justify-center items-center">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, Remove"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}