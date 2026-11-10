export interface Business {
  id: string;
  name: string;
  subscription_status?: string;
  created_at?: string;
}

export interface User {
  id: string;
  phone_number: string;
  business_id: string;
  role_type: 'SUPER_ADMIN' | 'SME_OWNER' | 'SME_STAFF';
  name: string;
  status?: string;
}