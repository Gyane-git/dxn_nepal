import { PromoProductCard, type PromoProduct } from "@/components/home/PromoProductCard";

interface PromoColumn {
  title: string;
  products: PromoProduct[];
}

const GRID_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

export function PromoProductColumns({ columns }: { columns: PromoColumn[] }) {
  const visible = columns.filter((c) => c.products.length > 0);
  if (visible.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className={`grid grid-cols-1 gap-8 ${GRID_COLS[visible.length]}`}>
        {visible.map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800">{column.title}</h2>
            <div className="mt-4 flex flex-col gap-3">
              {column.products.map((product) => (
                <PromoProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
