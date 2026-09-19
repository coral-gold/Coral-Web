<?php
/**
 * Public page copy, edited in the admin panel (SRS 5.5).
 * Shape matches what the existing front-end scripts already expect, so the
 * public pages did not need restructuring when content moved into MySQL.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$page = preg_replace('/[^a-z]/', '', strtolower(get_str('page', 'home')));

$content = [];
foreach (db_all('SELECT content_key, content_value FROM site_content') as $row) {
    $content[$row['content_key']] = $row['content_value'];
}

$get = static fn(string $key, string $default = ''): string => $content[$key] ?? $default;

/** Splits a multi-line content field into a list, dropping blank lines. */
$lines = static function (string $key) use ($content): array {
    $raw = trim((string) ($content[$key] ?? ''));
    if ($raw === '') {
        return [];
    }
    return array_values(array_filter(array_map('trim', preg_split('/\r?\n/', $raw) ?: [])));
};

switch ($page) {
    case 'about':
        $payload = [
            'hero_eyebrow'        => $get('about_hero_eyebrow'),
            'hero_heading'        => $get('about_hero_heading'),
            'story'               => $get('about_story'),
            'mission_draft'       => $get('about_mission_draft'),
            'vision_draft'        => $get('about_vision_draft'),
            'facility_highlights' => $lines('about_facility_highlights'),
            'stats'               => [
                ['number' => '5+',   'label' => 'Years of Production Experience'],
                ['number' => 'CZ',   'label' => 'Rose Gold Specialization'],
                ['number' => '100%', 'label' => 'Craftsmanship Focused'],
            ],
        ];
        break;

    case 'wholesale':
        $payload = [
            'hero_eyebrow' => $get('wholesale_hero_eyebrow'),
            'hero_heading' => $get('wholesale_hero_heading'),
            'intro'        => $get('wholesale_intro'),
            'sections'     => [
                ['heading' => 'Minimum Order Expectations', 'body' => $get('wholesale_min_order')],
                ['heading' => 'Manufacturing Capacity',     'body' => $get('wholesale_capacity')],
                ['heading' => 'How to Start',               'body' => $get('wholesale_how_to_start')],
            ],
            'cta_label'    => $get('wholesale_cta_label'),
        ];
        break;

    case 'contact':
        $payload = [
            'address_line'   => $get('contact_address'),
            'phone'          => $get('contact_phone'),
            'phone_href'     => $get('contact_phone_href'),
            'email'          => $get('contact_email'),
            'whatsapp_href'  => $get('contact_whatsapp'),
            'hours'          => $get('contact_hours'),
            'instagram_url'  => $get('contact_instagram'),
            'facebook_url'   => $get('contact_facebook'),
        ];
        break;

    case 'home':
    default:
        $payload = [
            'hero_eyebrow'        => $get('home_hero_eyebrow'),
            'hero_heading'        => $get('home_hero_heading'),
            'hero_subtext'        => $get('home_hero_subtext'),
            'hero_badge_number'   => $get('home_hero_badge_number'),
            'hero_badge_label'    => $get('home_hero_badge_label'),
            'cta_primary_label'   => $get('home_cta_primary_label'),
            'cta_secondary_label' => $get('home_cta_secondary_label'),
        ];
        break;
}

echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
