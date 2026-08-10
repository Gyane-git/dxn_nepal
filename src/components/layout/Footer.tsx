import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white text-gray-500">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-gray-500">
            Quality products crafted for a healthier everyday life.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
            Shop
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-500">
            <li>
              <Link href="/shop" className="hover:text-primary-600">
                All Products
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-primary-600">
                Cart
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
            Account
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-gray-500">
            <li>
              <Link href="/account/orders" className="hover:text-primary-600">
                My Orders
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-primary-600">
                Login
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-primary-600">
                Create Account
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
            Support
          </h4>
          <p className="mt-3 text-sm text-gray-500">info@dxn.com</p>
          <p className="text-sm text-gray-500">General Line: +603-60339800</p>
          <p className="text-sm text-gray-500">Sales Counter: +603-60339834</p>
        </div>
      </div>
      <div className="border-t border-gray-100 px-4 py-4 text-center text-xs text-gray-400">
        <p>&copy; {new Date().getFullYear()} DXN. All rights reserved.</p>
        <p className="mt-1">
          Cash on Delivery &amp; secure online checkout available.
        </p>
      </div>
    </footer>
  );
}
