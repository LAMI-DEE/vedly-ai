"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, CreditCard, Save, Store, Smartphone, MessageCircle, AlertTriangle, Loader2, Trash2, Database, ShieldAlert, Calendar, Plus, ArrowRight } from "lucide-react";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/lib/store";
import { isAxiosError } from "axios";

type TabType = "profile" | "audit" | "whatsapp" | "billing";

interface LedgerRecord {
  id: string;
  created_at: string;
  type: 'SALE' | 'EXPENSE';
  amount: number | string;
  description: string; 
  logged_by: string;
}

const formatCurrency = (amount: number | string) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(Number(amount || 0));
};

const generateChallenge = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const LedgerSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
      <tr key={i} className="animate-pulse border-b border-slate-50">
        <td className="px-6 py-4">
          <div className="h-4 bg-slate-200 rounded-md w-24 mb-2"></div>
          <div className="h-3 bg-slate-100 rounded-md w-16"></div>
        </td>
        <td className="px-6 py-4">
          <div className="h-4 bg-slate-200 rounded-md w-48 mb-2"></div>
          <div className="h-3 bg-slate-100 rounded-md w-24"></div>
        </td>
        <td className="px-6 py-4">
          <div className="h-4 bg-slate-200 rounded-md w-20"></div>
        </td>
        <td className="px-6 py-4 text-right flex justify-end">
          <div className="h-8 w-8 bg-slate-100 rounded-lg"></div>
        </td>
      </tr>
    ))}
  </>
);

export default function SettingsPage() {
  const { user, business, login } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  const [profileData, setProfileData] = useState({ fullName: user?.name || "", businessName: business?.name || "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 7);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<LedgerRecord | null>(null);
  const [challengeString, setChallengeString] = useState("");
  const [challengeInput, setChallengeInput] = useState("");
  const [ledgerMessage, setLedgerMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (activeTab === "audit" && business?.id) {
      const fetchLedger = async () => {
        setIsLoadingLedger(true);
        try {
          const res = await api.get(`/ledger/history?businessId=${business.id}&startDate=${startDate}&endDate=${endDate}`);
          setRecords(res.data.data);
        } catch (error) {
          console.error("Failed to fetch ledger", error);
        } finally {
          setIsLoadingLedger(false);
        }
      };
      fetchLedger();
    }
  }, [activeTab, business?.id, startDate, endDate]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage({ type: "", text: "" });
    try {
      const res = await api.put("/settings/profile", profileData);
      login(res.data.data.user, res.data.data.business);
      setProfileMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err) {
      if (isAxiosError(err)) setProfileMessage({ type: "error", text: err.response?.data?.message || "Failed to update profile." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const openDeleteModal = (record: LedgerRecord) => {
    setRecordToDelete(record);
    setChallengeString(generateChallenge());
    setChallengeInput("");
  };

  const executeSafeDelete = async () => {
    if (!recordToDelete || !business?.id || !user?.id) return;
    setIsDeleting(true);
    setLedgerMessage({ type: "", text: "" });
    try {
      await api.delete(`/ledger/record?id=${recordToDelete.id}&type=${recordToDelete.type}&businessId=${business.id}&userId=${user.id}`);
      setRecords(records.filter(r => r.id !== recordToDelete.id));
      setLedgerMessage({ type: "success", text: "Record securely erased and ledgers updated." });
    } catch (err) {
      if (isAxiosError(err)) setLedgerMessage({ type: "error", text: err.response?.data?.message || "Failed to delete record." });
    } finally {
      setIsDeleting(false);
      setRecordToDelete(null);
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your business profile, integrations, and secure data.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        
        <aside className="w-full lg:w-60 flex-shrink-0">
          <nav className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto">
            <button onClick={() => setActiveTab("profile")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "profile" ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <User className={`w-4 h-4 ${activeTab === "profile" ? "text-emerald-600" : "text-slate-400"}`} /> Profile
            </button>
            <button onClick={() => setActiveTab("audit")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "audit" ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <Database className={`w-4 h-4 ${activeTab === "audit" ? "text-red-600" : "text-slate-400"}`} /> Audit & Ledger
            </button>
            <button onClick={() => setActiveTab("whatsapp")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "whatsapp" ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <MessageCircle className={`w-4 h-4 ${activeTab === "whatsapp" ? "text-emerald-600" : "text-slate-400"}`} /> Integrations
            </button>
            <button onClick={() => setActiveTab("billing")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "billing" ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <CreditCard className={`w-4 h-4 ${activeTab === "billing" ? "text-emerald-600" : "text-slate-400"}`} /> Billing
            </button>
          </nav>
        </aside>

        <div className="flex-1 min-w-0 w-full">
          <AnimatePresence mode="wait">
            
            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <form onSubmit={handleProfileUpdate} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900">Profile Information</h2>
                  </div>
                  <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {profileMessage.text && (
                      <div className={`sm:col-span-2 p-3 text-sm rounded-lg ${profileMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                        {profileMessage.text}
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input required value={profileData.fullName} onChange={(e) => setProfileData({...profileData, fullName: e.target.value})} type="text" className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-700">WhatsApp Number</label>
                      <div className="relative">
                        <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input disabled value={user?.phone_number || ""} type="tel" className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 text-sm cursor-not-allowed" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Business Name</label>
                      <div className="relative">
                        <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input required value={profileData.businessName} onChange={(e) => setProfileData({...profileData, businessName: e.target.value})} type="text" className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                    <button disabled={isSavingProfile} type="submit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
                      <Save className="w-4 h-4" /> {isSavingProfile ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* AUDIT & LEDGER TAB */}
            {activeTab === "audit" && (
              <motion.div key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-red-900">Admin Ledger Engine</h3>
                    <p className="text-xs text-red-700 mt-1">Deleting a record here is permanent. If a physical item sale is deleted, its stock will automatically be returned to your inventory. Net profit is instantly recalculated.</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                  
                  <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-lg font-bold text-slate-900">Unified Ledger</h2>
                    <div className="flex items-center gap-3">
                      
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                        <input 
                          type="date" 
                          value={startDate} 
                          onChange={(e) => setStartDate(e.target.value)} 
                          className="bg-transparent text-xs sm:text-sm font-medium text-slate-700 outline-none px-2 py-1.5 cursor-pointer" 
                        />
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <input 
                          type="date" 
                          value={endDate} 
                          onChange={(e) => setEndDate(e.target.value)} 
                          className="bg-transparent text-xs sm:text-sm font-medium text-slate-700 outline-none px-2 py-1.5 cursor-pointer" 
                        />
                      </div>

                      <button className="hidden sm:flex px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors items-center gap-2">
                        <Plus className="w-4 h-4" /> Entry
                      </button>
                    </div>
                  </div>
                  
                  {ledgerMessage.text && (
                    <div className="m-4">
                      <div className={`p-3 text-sm rounded-lg ${ledgerMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                        {ledgerMessage.text}
                      </div>
                    </div>
                  )}

                  {/* 🚀 NEW: Sticky Header & Scrollable Body Container */}
                  <div className="overflow-auto max-h-[60vh] min-h-[300px] scroll-smooth">
                    <table className="w-full text-left border-collapse whitespace-nowrap relative">
                      <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm ring-1 ring-slate-100">
                        <tr>
                          <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Date & Time</th>
                          <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                          <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                          <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isLoadingLedger ? (
                          <LedgerSkeleton />
                        ) : records.length === 0 ? (
                          <tr><td colSpan={4} className="py-16 text-center text-slate-500 text-sm font-medium">No financial records found for this date range.</td></tr>
                        ) : (
                          records.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="text-sm font-medium text-slate-900 block">{new Date(record.created_at).toLocaleDateString()}</span>
                                <span className="text-xs text-slate-500">{new Date(record.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${record.type === 'SALE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {record.type}
                                  </span>
                                  <span className="text-sm font-bold text-slate-900">{record.description}</span>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Logged by: {record.logged_by || 'Unknown'}</span>
                              </td>
                              <td className={`px-6 py-4 text-sm font-bold ${record.type === 'SALE' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {record.type === 'SALE' ? '+' : '-'}{formatCurrency(record.amount)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => openDeleteModal(record)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* WHATSAPP INTEGRATION TAB */}
            {activeTab === "whatsapp" && (
              <motion.div key="whatsapp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900">WhatsApp Integration</h2>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-4 p-5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-emerald-100 flex-shrink-0">
                        <MessageCircle className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Vedly AI is Online</h3>
                        <p className="text-sm text-slate-600 mt-1">Your business is fully connected to the Meta WhatsApp Business API. The AI agent is actively listening for staff inputs.</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* BILLING TAB */}
            {activeTab === "billing" && (
              <motion.div key="billing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                   <div className="px-6 py-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900">Current Plan</h2>
                  </div>
                  <div className="px-6 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">PRO</span>
                          <span className="text-xs text-slate-500">Current Plan</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">₦15,000<span className="text-sm font-normal text-slate-500">/month</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Security Delete Challenge Modal */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRecordToDelete(null)} className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
              
              <div className="bg-red-600 p-6 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Permanent Deletion</h2>
              </div>
              
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-6 text-center">
                  You are about to securely delete a <strong>{recordToDelete.type}</strong> record for <strong>{formatCurrency(recordToDelete.amount)}</strong>. This will alter your historical financial data permanently.
                </p>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Type the code below to confirm</p>
                  <div className="text-2xl font-mono font-black text-slate-900 tracking-[0.2em] select-none pointer-events-none">
                    {challengeString}
                  </div>
                </div>

                <input 
                  type="text" 
                  value={challengeInput}
                  onChange={(e) => setChallengeInput(e.target.value.toUpperCase())}
                  placeholder="Enter confirmation code" 
                  className="w-full text-center text-lg font-mono font-bold tracking-[0.2em] px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none mb-6 transition-all"
                />

                <div className="flex gap-3 w-full">
                  <button onClick={() => setRecordToDelete(null)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                  <button 
                    onClick={executeSafeDelete} 
                    disabled={isDeleting || challengeInput !== challengeString} 
                    className={`flex-1 py-3 text-white rounded-xl text-sm font-bold flex justify-center items-center transition-all ${challengeInput === challengeString ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30' : 'bg-red-300 cursor-not-allowed'}`}
                  >
                    {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Secure Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}