<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';

$categories = db_all('SELECT * FROM categories ORDER BY name');
$cat_id     = get_int('cat');
$page       = max(1, get_int('page', 1));
$per_page   = 24;
$offset     = ($page - 1) * $per_page;

$where  = 'WHERE 1=1';
$params = [];
if ($cat_id) { $where .= ' AND p.category_id = ?'; $params[] = $cat_id; }

$total    = (int)(db_one("SELECT COUNT(*) AS t FROM products p $where", $params)['t'] ?? 0);
$products = db_all("SELECT p.*, c.name AS cat_name FROM products p LEFT JOIN categories c ON c.id=p.category_id $where ORDER BY p.id DESC LIMIT ? OFFSET ?",
    array_merge($params, [$per_page, $offset]));
$pages = (int)ceil($total / $per_page);

layout_head('Catalogue');
?>
<section class="hero" style="padding:50px 20px">
  <div class="container">
    <h1>Browse Catalogue</h1>
    <p>Explore our collection. <a href="<?= url('wholesaler/login.php') ?>" style="color:var(--gold)">Login</a> for weights & pricing.</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <?php if ($categories): ?>
    <div class="catalogue-filters" style="margin-bottom:24px">
      <a href="<?= url('public/catalog.php') ?>" class="filter-btn<?= $cat_id ? '' : ' active' ?>">All</a>
      <?php foreach ($categories as $c): ?>
        <a href="<?= url('public/catalog.php') ?>?cat=<?= (int)$c['id'] ?>" class="filter-btn<?= $cat_id === (int)$c['id'] ? ' active' : '' ?>"><?= e($c['name']) ?></a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <?php if (empty($products)): ?>
      <p style="color:var(--mid);text-align:center;padding:40px">No products in this category yet.</p>
    <?php else: ?>
    <div class="catalog-grid">
      <?php foreach ($products as $p): ?>
      <div class="pub-card">
        <?php if ($p['image_path']): ?>
          <img src="<?= e(url('assets/uploads/' . $p['image_path'])) ?>" class="pub-card-img" alt="<?= e($p['design_number']) ?>" loading="lazy">
        <?php else: ?>
          <div class="pub-card-img-placeholder">💍</div>
        <?php endif; ?>
        <div class="pub-card-body">
          <div class="design-no"><?= e($p['design_number']) ?></div>
          <?php if ($p['description']): ?>
            <p><?= e(mb_strimwidth($p['description'], 0, 80, '…')) ?></p>
          <?php endif; ?>
          <?php if ($p['cat_name']): ?>
            <small style="color:#aaa"><?= e($p['cat_name']) ?></small>
          <?php endif; ?>
        </div>
      </div>
      <?php endforeach; ?>
    </div>

    <?php if ($pages > 1): ?>
    <div class="pagination mt-3">
      <?php for ($i = 1; $i <= $pages; $i++): ?>
        <a href="?page=<?= $i ?><?= $cat_id ? '&cat='.$cat_id : '' ?>"
           class="<?= $i === $page ? 'current' : '' ?>"><?= $i ?></a>
      <?php endfor; ?>
    </div>
    <?php endif; ?>
    <?php endif; ?>

    <div class="text-center mt-3">
      <p style="color:var(--mid);font-size:14px">Weights, jewel codes and detailed specifications are available to registered wholesalers only.</p>
      <a href="<?= url('wholesaler/login.php') ?>" class="btn btn-primary mt-1">Wholesaler Login</a>
    </div>
  </div>
</section>

<?php layout_foot(); ?>
