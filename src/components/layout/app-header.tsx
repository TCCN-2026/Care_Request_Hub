"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/branding/logo";
import { createClient } from "@/lib/supabase/client";

export function AppHeader({
  homeHref,
  navItems,
}: {
  homeHref: string;
  navItems: { href: string; label: string }[];
}) {
  const router = useRouter();

  async function logOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href={homeHref}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Button key={item.href} variant="ghost" size="sm" asChild>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={logOut}>
            Log out
          </Button>
        </nav>
      </div>
    </header>
  );
}
