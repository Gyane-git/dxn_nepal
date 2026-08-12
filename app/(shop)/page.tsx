import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product/ProductCard";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { PromoProductColumns } from "@/components/home/PromoProductColumns";
import { CategoryBrandGrid } from "@/components/home/CategoryBrandGrid";

const HERO_BANNER_IMAGE = "/images/hero-banner.jpg";

export const revalidate = 60;

const TRUST_ITEMS = [
  {
    label: "Cash on Delivery available",
    icon: <path d="M3 8h18M5 8v10a1 1 0 001 1h12a1 1 0 001-1V8M9 12h6" />,
  },
  {
    label: "Easy Returns",
    icon: <path d="M4 4v6h6M4 10a8 8 0 1 1 2.3 5.7" />,
  },
  {
    label: "100% Genuine Products",
    icon: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
  },
];

function mapPromoProduct(p: {
  id: number;
  name: string;
  slug: string;
  price: unknown;
  compareAtPrice: unknown;
  colorway: string;
  images: { url: string | null }[];
  brand: { name: string } | null;
}) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    colorway: p.colorway,
    image: p.images[0]?.url ?? null,
    brandName: p.brand?.name ?? null,
  };
}

function mapProductCard(p: {
  id: number;
  name: string;
  slug: string;
  price: unknown;
  compareAtPrice: unknown;
  colorway: string;
  stock: number;
  images: { url: string | null }[];
  category: { name: string; slug: string } | null;
  reviews: { rating: number }[];
}) {
  const avgRating = p.reviews.length
    ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
    : 0;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    colorway: p.colorway,
    stock: p.stock,
    image: p.images[0]?.url ?? null,
    category: p.category ?? undefined,
    rating: Math.round(avgRating * 10) / 10,
    reviewCount: p.reviews.length,
  };
}

const CARD_INCLUDE = {
  category: true,
  images: { take: 1 as const },
  reviews: { select: { rating: true as const } },
};

async function getHomeData() {
  const [
    categories,
    brands,
    products,
    banners,
    specialProducts,
    weeklyProducts,
    flashProducts,
    newArrivals,
    onSaleProducts,
    trendingProducts,
  ] = await Promise.all([
    prisma.category.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.brand.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: CARD_INCLUDE,
    }),
    prisma.homeBannerSlide.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", deletedAt: null, isSpecial: true },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 }, brand: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", deletedAt: null, isWeekly: true },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 }, brand: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", deletedAt: null, isFlash: true },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 }, brand: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", deletedAt: null, isNewArrival: true },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 }, brand: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", deletedAt: null, isOnSale: true },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 }, brand: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", deletedAt: null, isTrending: true },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 }, brand: { select: { name: true } } },
    }),
  ]);

  return {
    categories,
    brands,
    banners: banners.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      image: b.image,
      linkUrl: b.linkUrl,
      buttonText: b.buttonText,
    })),
    products: products.map(mapProductCard),
    specialProducts: specialProducts.map(mapPromoProduct),
    weeklyProducts: weeklyProducts.map(mapPromoProduct),
    flashProducts: flashProducts.map(mapPromoProduct),
    newArrivals: newArrivals.map(mapPromoProduct),
    onSaleProducts: onSaleProducts.map(mapPromoProduct),
    trendingProducts: trendingProducts.map(mapPromoProduct),
  };
}

export default async function HomePage() {
  const {
    categories,
    brands,
    products,
    banners,
    specialProducts,
    weeklyProducts,
    flashProducts,
    newArrivals,
    onSaleProducts,
    trendingProducts,
  } = await getHomeData();

  return (
    <div>
      {banners.length > 0 ? (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <HeroCarousel slides={banners} />
        </div>
      ) : (
        <section className="relative isolate overflow-hidden">
          <Image
            src={HERO_BANNER_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/70 to-primary-900/30" />

          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-36 lg:px-8">
            <div className="max-w-xl text-center lg:text-left">
              <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Wellness, Naturally
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Live Well with <span className="text-secondary-300">DXN</span>
              </h1>
              <p className="mx-auto mt-5 max-w-md text-lg text-primary-50 lg:mx-0">
                Ganoderma-infused coffee, spirulina supplements, and personal
                care — delivered to your door with Cash on Delivery available.
              </p>
              <div className="mt-8 flex justify-center gap-3 lg:justify-start">
                <Link
                  href="/shop"
                  className="rounded-full bg-secondary-500 px-7 py-3.5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-secondary-600 hover:shadow-soft-lg"
                >
                  Shop Now
                </Link>
                <Link
                  href="/shop"
                  className="rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Explore Categories
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <CategoryBrandGrid
        title="Categories"
        items={categories}
        hrefFor={(slug) => `/shop?category=${slug}`}
      />

      <CategoryBrandGrid
        title="Brands"
        items={brands.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          image: b.logo,
        }))}
        hrefFor={(slug) => `/shop?brand=${slug}`}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Featured Products
          </h2>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            View all
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              className="border border-gray-200"
            />
          ))}
        </div>
      </section>

      <PromoProductColumns
        columns={[
          { title: "Special Products", products: specialProducts },
          { title: "Weekly Products", products: weeklyProducts },
          { title: "Flash Products", products: flashProducts },
        ]}
      />

      <PromoProductColumns
        columns={[
          { title: "New Arrivals", products: newArrivals },
          { title: "On Sale", products: onSaleProducts },
          { title: "Trending Now", products: trendingProducts },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="mt-6 border-b border-gray-100 bg-white">
          <div className="grid grid-cols-1 gap-6 py-8 text-center sm:grid-cols-3">
            {TRUST_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-start md:justify-center gap-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                  >
                    {item.icon}
                  </svg>
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
