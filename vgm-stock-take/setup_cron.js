const query = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION sweep_inactive_users() RETURNS void AS $$
DECLARE
    expired_user RECORD;
BEGIN
    FOR expired_user IN 
        SELECT id, last_ping FROM users 
        WHERE is_logged_in = true 
        AND last_ping < NOW() - INTERVAL '5 minutes'
    LOOP
        INSERT INTO audit_logs (user_id, action, device_type, created_at)
        VALUES (expired_user.id, 'AUTO_LOGOUT', 'Background Timeout', expired_user.last_ping + INTERVAL '5 minutes');
        
        UPDATE users 
        SET is_logged_in = false 
        WHERE id = expired_user.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule('auto_logout_sweeper', '* * * * *', 'SELECT sweep_inactive_users();');
`;

fetch('https://bivmikodcobvlperfoac.supabase.co/rest/v1/rpc/create_dynamic_table', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: 'sb_publishable_2sKN7mVGgwM6-mO9B45gIg_pkY3SzeM',
    Authorization: 'Bearer sb_publishable_2sKN7mVGgwM6-mO9B45gIg_pkY3SzeM'
  },
  body: JSON.stringify({ query })
}).then(res => res.text()).then(console.log).catch(console.error);
