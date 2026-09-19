-- Coral Gold — initial data.
-- Run after schema.sql. Safe to re-run: uses INSERT IGNORE / ON DUPLICATE KEY.
--
-- NOTE: design_number, jewel_code, gross_weight and net_weight are
-- deliberately left NULL for the five imported photos — that data has not
-- been supplied yet (SRS 8) and is filled in through the admin panel
-- rather than invented here.

SET NAMES utf8mb4;

INSERT IGNORE INTO categories (name, slug, sort_order) VALUES
  ('Necklaces', 'necklaces', 10),
  ('Pendants',  'pendants',  20),
  ('Bracelets', 'bracelets', 30),
  ('Watches',   'watches',   40);

INSERT IGNORE INTO products
  (name, category_id, image_path, description, featured, sort_order)
VALUES
  ('Necklace & Earrings Set',
   (SELECT id FROM categories WHERE slug = 'necklaces'),
   'assets/products/necklace-earrings-set.webp',
   'A statement necklace and earrings set featuring cascading CZ stones set in rose gold, finished with a floral pendant drop.',
   1, 10),
  ('Pendant & Earrings Set',
   (SELECT id FROM categories WHERE slug = 'pendants'),
   'assets/products/pendant-earrings-set.webp',
   'A ribboned rose gold pendant and matching earrings, ringed with sparkling CZ stones for an everyday-elegant look.',
   1, 20),
  ('Rose Gold Watch',
   (SELECT id FROM categories WHERE slug = 'watches'),
   'assets/products/rose-gold-watch.webp',
   'A mother-of-pearl dial watch on a rose gold CZ-studded bracelet strap, pairing timekeeping with signature Coral sparkle.',
   1, 30),
  ('Men''s Bracelet',
   (SELECT id FROM categories WHERE slug = 'bracelets'),
   'assets/products/mens-bracelet.webp',
   'A structured rose gold link bracelet with textured plates, designed as an everyday piece with a refined finish.',
   0, 40),
  ('Women''s Bracelet',
   (SELECT id FROM categories WHERE slug = 'bracelets'),
   'assets/products/womens-bracelet.webp',
   'A delicate rose gold bracelet set with a cross-and-star link pattern, lined with CZ stones for everyday sparkle.',
   1, 50);

INSERT INTO site_content (content_key, content_value) VALUES
  ('home_hero_eyebrow',      'Not just an accessory'),
  ('home_hero_heading',      'A Signature Touch of Coral'),
  ('home_hero_subtext',      'Coral designs and manufactures Cubic Zirconia Rose Gold jewellery from Surat — a statement of power, precision and prestige, blending everyday affordability with a premium finish for wholesalers and wearers alike.'),
  ('home_hero_badge_number', '5+'),
  ('home_hero_badge_label',  'Years of Craftsmanship'),
  ('home_cta_primary_label',   'Enquire Now'),
  ('home_cta_secondary_label', 'View Collections'),

  ('about_hero_eyebrow', 'About Coral'),
  ('about_hero_heading', 'Five Years of Craft, One Signature Finish'),
  ('about_story',        'For over five years, Coral has specialized in the design and manufacturing of Cubic Zirconia Rose Gold jewellery from Surat. Every piece is shaped by hands-on craftsmanship and quality checks that reflect our commitment to consistency — from a single custom piece to bulk wholesale orders. We combine timeless rose gold tones with sparkling CZ stones to create jewellery that feels premium without the premium price tag.'),
  ('about_mission_draft','To make signature rose gold jewellery accessible — pairing CZ craftsmanship with honest pricing, so every piece feels premium without the premium price tag.'),
  ('about_vision_draft', 'To be the rose gold CZ jewellery partner wholesalers trust first, known for consistent quality, dependable turnaround, and designs that keep pace with what customers want next.'),
  ('about_facility_highlights', 'Based in Surat, India — a hub for jewellery manufacturing.\nFive-plus years of dedicated CZ Rose Gold production experience.\nHands-on quality checks at every stage before dispatch.\nCapacity for both single custom pieces and bulk wholesale orders.'),

  ('wholesale_hero_eyebrow', 'For Business Partners'),
  ('wholesale_hero_heading', 'Wholesale & B2B Enquiries'),
  ('wholesale_intro',        'Coral partners with boutiques, retailers, and distributors looking for consistent CZ Rose Gold jewellery at wholesale volumes. From a first bulk order to an ongoing supply relationship, our Surat-based production is built to scale with your business.'),
  ('wholesale_min_order',    '[Pending confirmation from Coral Gold — minimum order quantity / value to be added here.]'),
  ('wholesale_capacity',     '[Pending confirmation from Coral Gold — production capacity and typical turnaround time to be added here.]'),
  ('wholesale_how_to_start', 'Reach out through our contact form with your business details and the categories you''re interested in. Our team will follow up to discuss samples, pricing, and order timelines.'),
  ('wholesale_cta_label',    'Start a Wholesale Enquiry'),

  ('contact_address',   '[Address Line 1], Surat, Gujarat – [PIN], India'),
  ('contact_phone',     '+91 00000 00000'),
  ('contact_phone_href','tel:+910000000000'),
  ('contact_email',     'info@coral.example'),
  ('contact_whatsapp',  'https://wa.me/910000000000'),
  ('contact_hours',     '[Business hours — pending confirmation, e.g. Mon–Sat, 10:00 AM – 7:00 PM IST]'),
  ('contact_instagram', '#'),
  ('contact_facebook',  '#')
ON DUPLICATE KEY UPDATE content_value = VALUES(content_value);
