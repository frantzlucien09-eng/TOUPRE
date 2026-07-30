import { isAdCategory } from './categories';
import { isClassifiedPubliclyVisible } from './listingStatus';
import type { Product } from './types';

/** Copy for customers attempting cart/checkout on Kay/Machin ads. */
export const CLASSIFIED_CONTACT_ONLY_MSG =
  'Anons Kay/Machin se pou kontak vandè sèlman — pa nan panye ni checkout.';

/** Physical marketplace goods can enter cart/checkout; classified ads cannot. */
export function canAddProductToCart(product: Pick<Product, 'category'>): boolean {
  return !isAdCategory(product.category);
}

export function assertCanAddProductToCart(product: Pick<Product, 'category'>): void {
  if (!canAddProductToCart(product)) {
    throw new Error(CLASSIFIED_CONTACT_ONLY_MSG);
  }
}

/** Public feed / search visibility (marketplace + classified rules). */
export function filterPublicCatalogProducts<T extends Product>(products: T[]): T[] {
  return products.filter((p) => isClassifiedPubliclyVisible(p));
}
