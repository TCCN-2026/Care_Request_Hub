import { AppHeader } from "@/components/layout/app-header";

const navItems = [
  { href: "/provider/dashboard", label: "Dashboard" },
  { href: "/provider/requests", label: "Requests" },
];

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader homeHref="/provider/dashboard" navItems={navItems} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
