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
  /** Optional photo URL (absolute http(s) or /uploads/... served by API). */
  image_url?: string | null;
};

export type RestaurantSummary = {
  restaurant_id: string;
  restaurant_name: string;
  item_count: number;
  priced_count: number;
  description?: string;
  restaurant_image_url?: string | null;
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

export type ItemIssueType =
  | "wrong_nutrition_info"
  | "wrong_price"
  | "item_discontinued"
  | "wrong_category_or_diet_tag"
  | "wrong_image"
  | "broken_source_link"
  | "duplicate_listing"
  | "other";

export type ItemIssueStatus = "open" | "in_review" | "resolved" | "dismissed";

export type ItemIssueRecord = {
  id: string;
  status: ItemIssueStatus;
  issue_type: ItemIssueType;
  note?: string | null;
  attachment_url?: string | null;
  unique_key: string;
  restaurant_id: string;
  restaurant_name: string;
  item_name: string;
  item_category?: string | null;
  price_cad?: number | null;
  source_url?: string | null;
  reported_by_name?: string | null;
  reported_by_email?: string | null;
  reported_at?: string;
  reviewed_at?: string;
  reviewed_by_email?: string | null;
  manager_note?: string | null;
};
