"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  User,
  LogOut,
  ChevronRight,
} from "lucide-react";

interface DashboardNavProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const stageNavItems = [
  { href: "/dashboard/stage/1", label: "Stage 1: Request", num: 1 },
  { href: "/dashboard/stage/2", label: "Stage 2: Appeal", num: 2 },
  { href: "/dashboard/stage/3", label: "Stage 3: Hearing", num: 3 },
];

const bottomNavItems = [
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-background p-4">
      <div className="mb-8 px-2">
        <Logo height={22} href="/" />
      </div>

      <nav className="flex-1 space-y-1">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-2 pb-1">
          <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Stages
          </span>
        </div>
        {stageNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-3 pb-1">
          <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Account
          </span>
        </div>
        {bottomNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t pt-4 mt-4">
        <div className="px-3 mb-3">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <Badge variant="secondary" className="mt-1 text-xs capitalize">
            {user.role}
          </Badge>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
