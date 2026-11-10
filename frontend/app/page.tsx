"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, BarChart3, MessageSquare, ShieldCheck, CheckCircle2, Box } from "lucide-react";
import AuthModal from "@/components/ui/AuthModal";
import Image from "next/image";

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatStep, setChatStep] = useState(0);

  // This creates the "live video" repeating animation effect
  useEffect(() => {
    const timer = setInterval(() => {
      setChatStep((prev) => (prev >= 3 ? 0 : prev + 1));
    }, 2000); // Changes every 3.5 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-200">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 bg-white/70 backdrop-blur-md border-b border-slate-100 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Logo Area */}
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center overflow-hidden relative">
              <Image 
                src="/newvedly-icon.png" // 👈 Put your Vedly logo in the 'public' folder
                alt="Vedly Logo" 
                width={32} 
                height={32} 
                className=" object-cover p-1"
              />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900">Vedly AI</span>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-emerald-100/50 rounded-full blur-3xl -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Copy & CTAs */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium mb-8">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                The Smartest SME Assistant
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-6">
                Run Your Entire Business Over <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-400">WhatsApp.</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
                Vedly AI tracks your inventory, logs sales, calculates profit automatically e.t.c. Just text your shop.
              </p>
              
              <button onClick={() => setIsModalOpen(true)} className="inline-flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-lg font-semibold text-base transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Animated Chat Mockup */}
            <div className="relative mx-auto w-full max-w-95">
              <div className="absolute inset-0 bg-linear-to-tr from-emerald-200 to-emerald-100 rounded-[2.5rem] blur-2xl opacity-60 transform rotate-3 scale-105"></div>
              
              <div className="relative bg-slate-50 border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[550px]">
                
                {/* Phone Header */}
                <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 shadow-sm z-10">
                  {/* <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100">
                     <Image src="/newvedlyblackicon.png" alt="Vedly AI" width={40} height={40} className=" object-cover p-1 bg-emerald-50" />
                  </div> */}
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Image src="/vedlydisplaypicture.png" alt="Vedly AI" width={40} height={40} className=" object-cover rounded-[25px] bg-emerald-50" />
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900">Vedly AI</h3>
                    <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                    </p>
                  </div>
                </div>

                {/* Chat Body (Animated) */}
                <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto bg-[#efeae2]"> {/* WhatsApp background color */}
                  <div className="flex justify-center mb-2">
                    <span className="bg-white/80 border border-slate-200 text-slate-500 text-xs font-medium px-3 py-1 rounded-full shadow-sm">Today</span>
                  </div>

                  {/* Message 1: User logs sale */}
                  <div className={`flex flex-col items-end transition-all duration-500 transform ${chatStep >= 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="bg-[#dcf8c6] text-slate-900 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm">
                      <p className="text-sm">I sold 2 cartons of Milo</p>
                    </div>
                  </div>

                  {/* Message 2: AI confirms */}
                  <div className={`flex flex-col items-start transition-all duration-500 transform ${chatStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="bg-white text-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
                      <p className="text-sm font-medium flex items-center gap-1">Actioned! <CheckCircle2 className="w-4 h-4 text-emerald-500"/></p>
                      <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex justify-between items-center mb-1 gap-4">
                          <span className="text-xs text-slate-500">Item</span>
                          <span className="text-xs font-medium text-slate-900 text-right">Milo (Carton)</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200">
                          <span className="text-xs text-slate-500">Revenue</span>
                          <span className="text-sm font-bold text-emerald-600">₦14,000</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message 3: User asks for stats */}
                  <div className={`flex flex-col items-end transition-all duration-500 transform ${chatStep >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="bg-[#dcf8c6] text-slate-900 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm">
                      <p className="text-sm">What&apos;s my total sales today?</p>
                    </div>
                  </div>

                  {/* Message 4: AI gives stats */}
                  <div className={`flex flex-col items-start transition-all duration-500 transform ${chatStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="bg-white text-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
                      <p className="text-sm">You have made a total of <span className="font-bold text-emerald-600">₦45,500</span> in sales today across 8 transactions! Weldone boss 👏🏾</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            
          </div>
        </div>
      </main>
      
      {/* Expanded Features Section */}
      <section className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Enterprise tools, zero learning curve.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
              <MessageSquare className="w-10 h-10 text-emerald-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Natural Language</h3>
              <p className="text-slate-600">No complex forms. Just type like you are talking to a human staff member.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
              <BarChart3 className="w-10 h-10 text-emerald-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Instant Analytics</h3>
              <p className="text-slate-600">Watch your dashboard update in real-time as sales happen on WhatsApp.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
              <ShieldCheck className="w-10 h-10 text-emerald-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Bank-Grade Ledgers</h3>
              <p className="text-slate-600">Generate clean financial statements instantly to apply for SME loans.</p>
            </div>
          </div>
        </div>
      </section>


      {/* Note: Expanded Features Section remains exactly the same below here */}
      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
