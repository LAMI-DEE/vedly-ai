"use client";

import React, { useState } from "react";
import { X, Store, Loader2, ArrowRight, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/lib/store";
import { isAxiosError } from "axios";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // New OTP State Management
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const [formData, setFormData] = useState({
    fullName: "", whatsapp: "", businessName: "",
  });

  if (!isOpen) return null;

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Step 1: Tell backend to send an OTP to this WhatsApp number
      const endpoint = isLoginMode ? "/auth/login/request-otp" : "/auth/register/request-otp";
      await api.post(endpoint, formData);
      
      // If successful, switch UI to OTP collection mode
      setOtpSent(true);
    } catch (err) {
      if (isAxiosError(err)) {
        // This will cleanly catch your "Number already exists" or "Not an SME Owner" errors from Node.js
        setError(err.response?.data?.message || "Something went wrong.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Step 2: Verify the OTP and log them in
      const endpoint = isLoginMode ? "/auth/login/verify" : "/auth/register/verify";
      const res = await api.post(endpoint, {
        ...formData,
        otp: otpCode
      });

      login(res.data.data.user, res.data.data.business);
      router.push("/dashboard");
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || "Invalid OTP code.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset states when toggling between Login and Sign Up
  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError("");
    setOtpSent(false);
    setOtpCode("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="px-8 pt-10 pb-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
              {otpSent ? <Smartphone className="w-6 h-6 text-emerald-600" /> : <Store className="w-6 h-6 text-emerald-600" />}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {otpSent ? "Check your WhatsApp" : (isLoginMode ? "Owner Login" : "Welcome to Vedly AI")}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {otpSent 
                ? `We sent a 6-digit code to ${formData.whatsapp}` 
                : (isLoginMode ? "Access your enterprise dashboard." : "Set up your AI assistant in 30 seconds.")}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100 font-medium">
              {error}
            </div>
          )}

          {!otpSent ? (
            /* STEP 1: INITIAL FORM */
            <form onSubmit={handleInitialSubmit} className="space-y-4">
              {!isLoginMode && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input required={!isLoginMode} type="text" placeholder="Iya Bose" className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number</label>
                <input required type="tel" placeholder="2348000000000" className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} />
              </div>

              {!isLoginMode && (
                <div className="pt-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                  <input required={!isLoginMode} type="text" placeholder="Iya Bose Supermart" className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} />
                </div>
              )}

              <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm mt-6">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLoginMode ? "Send Login Code" : "Create My Business")}
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          ) : (
            /* STEP 2: OTP VERIFICATION */
            <form onSubmit={handleVerifyOTP} className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 text-center">Enter 6-Digit OTP</label>
                <input required type="text" maxLength={6} placeholder="••••••" className="w-full px-4 py-4 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none text-center text-2xl tracking-[0.5em] font-bold"
                  value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>

              <button disabled={isLoading || otpCode.length !== 6} type="submit" className="w-full flex justify-center items-center py-3.5 px-4 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm mt-6">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Enter Dashboard"}
              </button>
              
              <button type="button" onClick={() => setOtpSent(false)} className="w-full text-center text-sm text-slate-500 hover:text-slate-700 mt-2 font-medium">
                Wrong number? Go back.
              </button>
            </form>
          )}

          {!otpSent && (
            <div className="mt-6 text-center text-sm text-slate-500 pt-6 border-t border-slate-100">
              {isLoginMode ? "Don't have an account? " : "Already have an account? "}
              <button onClick={toggleMode} className="text-emerald-600 font-semibold hover:underline">
                {isLoginMode ? "Sign Up" : "Log In"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}