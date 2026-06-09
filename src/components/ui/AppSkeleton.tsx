import React from 'react';
import { Skeleton } from './Skeleton';

export const AppSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex bg-[#030307] light-mode:bg-[#F3F5FA] relative overflow-hidden select-none">
      {/* Background glow effects to match premium styling */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* 1. DESKTOP SIDE DOCK SKELETON */}
      <aside className="hidden lg:flex fixed left-4 top-4 bottom-4 w-14 rounded-2xl border border-white/[0.06] light-mode:border-slate-200/60 bg-[#070710]/50 light-mode:bg-white/45 backdrop-blur-2xl flex-col justify-between py-4 px-2 items-center z-30">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Logo Placeholder */}
          <Skeleton variant="circle" width={36} height={36} className="bg-indigo-500/20" />
          
          <div className="w-full h-[1px] bg-white/[0.05] light-mode:bg-slate-200/50 my-2" />
          
          {/* Navigation Items Placeholders */}
          <div className="flex flex-col gap-4 items-center w-full">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} variant="circle" width={32} height={32} />
            ))}
          </div>
        </div>

        {/* Footer Items Placeholders */}
        <div className="flex flex-col gap-4 items-center w-full">
          <Skeleton variant="circle" width={32} height={32} />
          <Skeleton variant="circle" width={32} height={32} />
        </div>
      </aside>

      {/* 2. MOBILE TOP BAR SKELETON */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 border-b border-white/[0.06] light-mode:border-slate-200/60 bg-[#070710]/80 light-mode:bg-white/80 backdrop-blur-md flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <Skeleton variant="circle" width={28} height={28} className="bg-indigo-500/20" />
          <Skeleton variant="rect" width={80} height={16} />
        </div>
        <Skeleton variant="circle" width={32} height={32} />
      </header>

      {/* 3. MOBILE BOTTOM NAV BAR SKELETON */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-white/[0.06] light-mode:border-slate-200/60 bg-[#070710]/90 light-mode:bg-white/90 backdrop-blur-lg flex items-center justify-around px-2 pb-safe z-30">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton variant="circle" width={24} height={24} />
            <Skeleton variant="rect" width={32} height={8} />
          </div>
        ))}
      </nav>

      {/* 4. MAIN CONTENT AREA SKELETON */}
      <main className="flex-1 min-w-0 px-4 md:px-8 pt-20 lg:pt-8 pb-24 lg:pb-8 lg:pl-20 transition-all z-10 w-full">
        <div className="max-w-6xl mx-auto w-full">
          
          {/* Header Dashboard Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/[0.05] light-mode:border-slate-200/50 pb-6 mb-8 text-left">
            <div className="space-y-2.5">
              <Skeleton variant="rect" width={180} height={28} />
              <Skeleton variant="rect" width={280} height={14} />
            </div>
            <Skeleton variant="rect" width={120} height={40} className="rounded-xl" />
          </div>

          {/* Grid Layout (mimics Home / Library feeds) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            {/* Left Content column: cards feed */}
            <div className="lg:col-span-8 space-y-6">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="p-6 rounded-3xl border border-white/[0.06] light-mode:border-slate-200 bg-white/[0.02] light-mode:bg-white/50 backdrop-blur flex flex-col gap-4">
                  {/* Header metadata */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton variant="circle" width={36} height={36} />
                      <div className="space-y-1">
                        <Skeleton variant="rect" width={100} height={12} />
                        <Skeleton variant="rect" width={60} height={8} />
                      </div>
                    </div>
                    <Skeleton variant="rect" width={50} height={14} />
                  </div>

                  {/* Body description text placeholders */}
                  <div className="space-y-2">
                    <Skeleton variant="rect" className="w-full" height={12} />
                    <Skeleton variant="rect" className="w-[85%]" height={12} />
                    <Skeleton variant="rect" className="w-[60%]" height={12} />
                  </div>

                  {/* PDF or action row placeholder */}
                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/[0.04] light-mode:border-slate-200/50">
                    <div className="flex gap-2">
                      <Skeleton variant="rect" width={80} height={20} className="rounded-full" />
                      <Skeleton variant="rect" width={60} height={20} className="rounded-full" />
                    </div>
                    <Skeleton variant="rect" width={80} height={32} className="rounded-xl" />
                  </div>
                </div>
              ))}
            </div>

            {/* Right sidebar column: widgets */}
            <div className="lg:col-span-4 space-y-6">
              {/* Widget card 1 */}
              <div className="p-6 rounded-3xl border border-white/[0.06] light-mode:border-slate-200 bg-white/[0.02] light-mode:bg-white/50 backdrop-blur space-y-4">
                <Skeleton variant="rect" width={120} height={16} />
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton variant="circle" width={28} height={28} />
                      <Skeleton variant="rect" className="flex-1" height={12} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Widget card 2 */}
              <div className="p-6 rounded-3xl border border-white/[0.06] light-mode:border-slate-200 bg-white/[0.02] light-mode:bg-white/50 backdrop-blur space-y-4">
                <Skeleton variant="rect" width={100} height={16} />
                <Skeleton variant="rect" className="w-full rounded-2xl" height={80} />
                <div className="flex justify-between">
                  <Skeleton variant="rect" width={80} height={24} />
                  <Skeleton variant="rect" width={80} height={24} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
