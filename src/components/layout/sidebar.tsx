"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type NavLink = {
  href: string;
  label: string;
};

/** Ofis: günlük takip (firma / iş tanımlama yalnızca admin) */
const employeeLinks: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/calendar", label: "Takvim" },
  { href: "/notifications", label: "Bildirimler" },
];

/** Admin: aynı ana menü + yönetim */
const adminWorkLinks: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/calendar", label: "Takvim" },
  { href: "/work", label: "İşler" },
  { href: "/companies", label: "Firmalar" },
  { href: "/notifications", label: "Bildirimler" },
];

const adminManageLinks: NavLink[] = [
  { href: "/employees", label: "Çalışanlar" },
  { href: "/reports", label: "Raporlar" },
  { href: "/activities", label: "Aktiviteler" },
];

function NavItem({
  link,
  pathname,
}: {
  link: NavLink;
  pathname: string;
}) {
  const active =
    link.href === "/"
      ? pathname === "/"
      : link.href === "/work"
        ? pathname.startsWith("/work") ||
          pathname.startsWith("/tasks") ||
          pathname.startsWith("/contents")
        : pathname.startsWith(link.href);

  return (
    <Link href={link.href} data-active={active} className="bf-nav-link">
      {link.label}
    </Link>
  );
}

export function Sidebar({
  userName,
  role,
}: {
  userName: string;
  role: string;
}) {
  const pathname = usePathname();
  const admin = role === "ADMIN";
  const mainLinks = admin ? adminWorkLinks : employeeLinks;

  return (
    <aside className="bf-sidebar flex w-[15.5rem] shrink-0 flex-col px-4 py-7 md:w-64">
      <div className="mb-8 px-2">
        <p className="bf-brand text-[2.35rem] text-[var(--da-yellow)] md:text-[2.6rem]">
          BeeFlow
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {mainLinks.map((link) => (
          <NavItem key={link.href} link={link} pathname={pathname} />
        ))}

        {admin ? (
          <div className="mt-5">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
              Yönetim
            </p>
            {adminManageLinks.map((link) => (
              <NavItem key={link.href} link={link} pathname={pathname} />
            ))}
          </div>
        ) : null}
      </nav>

      <div className="mt-6 border-t border-white/10 px-2 pt-4">
        <p className="text-sm font-bold text-white">{userName}</p>
        <p className="mt-0.5 text-xs uppercase tracking-[0.08em] text-white/45">
          {admin ? "Admin" : "Çalışan"}
        </p>
        <button
          type="button"
          className="bf-btn bf-btn-ghost mt-4 w-full text-sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Çıkış
        </button>
      </div>
    </aside>
  );
}
