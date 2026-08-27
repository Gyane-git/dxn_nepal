import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await getCurrentUser();
  const dealer = user ? await prisma.dealer.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-6 flex gap-2 overflow-x-auto scrollbar-none border-b border-gray-100 text-sm font-medium text-gray-600">
        <Link href="/account" className="shrink-0 whitespace-nowrap px-3 py-2 hover:text-primary-600">
          My Account
        </Link>
        <Link href="/account/orders" className="shrink-0 whitespace-nowrap px-3 py-2 hover:text-primary-600">
          My Orders
        </Link>
        <Link href="/account/addresses" className="shrink-0 whitespace-nowrap px-3 py-2 hover:text-primary-600">
          My Addresses
        </Link>
        {dealer && (
          <>
            <Link href="/account/dealer-orders" className="shrink-0 whitespace-nowrap px-3 py-2 hover:text-primary-600">
              Dealer Orders
            </Link>
            <Link href="/account/dealer-inventory" className="shrink-0 whitespace-nowrap px-3 py-2 hover:text-primary-600">
              My Inventory
            </Link>
          </>
        )}
      </nav>
      {children}
    </div>
  );
}
