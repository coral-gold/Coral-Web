<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';

$about_text = db_one("SELECT value FROM content WHERE key_name='about_text'")['value']
    ?? 'Coral Gold is a premier wholesale jewellery house specialising in handcrafted gold ornaments.';

layout_head('About Us');
?>
<section class="hero" style="padding:60px 20px">
  <div class="container">
    <h1>About Coral Gold</h1>
    <p>Our story, our craft, our commitment to excellence.</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div style="max-width:760px;margin:0 auto">
      <h2 style="color:var(--crimson);margin-bottom:16px">Our Story</h2>
      <div class="gold-line" style="margin:0 0 24px"></div>
      <div style="color:var(--mid);line-height:1.9;font-size:16px">
        <?= nl2br(e($about_text)) ?>
      </div>
      <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;text-align:center">
        <div>
          <div style="font-size:36px;color:var(--crimson);font-weight:bold">500+</div>
          <div style="color:var(--mid);font-size:14px">Designs Available</div>
        </div>
        <div>
          <div style="font-size:36px;color:var(--crimson);font-weight:bold">100+</div>
          <div style="color:var(--mid);font-size:14px">Wholesale Partners</div>
        </div>
        <div>
          <div style="font-size:36px;color:var(--crimson);font-weight:bold">15+</div>
          <div style="color:var(--mid);font-size:14px">Years of Excellence</div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section section-alt">
  <div class="container text-center">
    <h2 style="color:var(--crimson);font-size:24px;margin-bottom:12px">Partner With Us</h2>
    <div class="gold-line"></div>
    <p style="color:var(--mid);margin:16px 0 24px;max-width:500px;margin-left:auto;margin-right:auto">
      We work exclusively with registered wholesale parties. Get in touch to explore a partnership.
    </p>
    <a href="<?= url('public/contact.php') ?>" class="btn btn-primary">Contact Us</a>
  </div>
</section>

<?php layout_foot(); ?>
