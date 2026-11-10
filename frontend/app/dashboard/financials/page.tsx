"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Calendar, Download, Store, RefreshCw, ArrowRight, Loader2 } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/lib/store";

interface Transaction {
  date: string;
  description: string;
  type: "Credit" | "Debit";
  amount: string | number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export default function FinancialsPage() {
  const { business } = useAuthStore();
  const componentRef = useRef<HTMLDivElement>(null);
  
  // Initialize dates: Start Date (30 days ago) and End Date (Today)
  const defaultEnd = new Date().toISOString().split('T')[0];
  const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  
  const [data, setData] = useState({ 
    period: { start: defaultStart, end: defaultEnd },
    totalRevenue: 0, totalExpenses: 0, netProfit: 0, ledger: [] as Transaction[] 
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatement = async () => {
    if (!business?.id) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/analytics/statement?businessId=${business.id}&startDate=${startDate}&endDate=${endDate}`);
      setData(res.data.data);
    } catch (error) {
      console.error("Failed to fetch statement", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => { fetchStatement(); }, [business?.id]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `${business?.name}_Financial_Statement_${data.period.start}_to_${data.period.end}`,
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-8 pb-10">
      
      {/* Header & Custom Date Controls */}
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Select a custom date range to generate bank-grade statements.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200 w-full sm:w-auto">
            <div className="flex flex-col px-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <div className="flex flex-col px-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer" />
            </div>
          </div>
          
          <div className="flex w-full sm:w-auto gap-3">
            <button onClick={fetchStatement} disabled={isLoading} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors shadow-sm disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} /> {isLoading ? "Syncing..." : "Generate Report"}
            </button>
            <button onClick={() => handlePrint()} disabled={isLoading || data.ledger.length === 0} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:bg-slate-300">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* The "Desk" Background */}
      <section className="bg-slate-200/50 p-4 sm:p-8 lg:p-12 rounded-2xl border border-slate-200 overflow-x-auto">
        
        {/* THE A4 PAPER CONTAINER */}
        <div ref={componentRef} className="bg-white max-w-4xl mx-auto shadow-xl rounded-none p-12 lg:p-16 min-w-200 print:shadow-none print:p-0">
          
          {/* Document Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700">
                  <Store className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{business?.name || "Your Business"}</h2>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Generated via Vedly ERP<br />
                Business ID: {business?.id.substring(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Financial Statement</h3>
              <div className="mt-4 space-y-1">
                {/* 👈 DYNAMIC PRINT HEADER */}
                <p className="text-slate-900 text-sm font-medium"><span className="text-slate-500 mr-2">Period:</span> {formatDate(data.period.start)} - {formatDate(data.period.end)}</p>
                <p className="text-slate-900 text-sm font-medium"><span className="text-slate-500 mr-2">Generated:</span> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p className="text-slate-900 text-sm font-medium"><span className="text-slate-500 mr-2">Currency:</span> NGN (₦)</p>
              </div>
            </div>
          </div>

          {/* Summary Boxes */}
          <div className="grid grid-cols-3 gap-8 mb-12">
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 print:border-slate-300">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Revenue</p>
              <p className="text-3xl font-bold text-emerald-600">{formatCurrency(data.totalRevenue)}</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 print:border-slate-300">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Expenses</p>
              <p className="text-3xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</p>
            </div>
            <div className="bg-emerald-50 p-5 rounded-lg border border-emerald-100 print:border-slate-300">
              <p className="text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">BALANCE</p>
              <p className="text-3xl font-bold text-emerald-600">{formatCurrency(data.netProfit)}</p>
            </div>
          </div>

          {/* Ledger Table */}
          <div>
            <h4 className="text-lg font-bold text-slate-900 mb-4">Transaction Ledger</h4>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800">
                  <th className="py-3 pr-4 text-xs font-bold text-slate-900 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-900 uppercase tracking-wider">Description</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-900 uppercase tracking-wider">Type</th>
                  <th className="py-3 pl-4 text-xs font-bold text-slate-900 text-right uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                   <tr><td colSpan={4} className="py-12 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" /> Compiling ledger data...</td></tr>
                ) : data.ledger.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-slate-500 bg-slate-50 rounded-lg">No transactions recorded for this specific date range.</td></tr>
                ) : (
                  data.ledger.map((tx, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 pr-4 text-sm text-slate-500">{formatDate(tx.date)}</td>
                      <td className="py-4 px-4 text-sm text-slate-900 font-medium">{tx.description}</td>
                      <td className={`py-4 px-4 text-sm font-bold ${tx.type === 'Credit' ? 'text-emerald-600' : 'text-red-600'}`}>{tx.type}</td>
                      <td className="py-4 pl-4 text-sm text-slate-900 text-right font-bold">{formatCurrency(Number(tx.amount))}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800 bg-slate-50">
                  <td colSpan={3} className="py-5 pr-4 text-sm font-bold text-slate-900 text-right uppercase tracking-wider">Total Balance</td>
                  <td className="py-5 pl-4 text-lg font-bold text-emerald-600 text-right">{formatCurrency(data.netProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          {/* Signatures */}
          <div className="mt-24 pt-8 border-t border-slate-200 flex justify-between items-end print:mt-32">
            <div className="w-56">
              <div className="border-b border-slate-400 h-10 mb-2"></div>
              <p className="text-xs text-slate-500 text-center uppercase tracking-wider font-bold">Authorized Signature</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Generated securely via Vedly AI</p>
            </div>
          </div>

        </div>
      </section>
    </motion.div>
  );
}