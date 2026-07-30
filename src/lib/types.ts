export type Vendor = {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  status: string; // 'pending' | 'active' | 'suspended'
  is_verified: boolean;
  commission_rate: number;
  total_products: number;
  total_sales: number;
  rating_average: number;
  rating_count: number;
  balance: number;
  points: number;
  trust_score: number;
  orders_sent: number;
  joined_at: string;
  department: string | null;
  city: string | null;
  address: string | null;
  pickup_address: string | null;
  moncash_phone: string | null;
  moncash_name: string | null;
  last_login_at: string | null;
  search_count: number;
  sold_count: number;
  view_count: number;
  first_sold_at: string | null;
  last_sold_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type KycStatus = 'pending' | 'approved' | 'rejected' | 'resubmit';

export type VendorKyc = {
  id: string;
  vendor_id: string;
  last_name: string;
  first_names: string;
  birth_date: string;
  sex: 'male' | 'female' | 'other';
  id_number: string;
  id_front_url: string;
  id_back_url: string;
  selfie_with_id_url: string;
  department: string | null;
  city: string | null;
  address: string | null;
  business_description: string | null;
  business_name: string;
  business_category: string | null;
  business_short_desc: string | null;
  business_registration: string | null;
  referral_source: string | null;
  referral_detail: string | null;
  moncash_phone: string;
  moncash_name: string;
  consent_accepted: boolean;
  signature: string | null;
  status: KycStatus;
  admin_name_match: boolean | null;
  admin_selfie_match: boolean | null;
  rejection_reason: string | null;
  reviewer_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type ProductCategory = 'kay' | 'machin' | 'manje' | 'rad' | 'soulye' | 'lot';

export type AdStatus = 'draft' | 'active' | 'sold' | 'expired' | null;

export type ProductModerationStatus = 'pending' | 'active' | 'rejected' | 'draft';

export type Product = {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  active: boolean;
  /** Admin moderation status. */
  status: ProductModerationStatus | string;
  category: ProductCategory | null;
  // Flexible category-specific payload (kay/machin/manje/rad/soulye).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>;
  photos: string[];
  cover_index: number;
  video_url: string | null;
  price_on_request: boolean;
  ad_status: AdStatus;
  ad_paid_at: string | null;
  ad_expires_at: string | null;
  search_count?: number;
  view_count?: number;
  sold_count?: number;
  first_sold_at?: string | null;
  last_sold_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdPayment = {
  id: string;
  vendor_id: string;
  product_id: string;
  amount: number;
  category: string;
  status: 'pending' | 'paid' | 'failed';
  moncash_phone: string | null;
  paid_at: string | null;
  created_at: string;
};

export type OrderItem = {
  product_id: string;
  name: string;
  qty: number;
  price: number;
};

export type Order = {
  id: string;
  customer_id: string | null;
  vendor_id: string;
  items: OrderItem[];
  total: number;
  delivery_type: 'delivery' | 'pickup';
  status: OrderStatus;
  reject_reason: string | null;
  delivery_note: string | null;
  delivery_proof_url: string | null;
  payment_status: 'pending' | 'paid' | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  customer?: Customer | null;
};

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_pickup'
  | 'delivering'
  | 'delivered'
  | 'picked_up'
  | 'cancelled';

export type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

export type Withdrawal = {
  id: string;
  vendor_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'paid' | 'rejected';
  requested_at: string;
  processed_at: string | null;
  received_at: string | null;
  note: string | null;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export type TrustHistory = {
  id: string;
  vendor_id: string;
  delta: number;
  reason: string | null;
  new_score: number;
  created_at: string;
};

export type VendorMonthlyStat = {
  id: string;
  vendor_id: string;
  year: number;
  month: number;
  orders_count: number;
  revenue: number;
  zone_rank: number | null;
  national_rank: number | null;
  computed_at: string;
  vendor?: Pick<Vendor, 'id' | 'business_name' | 'avatar_url' | 'department' | 'city'> | null;
};

/** Flat row from `vendor_rankings` used on Profile leaderboard. */
export type VendorRanking = {
  vendor_id: string;
  zone_rank: number | null;
  national_rank: number | null;
  score: number;
  total_sales_count: number;
  total_revenue: number;
  department: string | null;
  city: string | null;
  business_name: string | null;
  avatar_url: string | null;
};

export type SocialPlatform = {
  id: string;
  name: string;
  label: string;
  url: string;
  icon_key: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type NameChangeRequest = {
  id: string;
  vendor_id: string;
  old_name: string;
  requested_name: string;
  status: 'pending' | 'approved' | 'rejected';
  otp_code: string;
  otp_verified: boolean;
  otp_expires_at: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer_note: string | null;
};

export type AvatarReviewRequest = {
  id: string;
  vendor_id: string;
  new_avatar_url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type Zone = {
  id: string;
  department: string;
  city: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string | null;
  order_id: string | null;
  product_id: string | null;
  sender_id: string;
  receiver_id: string | null;
  recipient_id: string;
  body: string;
  image_url: string | null;
  attachment_url: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
};
