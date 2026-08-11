export interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  slug: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}
