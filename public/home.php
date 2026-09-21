<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';

$hero_title    = db_one("SELECT value FROM content WHERE key_name='home_hero_title'"  )['value'] ?? 'Premium Gold Jewellery';
$hero_subtitle = db_one("SELECT value FROM content WHERE key_name='home_hero_subtitle'")['value'] ?? 'Crafted with excellence for discerning wholesalers';
$featured      = db_all('SELECT * FROM products WHERE is_featured=1 LIMIT 8');

layout_head('Home');
?>
<section class="hero">
  <div class="container">
    <h1><?= e($hero_title) ?></h1>
    <p><?= e($hero_subtitle) ?></p>
    <div class="hero-buttons">
      <a href="<?= url('public/catalog.php') ?>" class="btn btn-gold">Browse Catalogue</a>
      <a href="<?= url('wholesaler/login.php') ?>" class="btn btn-outline" style="color:#fff;border-color:#fff">Wholesaler Login</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-title">
      <h2>Why Coral Gold</h2>
      <div class="gold-line"></div>
      <p>Trusted by wholesalers across India for quality and craftsmanship.</p>
    </div>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">✦</div>
        <h3>Hallmarked Gold</h3>
        <p>Every piece BIS hallmarked for purity assurance.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">⚖️</div>
        <h3>Accurate Weights</h3>
        <p>Gross and net weights certified on every item.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📦</div>
        <h3>Bulk Orders</h3>
        <p>Efficient wholesale fulfilment with digital quotations.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🤝</div>
        <h3>Trusted Relations</h3>
        <p>Long-term partnerships with verified wholesale parties.</p>
      </div>
    </div>
  </div>
</section>

<?php if ($featured): ?>
<section class="section section-alt">
  <div class="container">
    <div class="section-title">
      <h2>Featured Collection</h2>
      <div class="gold-line"></div>
    </div>
    <div class="catalog-grid">
      <?php foreach ($featured as $p): ?>
      <div class="pub-card">
        <?php if ($p['image_path']): ?>
          <img src="<?= e(url('assets/uploads/' . $p['image_path'])) ?>" class="pub-card-img" alt="<?= e($p['design_number']) ?>">
        <?php else: ?>
          <div class="pub-card-img-placeholder">💍</div>
        <?php endif; ?>
        <div class="pub-card-body">
          <div class="design-no"><?= e($p['design_number']) ?></div>
          <?php if ($p['description']): ?>
            <p><?= e(mb_strimwidth($p['description'], 0, 60, '…')) ?></p>
          <?php endif; ?>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
    <div class="text-center mt-3">
      <a href="<?= url('public/catalog.php') ?>" class="btn btn-primary">View Full Catalogue</a>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="section">
  <div class="container text-center">
    <h2 style="color:var(--crimson);font-size:26px;margin-bottom:12px">Wholesale Enquiries</h2>
    <div class="gold-line"></div>
    <p style="color:var(--mid);margin:16px 0 24px">Already a registered wholesaler? Login to browse our full catalogue with weights and place quotation orders.</p>
    <a href="<?= url('wholesaler/login.php') ?>" class="btn btn-primary">Wholesaler Login</a>
    &nbsp;&nbsp;
    <a href="<?= url('public/contact.php') ?>" class="btn btn-outline">Contact Us</a>
  </div>
</section>

<?php layout_foot(); ?>
