import { AppHeader } from "@/components/layout/app-header";

const navItems = [
  { href: "/supplier/dashboard", label: "Dashboard" },
  { href: "/supplier/opportunities", label: "Opportunities" },
  { href: "/supplier/responses", label: "My responses" },
  { href: "/supplier/verification", label: "Verification" },
];

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader homeHref="/supplier/dashboard" navItems={navItems} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
