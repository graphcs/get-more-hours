"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo height={26} />

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {isLoggedIn ? (
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </>
          )}
        </nav>

        <div className="md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-[300px]">
            <div className="flex flex-col gap-4 mt-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-lg font-medium hover:text-primary transition-colors"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 mt-4">
                {isLoggedIn ? (
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    <Button className="w-full">Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)}>
                      <Button variant="outline" className="w-full">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/register" onClick={() => setOpen(false)}>
                      <Button className="w-full">Get Started</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
