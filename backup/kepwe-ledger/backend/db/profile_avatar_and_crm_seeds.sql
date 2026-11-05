-- Migration: User Profile Photo & Sales CRM Initial Data
-- Adds avatar storage columns to users table and seeds CRM leads

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_data') THEN
        ALTER TABLE users ADD COLUMN avatar_data BYTEA;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_mime') THEN
        ALTER TABLE users ADD COLUMN avatar_mime VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Seed initial CRM leads if table is currently empty
DO $$
DECLARE
    leads_count INT;
    lead1_id UUID := gen_random_uuid();
    lead2_id UUID := gen_random_uuid();
    lead3_id UUID := gen_random_uuid();
    lead4_id UUID := gen_random_uuid();
    lead5_id UUID := gen_random_uuid();
BEGIN
    SELECT COUNT(*) INTO leads_count FROM crm_leads;
    IF leads_count = 0 THEN
        INSERT INTO crm_leads (id, company_name, contact_name, mobile, email, cin, gstin, incorporation_date, industry, state, gst_status, lead_score, lead_source, status, created_at, updated_at)
        VALUES
        (lead1_id, 'ABC Technologies Pvt Ltd', 'Vikram Sharma', '+91 9334771234', 'vikram@abctech.example.com', 'U72200MH2026PTC384920', '27AABCA1234H1Z5', '2026-08-05', 'IT Services', 'Maharashtra', 'Active', 'HOT', 'New Incorporation Database', 'Interested', NOW() - INTERVAL '2 days', NOW()),
        (lead2_id, 'Apex Global Logistics LLP', 'Ananya Deshmukh', '+91 9811123456', 'ananya@apexlogistics.example.com', 'AAB-9821', '07AAFFA9988G1Z2', '2026-08-01', 'Exporters / Freight', 'Delhi', 'Active', 'HOT', 'GST Filing Portal Inbound', 'Connected', NOW() - INTERVAL '4 days', NOW()),
        (lead3_id, 'Zenith Retail & E-Commerce', 'Rohan Mehta', '+91 9900034567', 'rohan@zenithretail.example.com', 'U52100GJ2026PTC443102', '24AAACZ4321J1Z9', '2026-07-28', 'E-commerce', 'Gujarat', 'Active', 'WARM', 'Free Compliance Check Form', 'Called', NOW() - INTERVAL '6 days', NOW()),
        (lead4_id, 'Sunrise Food & Spices Pvt Ltd', 'Priya Nair', '+91 9777745678', 'priya@sunriseproducts.example.com', 'U15100KA2026PTC112233', NULL, '2026-08-10', 'Food Processing', 'Karnataka', 'Pending Registration', 'WARM', 'Contact Page', 'New', NOW() - INTERVAL '1 day', NOW()),
        (lead5_id, 'Kalyan Industrial Fabricators', 'Rajesh Patel', '+91 9444456789', 'rajesh@kalyanfab.example.com', 'U28100TN2026PTC554433', '33AABCK5544M1Z8', '2026-06-15', 'Manufacturing', 'Tamil Nadu', 'Active', 'COLD', 'MCA Incorporation Feed', 'Converted', NOW() - INTERVAL '15 days', NOW());

        -- Insert initial activities for leads
        INSERT INTO lead_activities (lead_id, activity, created_at)
        VALUES
        (lead1_id, 'Lead captured from MCA Inbound feed', NOW() - INTERVAL '2 days'),
        (lead1_id, 'Call 1 — Intro call completed; client requested GST + Payroll proposal', NOW() - INTERVAL '1 day'),
        (lead2_id, 'Lead captured via GST Filing Portal Inbound', NOW() - INTERVAL '4 days'),
        (lead2_id, 'Connected with Director Ananya; sent compliance audit report', NOW() - INTERVAL '3 days'),
        (lead3_id, 'Free compliance check submitted on website', NOW() - INTERVAL '6 days'),
        (lead3_id, 'Call 1 — Left voicemail and sent WhatsApp intro', NOW() - INTERVAL '5 days'),
        (lead4_id, 'New lead created via Contact Us form', NOW() - INTERVAL '1 day'),
        (lead5_id, 'Proposal accepted: Kepwe Scale plan finalized', NOW() - INTERVAL '15 days');
    END IF;
END $$;
