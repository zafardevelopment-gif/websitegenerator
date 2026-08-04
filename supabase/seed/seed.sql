-- ═══════════════════════════════════════════════════════════════════
-- seed.sql — sample data for development & manual testing (Phase 2)
-- Safe to run once after migrations 0001–0004. Idempotent-ish: uses
-- fixed UUIDs and ON CONFLICT DO NOTHING so re-running doesn't duplicate.
-- ═══════════════════════════════════════════════════════════════════

-- ── Template registry (component code ships in Phase 5) ─────────────

insert into public.aiwebsite_templates (id, key, name, category, description, color_variants, layout_variants, sort_order)
values
  ('11111111-1111-4111-8111-111111111101', 'dental',     'Bright Smile',   'Dental Clinic',    'Clean medical look with appointment-first hero.',            '["mint","sky","royal","coral"]', '["classic","split-hero"]', 1),
  ('11111111-1111-4111-8111-111111111102', 'restaurant', 'Tandoor Table',  'Restaurant',       'Appetite-driven imagery, menu highlights, reservations.',    '["ember","olive","charcoal"]',   '["classic","gallery-first"]', 2),
  ('11111111-1111-4111-8111-111111111103', 'salon',      'Velvet Chair',   'Salon',            'Elegant beauty aesthetic with services and price list.',     '["blush","noir","lavender"]',    '["classic","split-hero"]', 3),
  ('11111111-1111-4111-8111-111111111104', 'gym',        'Iron Pulse',     'Gym',              'High-energy dark theme with programs and trainers.',         '["volt","crimson","steel"]',     '["classic","stats-first"]', 4),
  ('11111111-1111-4111-8111-111111111105', 'general',    'Local Pro',      'General Business', 'Versatile professional layout for any local business.',      '["indigo","teal","amber","slate"]', '["classic","compact"]', 5)
on conflict (key) do nothing;

-- ── Sample leads (Delhi NCR, varied categories & pipeline stages) ────

insert into public.aiwebsite_leads
  (id, business_name, category, owner_name, phone, whatsapp, google_rating, review_count,
   address, area, city, state, pincode, services, priority, lead_score, status, lead_source, tags)
values
  ('22222222-2222-4222-8222-222222222201', 'Smile Dental Care', 'Dental Clinic', 'Dr. Anjali Mehra',
   '+919810000001', '+919810000001', 4.7, 312,
   '12 Ajmal Khan Road', 'Karol Bagh', 'New Delhi', 'Delhi', '110005',
   '["Root Canal", "Implants", "Braces", "Teeth Whitening"]', 'high', 86, 'demo_deployed',
   'google_maps', '{dentist,karol-bagh,no-website}'),
  ('22222222-2222-4222-8222-222222222202', 'Tandoori Nights', 'Restaurant', 'Rakesh Chawla',
   '+919810000002', '+919810000002', 4.3, 1240,
   'M-Block Market', 'Greater Kailash', 'New Delhi', 'Delhi', '110048',
   '["North Indian", "Mughlai", "Catering"]', 'medium', 72, 'new',
   'google_maps', '{restaurant,gk}'),
  ('22222222-2222-4222-8222-222222222203', 'Glow & Grace Salon', 'Salon', 'Pooja Arora',
   '+919810000003', '+919810000003', 4.8, 189,
   'DLF Phase 4', 'Sector 28', 'Gurugram', 'Haryana', '122002',
   '["Hair", "Makeup", "Bridal", "Skin Care"]', 'high', 81, 'whatsapp_sent',
   'instagram', '{salon,gurugram,no-website}'),
  ('22222222-2222-4222-8222-222222222204', 'Iron Temple Gym', 'Gym', 'Vikram Singh',
   '+919810000004', '+919810000004', 4.5, 267,
   'Sector 18 Market', 'Sector 18', 'Noida', 'Uttar Pradesh', '201301',
   '["Strength Training", "CrossFit", "Personal Training", "Zumba"]', 'medium', 68, 'new',
   'google_maps', '{gym,noida}'),
  ('22222222-2222-4222-8222-222222222205', 'Kapoor & Associates', 'CA', 'CA Nitin Kapoor',
   '+919810000005', '+919810000005', 4.9, 58,
   'Connaught Place', 'CP Block A', 'New Delhi', 'Delhi', '110001',
   '["GST Filing", "Audit", "Company Registration", "ITR"]', 'low', 55, 'interested',
   'referral', '{ca,cp}')
on conflict (id) do nothing;

-- Coordinates for the map view (also fixes rows seeded before Phase 4).
update public.aiwebsite_leads set latitude = 28.6519, longitude = 77.1909
  where id = '22222222-2222-4222-8222-222222222201' and latitude is null;
update public.aiwebsite_leads set latitude = 28.5494, longitude = 77.2425
  where id = '22222222-2222-4222-8222-222222222202' and latitude is null;
update public.aiwebsite_leads set latitude = 28.4595, longitude = 77.0870
  where id = '22222222-2222-4222-8222-222222222203' and latitude is null;
update public.aiwebsite_leads set latitude = 28.5708, longitude = 77.3260
  where id = '22222222-2222-4222-8222-222222222204' and latitude is null;
update public.aiwebsite_leads set latitude = 28.6315, longitude = 77.2167
  where id = '22222222-2222-4222-8222-222222222205' and latitude is null;

-- ── A deployed demo site with a version + sections ───────────────────

insert into public.aiwebsite_sites
  (id, lead_id, template_id, slug, name, mode, status, language_mode, color_variant, layout_variant,
   branding, demo_expires_at, published_at)
values
  ('33333333-3333-4333-8333-333333333301',
   '22222222-2222-4222-8222-222222222201',
   '11111111-1111-4111-8111-111111111101',
   'smiledental', 'Smile Dental Care', 'demo', 'live', 'en', 'mint', 'classic',
   '{"primary":"#0ea5a3","secondary":"#134e4a","accent":"#f59e0b","font_heading":"Poppins","font_body":"Inter"}',
   now() + interval '14 days', now())
on conflict (slug) do nothing;

insert into public.aiwebsite_site_versions (id, site_id, version_no, site_content, change_summary)
values
  ('44444444-4444-4444-8444-444444444401',
   '33333333-3333-4333-8333-333333333301', 1,
   '{
      "meta": {"title": "Smile Dental Care — Dentist in Karol Bagh", "description": "Trusted dental clinic in Karol Bagh, New Delhi. Root canal, implants, braces. Book an appointment today."},
      "hero": {"title": "Healthy smiles for the whole family", "subtitle": "Advanced, painless dentistry in the heart of Karol Bagh — trusted by 300+ happy patients.", "cta_primary": "Book Appointment", "cta_secondary": "Call Now"},
      "about": {"heading": "About Smile Dental Care", "body": "Led by Dr. Anjali Mehra, our clinic combines modern equipment with gentle care."},
      "services": [
        {"name": "Root Canal Treatment", "description": "Single-sitting, painless RCT with digital X-ray guidance.", "icon": "tooth"},
        {"name": "Dental Implants", "description": "Permanent, natural-looking replacements for missing teeth.", "icon": "implant"},
        {"name": "Braces & Aligners", "description": "Metal, ceramic and invisible aligner options for all ages.", "icon": "braces"},
        {"name": "Teeth Whitening", "description": "In-clinic whitening for a visibly brighter smile in one visit.", "icon": "sparkle"}
      ],
      "faqs": [
        {"q": "Do you offer painless root canal?", "a": "Yes — we use rotary endodontics and local anaesthesia for a comfortable experience."},
        {"q": "Are EMI options available for implants?", "a": "Yes, flexible EMI plans are available for major treatments."}
      ],
      "testimonials": [
        {"name": "Sample Patient", "text": "Wonderful experience, completely painless treatment. (Sample testimonial)", "rating": 5}
      ]
    }'::jsonb,
   'Initial seed content')
on conflict (site_id, version_no) do nothing;

update public.aiwebsite_sites
  set current_version_id = '44444444-4444-4444-8444-444444444401'
  where id = '33333333-3333-4333-8333-333333333301' and current_version_id is null;

-- Canonical SiteContent (packages/templates schema). Overwrites the legacy
-- shape on re-runs so the renderer always gets valid content.
update public.aiwebsite_site_versions set site_content = '{
  "meta": {
    "title": "Smile Dental Care — Dentist in Karol Bagh, New Delhi",
    "description": "Trusted dental clinic in Karol Bagh: painless root canal, implants, braces and whitening. 4.7★ from 312 Google reviews. Book on WhatsApp.",
    "keywords": ["dentist karol bagh", "root canal delhi", "dental implants"]
  },
  "business": {
    "name": "Smile Dental Care",
    "category": "Dental Clinic",
    "phone": "+91 98100 00001",
    "whatsapp": "+91 98100 00001",
    "email": "care@smiledentalcare.in",
    "address": "12 Ajmal Khan Road, Karol Bagh",
    "area": "Karol Bagh",
    "city": "New Delhi",
    "mapUrl": "",
    "mapEmbedUrl": "",
    "rating": 4.7,
    "reviewCount": 312,
    "socials": { "instagram": "", "facebook": "", "linkedin": "" },
    "openingHours": [
      { "days": "Mon – Sat", "hours": "10:00 AM – 8:30 PM" },
      { "days": "Sunday", "hours": "Closed" }
    ]
  },
  "hero": {
    "badge": "Painless • Modern • Trusted",
    "title": "Healthy smiles for the whole family",
    "subtitle": "Advanced, painless dentistry in the heart of Karol Bagh — trusted by 300+ happy patients.",
    "ctaPrimary": "Book Appointment",
    "ctaSecondary": "Call Now",
    "image": null
  },
  "about": {
    "heading": "About Smile Dental Care",
    "body": "Led by Dr. Anjali Mehra, our clinic combines modern equipment with gentle, patient-first care. From routine check-ups to full smile makeovers, every treatment is planned around your comfort.",
    "highlights": ["Single-sitting RCT", "Digital X-ray", "EMI available", "Strict sterilization"],
    "image": null
  },
  "services": {
    "heading": "Our Services",
    "items": [
      { "name": "Root Canal Treatment", "description": "Single-sitting, painless RCT with digital X-ray guidance.", "icon": "tooth" },
      { "name": "Dental Implants", "description": "Permanent, natural-looking replacements for missing teeth.", "icon": "implant" },
      { "name": "Braces & Aligners", "description": "Metal, ceramic and invisible aligner options for all ages.", "icon": "braces" },
      { "name": "Teeth Whitening", "description": "In-clinic whitening for a visibly brighter smile in one visit.", "icon": "sparkles" }
    ]
  },
  "whyUs": {
    "heading": "Why Choose Us",
    "items": [
      { "title": "Painless Treatment", "description": "Modern anaesthesia and rotary endodontics." },
      { "title": "Transparent Pricing", "description": "Estimates before every procedure, EMI plans available." },
      { "title": "Experienced Team", "description": "10+ years and thousands of happy patients." },
      { "title": "Hygiene First", "description": "Hospital-grade sterilization for every instrument." }
    ]
  },
  "gallery": { "heading": "Gallery", "images": [] },
  "testimonials": {
    "heading": "What Patients Say",
    "items": [
      { "name": "Sample Patient", "text": "Wonderful experience, completely painless treatment.", "rating": 5 },
      { "name": "Local Resident", "text": "Very hygienic clinic and courteous staff.", "rating": 5 }
    ]
  },
  "faqs": {
    "heading": "Frequently Asked Questions",
    "items": [
      { "q": "Do you offer painless root canal?", "a": "Yes — we use rotary endodontics and local anaesthesia for a comfortable, single-sitting experience." },
      { "q": "Are EMI options available for implants?", "a": "Yes, flexible EMI plans are available for implants and major treatments." }
    ]
  },
  "reviews": {
    "heading": "Loved on Google",
    "snippets": [
      "Completely painless root canal, doctor explained everything clearly.",
      "Very hygienic clinic and courteous staff. Worth every rupee.",
      "My kids actually enjoy dental visits now!"
    ]
  },
  "cta": {
    "heading": "Ready for a healthier smile?",
    "subheading": "Message us on WhatsApp — we reply within minutes.",
    "buttonText": "Book Appointment"
  },
  "contact": { "heading": "Contact Us", "note": "Walk-ins welcome; appointments get priority." },
  "footer": { "tagline": "Gentle dentistry, brilliant smiles." }
}'::jsonb
where id = '44444444-4444-4444-8444-444444444401';

insert into public.aiwebsite_site_sections (site_id, section_key, content, ai_generated)
values
  ('33333333-3333-4333-8333-333333333301', 'hero',
   '{"title": "Healthy smiles for the whole family", "subtitle": "Advanced, painless dentistry in the heart of Karol Bagh — trusted by 300+ happy patients."}', true),
  ('33333333-3333-4333-8333-333333333301', 'about',
   '{"heading": "About Smile Dental Care", "body": "Led by Dr. Anjali Mehra, our clinic combines modern equipment with gentle care."}', true)
on conflict (site_id, section_key) do nothing;

insert into public.aiwebsite_deployments (site_id, action, status, message, completed_at)
values
  ('33333333-3333-4333-8333-333333333301', 'publish', 'success', 'Seed publish of smiledental demo', now());

-- ── Sample engagement data (hot-lead signal) ─────────────────────────

insert into public.aiwebsite_site_visits (id, site_id, visitor_key, device_type, path, duration_sec)
values
  ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333301', 'seed-visitor-1', 'mobile', '/', 95),
  ('55555555-5555-4555-8555-555555555502', '33333333-3333-4333-8333-333333333301', 'seed-visitor-1', 'mobile', '/', 40)
on conflict (id) do nothing;

insert into public.aiwebsite_site_events (visit_id, site_id, event_type, section)
values
  ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333301', 'page_view', null),
  ('55555555-5555-4555-8555-555555555501', '33333333-3333-4333-8333-333333333301', 'cta_whatsapp', 'hero');

-- ── Message templates (WhatsApp pitch + follow-up sequence + email) ──

insert into public.aiwebsite_message_templates (key, channel, name, subject, body, language)
values
  ('whatsapp_pitch_v1', 'whatsapp', 'Initial demo pitch (Hinglish)', null,
   'Namaste {owner} ji! 🙏 Maine dekha ki {business} ki Google rating {rating}⭐ hai ({reviews} reviews) — kaafi impressive! Humne aapke business ke liye ek premium website demo ready ki hai, ek baar zaroor dekhiye: {demo_url} — Agar pasand aaye toh reply kijiye, 2 minute mein call par baat kar sakte hain. — Team AIVEXA', 'bilingual'),
  ('whatsapp_followup_day2', 'whatsapp', 'Follow-up day 2', null,
   '{owner} ji, kal wali website demo dekhi aapne? {demo_url} — koi bhi change chahiye toh bata dijiye, hum turant update kar denge. 😊', 'bilingual'),
  ('whatsapp_followup_day5', 'whatsapp', 'Follow-up day 5', null,
   '{owner} ji, {area} ke kai businesses ab online aa rahe hain. Aapki demo website sirf kuch din aur live rahegi: {demo_url} — chaliye isse aapki apni website bana dete hain?', 'bilingual'),
  ('whatsapp_followup_day10', 'whatsapp', 'Follow-up day 10 (last)', null,
   '{owner} ji, aapki demo website is hafte expire ho rahi hai. Agar interested hain toh aaj hi bataiye — special launch price ke saath domain + website ready kar denge. {demo_url}', 'bilingual'),
  ('email_pitch_v1', 'email', 'Initial demo pitch (email)', 'A ready website for {business} — take a look',
   'Hello {owner},\n\nWe noticed {business} has an excellent {rating}-star rating with {reviews} reviews on Google — but no website that does it justice.\n\nSo we built one. Your demo is live here: {demo_url}\n\nIf you like it, reply to this email or WhatsApp us and we will make it yours with your own domain.\n\nBest regards,\nTeam AIVEXA', 'en')
on conflict (key, version) do nothing;

-- ── Prompt templates (Phase 6 refines; strong defaults now) ──────────

insert into public.aiwebsite_prompt_templates (key, category, name, system_prompt, tone)
values
  ('site_content_default', null, 'Default website content generator',
   'You are an expert website copywriter for Indian local businesses. Generate complete, conversion-focused website content as strict JSON matching the provided SiteContent schema. Rules: never invent facts not present in the lead data; testimonials must be clearly generic samples, never real named people; keep language simple and trustworthy; include locality references (area, city) naturally for local SEO.', 'premium'),
  ('site_content_dental', 'Dental Clinic', 'Dental clinic content generator',
   'You are an expert medical website copywriter. Generate complete website content as strict JSON matching the provided SiteContent schema for a dental clinic. Rules: professional, reassuring, medically accurate tone; emphasize painless treatment, hygiene and modern equipment; never invent doctor credentials or clinical claims not present in lead data; testimonials must be clearly generic samples.', 'medical-professional'),
  ('whatsapp_pitch', null, 'WhatsApp pitch personalizer',
   'You write short, warm Hinglish WhatsApp messages for Indian business owners. Personalize using the owner name, business name, real Google rating/review count, and 1-2 specific compliments derived from the actual review data provided. Include the demo URL. Max 3 short paragraphs, one emoji per paragraph maximum, no fake claims.', 'friendly')
on conflict (key, version) do nothing;

-- ── Follow-ups & timeline entries ────────────────────────────────────

insert into public.aiwebsite_follow_ups (lead_id, due_at, note, status)
values
  ('22222222-2222-4222-8222-222222222201', now() + interval '1 day', 'Call Dr. Mehra — demo was viewed twice from mobile', 'pending'),
  ('22222222-2222-4222-8222-222222222203', now() + interval '2 days', 'Send day-2 WhatsApp follow-up', 'pending'),
  ('22222222-2222-4222-8222-222222222205', now() - interval '1 day', 'Share quotation draft', 'pending');

insert into public.aiwebsite_lead_activities (lead_id, type, title, detail)
values
  ('22222222-2222-4222-8222-222222222201', 'demo_view', 'Demo viewed (mobile, 95s)', '{"source": "seed", "device": "mobile"}'),
  ('22222222-2222-4222-8222-222222222201', 'demo_view', 'Demo viewed again + WhatsApp button clicked', '{"source": "seed", "cta": "whatsapp"}'),
  ('22222222-2222-4222-8222-222222222203', 'message_sent', 'WhatsApp pitch sent', '{"template": "whatsapp_pitch_v1"}'),
  ('22222222-2222-4222-8222-222222222205', 'note', 'Owner asked for pricing on call', '{}');
