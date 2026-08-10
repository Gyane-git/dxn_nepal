import Link from "next/link";
import Image from "next/image";

export interface GridTile {
  id: number;
  name: string;
  slug: string;
  image: string | null;
}

interface CategoryBrandGridProps {
  title: string;
  items: GridTile[];
  hrefFor: (slug: string) => string;
}

export function CategoryBrandGrid({ title, items, hrefFor }: CategoryBrandGridProps) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
      <div className="mt-6 grid grid-cols-2 border-l border-t border-gray-200 sm:grid-cols-4 lg:grid-cols-7">
        {items.map((item) => (
          <Link
            key={item.id}
            href={hrefFor(item.slug)}
            className="relative flex flex-col items-center gap-3 border-b border-r border-gray-200 bg-white px-4 py-6 text-center transition-all duration-200 hover:z-10 hover:scale-[1.03] hover:border hover:border-gray-200 hover:shadow-soft-lg"
          >
            <div className="relative h-20 w-20 shrink-0">
              {item.image ? (
                <Image src={item.image} alt={item.name} fill sizes="80px" className="object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100 text-lg font-semibold text-gray-400">
                  {item.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-sm font-semibold text-primary-700">{item.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
