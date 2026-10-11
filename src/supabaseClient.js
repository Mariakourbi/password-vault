import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ychpjzelkhydysernugq.supabase.co';
const supabaseAnonKey = 'sb_publishable_9Ral_QiB--ke-RfbDcH-6Q_Z3QYobAp';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);