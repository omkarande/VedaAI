"use client";

import {
  BookOpen,
  ClipboardList,
  FolderOpen,
  Home,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type { NavId } from "../types";

const NAV: { id: NavId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "classroom", label: "My Classroom", icon: Users },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
  { id: "exams", label: "Exams", icon: BookOpen },
  { id: "library", label: "My Library", icon: FolderOpen },
];

type SidebarProps = {
  collapsed: boolean;
};

function LogoMark({ size }: { size: "sm" | "md" }) {
  const box = size === "sm" ? "size-10 rounded-xl" : "size-9 rounded-lg";
  return (
    <div
      className={`flex ${box} items-center justify-center overflow-hidden bg-[#1c1c1c] text-sm font-extrabold text-white`}
    >
      V
    </div>
  );
}

export default function Sidebar({ collapsed }: SidebarProps) {
  if (collapsed) {
    return (
      <aside className="flex h-[calc(100dvh-24px)] w-[72px] shrink-0 flex-col items-center justify-between rounded-2xl bg-white py-5">
        <div className="flex flex-col items-center">
          <LogoMark size="sm" />
          <button
            type="button"
            className="mt-5 flex size-11 items-center justify-center rounded-full bg-[#f36b1c] text-white shadow-[0_0_0_3px_rgba(243,107,28,0.25)]"
            aria-label="AI Teacher's Toolkit"
          >
            <Sparkles className="size-4" />
          </button>
          <nav className="mt-6 flex flex-col items-center gap-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  className="flex size-10 items-center justify-center rounded-xl text-[#6b6b6b] hover:bg-[#f7f7f7]"
                >
                  <Icon className="size-[18px]" />
                </button>
              );
            })}
          </nav>
        </div>
        <img
          src="/brand/crest.png"
          alt="Delhi Public School"
          className="size-9 rounded-full object-cover"
          width={36}
          height={36}
          onError={(event) => {
            event.currentTarget.src =
              "https://ui-avatars.com/api/?name=DPS&background=1c4f9c&color=fff&size=64";
          }}
        />
      </aside>
    );
  }

  return (
    <aside className="flex h-[calc(100dvh-24px)] w-[min(304px,calc(100vw-24px))] shrink-0 flex-col justify-between rounded-2xl bg-white p-6">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <LogoMark size="md" />
          <span className="text-lg font-extrabold tracking-tight">VedaAI</span>
        </div>

        <button
          type="button"
          className="flex h-11 items-center justify-center gap-2 rounded-full border border-[#f36b1c] bg-[#1c1c1c] px-4 text-sm font-semibold text-white"
        >
          <Sparkles className="size-4 text-[#f36b1c]" />
          AI Teacher's Toolkit
        </button>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.id === "exams";
            return (
              <button
                key={item.id}
                type="button"
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                  active
                    ? "bg-[#efefef] text-[#1c1c1c]"
                    : "text-[#4a4a4a] hover:bg-[#f7f7f7]"
                }`}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#4a4a4a] hover:bg-[#f7f7f7]"
        >
          <Settings className="size-[18px]" />
          Settings
        </button>

        <div className="flex items-center gap-3 rounded-2xl bg-[#f4f4f4] p-3">
          <img
            src="/brand/crest.png"
            alt=""
            className="size-10 rounded-full object-cover"
            width={40}
            height={40}
            onError={(event) => {
              event.currentTarget.src =
                "https://ui-avatars.com/api/?name=DPS&background=1c4f9c&color=fff&size=64";
            }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Delhi Public School</p>
            <p className="truncate text-xs text-[#6b6b6b]">Bokaro Steel City</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
