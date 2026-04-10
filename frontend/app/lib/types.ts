export type MacroMap = {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  sodium_mg?: number | null;
  sugar_g?: number | null;
};

export type MenuItem = {
  restaurant_id: string;
  restaurant_name: string;
  item_name: string;
  category?: string | null;
  portion?: string | null;
  unique_key: string;
  price_cad?: number | null;
  source_url?: string | null;
  scraped_at?: string | null;
  macros?: MacroMap;
  description?: string | null;
  nutrition_invalid?: boolean;
};

export type RestaurantSummary = {
  restaurant_id: string;
  restaurant_name: string;
  item_count: number;
  priced_count: number;
  description?: string;
};

export type UserRecord = {
  name: string;
  email: string;
  role?: "user" | "restaurant_owner" | "admin";
  owned_restaurant_ids?: string[];
  notifications?: NotificationRecord[];
};

export type NotificationRecord = {
  title: string;
  message: string;
  created_at: string;
};

export type RepresentativeItemDraft = {
  item_name: string;
  category?: string | null;
  portion?: string | null;
  price_cad?: number | null;
  image_url?: string | null;
  description?: string | null;
  macros?: MacroMap;
};

export type RestaurantListingPayload = {
  restaurant_id?: string;
  restaurant_name: string;
  owner_full_name: string;
  owner_role: string;
  restaurant_email: string;
  phone: string;
  official_website?: string | null;
  menu_note?: string | null;
  nutrition_pdf_url?: string | null;
  menu_url?: string | null;
  restaurant_image_url?: string | null;
  menu_sheet_url?: string | null;
  representative_items?: RepresentativeItemDraft[];
};

export type SubmissionRecord = {
  id: string;
  type: "restaurant_access" | "menu_item" | "restaurant_listing";
  status: "pending" | "approved" | "rejected";
  restaurant_id?: string;
  restaurant_name?: string;
  user_email?: string;
  user_name?: string;
  note?: string;
  admin_note?: string;
  created_at?: string;
  reviewed_at?: string;
  payload?: Partial<MenuItem> | RestaurantListingPayload | null;
};
