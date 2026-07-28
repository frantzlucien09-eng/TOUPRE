import type { Product } from '@/lib/types';
import { formatHTG } from '@/lib/format';
import { CATEGORY_ICON, CATEGORY_LABEL } from '@/lib/categories';
import { Image as ImageIcon, Star, MapPin } from 'lucide-react';

export type ProductBadge = 'new' | 'popular' | 'top' | null;

type Props = {
  product: Product;
  onClick?: () => void;
  vendorName?: string;
  rating?: number;
  distance?: string;
  badge?: ProductBadge;
  showVendor?: boolean;
};

export function ProductCard({
  product,
  onClick,
  vendorName,
  rating,
  distance,
  badge,
  showVendor = false,
}: Props) {
  const photos = product.photos ?? [];
  const cover = photos[product.cover_index] ?? photos[0] ?? product.image_url ?? null;
  const category = product.category as Product['category'];

  return (
    <button
      onClick={onClick}
      className="group flex flex-col text-left bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden active:scale-95 transition w-full"
    >
      {/* Photo — consistent 1:1 aspect ratio */}
      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon size={28} />
          </div>
        )}

        {/* Category icon (top-left) */}
        {category && (
          <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] shadow-sm">
            {CATEGORY_ICON[category]}
          </span>
        )}

        {/* Badge (top-right) */}
        {badge && <BadgeChip badge={badge} />}

        {/* Photo count */}
        {photos.length > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white rounded-full px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-0.5">
            <ImageIcon size={9} /> {photos.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 p-2.5">
        {/* Name — max 2 lines, truncated */}
        <h3
          className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 break-words min-h-[2.5rem]"
          title={product.name}
        >
          {product.name}
        </h3>

        {/* Price */}
        <p className="text-base font-bold text-emerald-600 leading-tight">
          {product.price_on_request ? 'Pri sou Demand' : formatHTG(product.price)}
        </p>

        {/* Secondary info */}
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {showVendor && vendorName && (
            <span className="text-[11px] text-slate-500 truncate max-w-[7rem]">{vendorName}</span>
          )}
          {rating != null && rating > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-amber-600 font-medium">
              <Star size={10} fill="currentColor" /> {rating.toFixed(1)}
            </span>
          )}
          {distance && (
            <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
              <MapPin size={10} /> {distance}
            </span>
          )}
        </div>

        {category && (
          <span className="text-[10px] text-slate-400 mt-0.5 truncate">{CATEGORY_LABEL[category]}</span>
        )}
      </div>
    </button>
  );
}

function BadgeChip({ badge }: { badge: NonNullable<ProductBadge> }) {
  const map = {
    new: { label: 'Nouvo', cls: 'bg-emerald-500 text-white' },
    popular: { label: 'Popilè', cls: 'bg-amber-500 text-white' },
    top: { label: 'Pi Vann', cls: 'bg-rose-500 text-white' },
  } as const;
  const b = map[badge];
  return (
    <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${b.cls}`}>
      {b.label}
    </span>
  );
}

export function ProductCardGrid({
  products,
  onOpen,
  vendorNames,
  ratings,
  badges,
  showVendor = false,
}: {
  products: Product[];
  onOpen: (p: Product) => void;
  vendorNames?: Record<string, string>;
  ratings?: Record<string, number>;
  badges?: Record<string, ProductBadge>;
  showVendor?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          onClick={() => onOpen(p)}
          vendorName={vendorNames?.[p.vendor_id]}
          rating={ratings?.[p.vendor_id]}
          badge={badges?.[p.id] ?? null}
          showVendor={showVendor}
        />
      ))}
    </div>
  );
}
