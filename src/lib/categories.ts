import type { ProductCategory } from './types';

export const CATEGORIES: { key: ProductCategory; label: string; icon: string }[] = [
  { key: 'kay', label: 'Kay / Pwopriyete', icon: '🏠' },
  { key: 'machin', label: 'Machin / Veyikil', icon: '🚗' },
  { key: 'manje', label: 'Manje / Bwason', icon: '🍲' },
  { key: 'rad', label: 'Rad', icon: '👕' },
  { key: 'soulye', label: 'Soulye / Tenis', icon: '👟' },
  { key: 'lot', label: 'Lòt', icon: '📦' },
];

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  kay: 'Kay / Pwopriyete',
  machin: 'Machin / Veyikil',
  manje: 'Manje / Bwason',
  rad: 'Rad',
  soulye: 'Soulye / Tenis',
  lot: 'Lòt',
};

export const CATEGORY_ICON: Record<ProductCategory, string> = {
  kay: '🏠',
  machin: '🚗',
  manje: '🍲',
  rad: '👕',
  soulye: '👟',
  lot: '📦',
};

export const KAY_TYPES = ['Kay', 'Apatman', 'Teren', 'Lokal Komèsyal', 'Biznis', 'Lòt'];
export const KAY_FEATURES = [
  { key: 'has_electricity', label: 'Gen Kouran' },
  { key: 'has_water', label: 'Gen Dlo' },
  { key: 'has_garage', label: 'Gen Garaj' },
  { key: 'has_ac', label: 'Klimatize' },
  { key: 'is_fenced', label: 'Kay Klotire' },
];

export const CAR_MAKES = ['Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 'Suzuki', 'Lòt'];
export const CAR_FUELS = ['Gazolin', 'Dyezèl', 'Elektrik', 'Ibrid'];
export const CAR_TRANSMISSIONS = ['Manyèl', 'Otomatik'];
export const CAR_CONDITIONS = ['Nèf', 'Sekonmen — Byen Kenbe', 'Sekonmen — Bezwen Repasyon'];

export const FOOD_TYPES = ['Manje Kwit', 'Patisri', 'Fwi / Legim', 'Bwason', 'Lòt'];
export const FOOD_AVAILABILITY = ['Toujou Disponib', 'Sou Kòmand Sèlman'];

export const CLOTHING_TYPES = ['Chemiz', 'Pantalon', 'Rad Fanm', 'Rad Timoun', 'Jip', 'Lòt'];
export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const CLOTHING_SEXES = ['Gason', 'Fanm', 'Timoun', 'Inisèks'];

export const SHOE_BRANDS = ['Nike', 'Adidas', 'Puma', 'Reebok', 'Lokal / San Mak', 'Lòt'];
export const SHOE_CONDITIONS = ['Nèf', 'Sekonmen — Byen Kenbe'];
export const SHOE_SIZES = ['32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

export const AD_FEE = 2500; // default fallback — prefer loadListingFeeSettings()
export const AD_DURATION_DAYS = 30; // default fallback — prefer loadListingFeeSettings()
export const AD_CATEGORIES: ProductCategory[] = ['kay', 'machin'];

export function isAdCategory(cat: ProductCategory | null | undefined): boolean {
  return !!cat && AD_CATEGORIES.includes(cat);
}
