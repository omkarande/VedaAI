"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  HelpCircle,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import Sidebar from "./Sidebar";
import type { AppView } from "../types";

type AppShellProps = {
  view: AppView;
  children: ReactNode;
};

export default function AppShell({ view, children }: AppShellProps) {
  const collapsed = view !== "upload";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh gap-0 bg-[#f3f3f3] p-2 md:gap-[11px] md:p-3">
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-2 top-2">
            <Sidebar collapsed={false} />
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 md:gap-[13px]">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2.5 rounded-2xl bg-white pl-3 pr-2 md:pl-6">
          <div className="flex items-center gap-2 text-[#1c1c1c] md:gap-2.5">
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full text-[#4a4a4a] hover:bg-[#f4f4f4] md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              {mobileOpen ? (
                <X className="size-[18px]" />
              ) : (
                <Menu className="size-[18px]" />
              )}
            </button>
            <button
              type="button"
              className="hidden size-8 items-center justify-center rounded-full text-[#4a4a4a] hover:bg-[#f4f4f4] md:flex"
              aria-label="Back"
            >
              <ChevronLeft className="size-[18px]" />
            </button>
            <ClipboardList className="size-[18px] text-[#6b6b6b]" />
            <span className="text-[15px] font-semibold">Exams</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2.5">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-[#4a4a4a] hover:bg-[#f4f4f4]"
              aria-label="Help"
            >
              <HelpCircle className="size-5" />
            </button>
            <button
              type="button"
              className="relative flex size-9 items-center justify-center rounded-full text-[#4a4a4a] hover:bg-[#f4f4f4]"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#e24b4b]" />
            </button>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-[#f36b1c] hover:bg-[#fff1e8]"
              aria-label="AI tools"
            >
              <Sparkles className="size-5" />
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1 hover:bg-[#f7f7f7]"
            >
              <img
                src="/brand/avatar.png"
                alt=""
                className="size-8 rounded-full object-cover"
                width={32}
                height={32}
                onError={(event) => {
                  event.currentTarget.src =
                    "https://ui-avatars.com/api/?name=Madhur+Rastogi&background=c9a227&color=fff&size=64";
                }}
              />
              <span className="hidden text-sm font-medium sm:inline">
                Madhur Rastogi
              </span>
              <ChevronDown className="size-4 text-[#6b6b6b]" />
            </button>
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
