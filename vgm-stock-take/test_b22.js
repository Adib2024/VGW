import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing b17...');
  const { data: dataB17, error: errB17 } = await supabase.from('b17').select('*').limit(1);
  console.log('B17 Error:', errB17);
  console.log('B17 Data:', dataB17);

  console.log('\nTesting b22...');
  const { data: dataB22, error: errB22 } = await supabase.from('b22').select('*').limit(1);
  console.log('B22 Error:', errB22);
  console.log('B22 Data:', dataB22);
  
  console.log('\nTesting loma...');
  const { data: dataLoma, error: errLoma } = await supabase.from('loma').select('*').limit(1);
  console.log('Loma Error:', errLoma);
}

test();
