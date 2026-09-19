<?php
/** Category-wise product listing for logged-in parties — SRS 4.3. */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/order.php';

$party = require_party();
$partyId = (int) $party['id'];

if (is_post()) {
    csrf_verify();
    cart_add($partyId, post_int('product_id'), max(1, post_int('quantity', 1)));
    flash('success', 'Added to your order.');
    // Post/redirect/get so a refresh doesn't add the item twice.
    $query = $_SERVER['QUERY_STRING'] ?? '';
    redirect(url('order/index.php') . ($query !== '' ? '?' . $query : ''));
}

$categories = db_all('SELECT * FROM categories ORDER BY sort_order, name');
$activeCategory = (int) get_str('category', '0');

$perPage = 12;
$page = max(1, (int) get_str('page', '1'));
$offset = ($page - 1) * $perPage;

$where = 'p.is_active = 1';
$params = [];
if ($activeCategory > 0) {
    $where .= ' AND p.category_id = ?';
    $params[] = $activeCategory;
}

$totalRow = db_one("SELECT COUNT(*) AS total FROM products p WHERE $where", $params);
$total = (int) ($totalRow['total'] ?? 0);
$totalPages = max(1, (int) ceil($total / $perPage));

$products = db_all(
    "SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE $where
      ORDER BY c.sort_order, p.sort_order, p.name
      LIMIT $perPage OFFSET $offset",
    $params
);

function page_link(int $page, int $category): string
{
    $params = array_filter(['category' => $category ?: null, 'page' => $page > 1 ? $page : null]);
    return url('order/index.php') . ($params ? '?' . http_build_query($params) : '');
}

layout_header('Catalogue', 'order', order_nav($partyId), 'catalogue');
?>

<div class="page-head">
  <div>
    <h1>Catalogue</h1>
    <p>Browse by category and add the pieces you want to your order.</p>
  </div>
  <a class="btn btn-outline" href="<?= e(url('order/cart.php')) ?>">View My Order (<?= cart_count($partyId) ?>)</a>
</div>

<div class="filter-bar">
  <a class="filter-pill<?= $activeCategory === 0 ? ' is-active' : '' ?>" href="<?= e(page_link(1, 0)) ?>">All</a>
  <?php foreach ($categories as $category): ?>
    <a class="filter-pill<?= $activeCategory === (int) $category['id'] ? ' is-active' : '' ?>"
       href="<?= e(page_link(1, (int) $category['id'])) ?>"><?= e($category['name']) ?></a>
  <?php endforeach; ?>
</div>

<?php if (!$products): ?>
  <div class="card"><p class="empty-state">No products in this category yet.</p></div>
<?php else: ?>
  <div class="product-grid">
    <?php foreach ($products as $product): ?>
      <article class="product-card">
        <div class="product-media">
          <?php if ($product['image_path'] !== ''): ?>
            <img src="<?= e(url($product['image_path'])) ?>" alt="<?= e($product['name']) ?>" loading="lazy" decoding="async">
          <?php endif; ?>
        </div>
        <div class="product-body">
          <span class="product-name"><?= e($product['name']) ?></span>
          <dl class="spec-list">
            <dt>Design No.</dt><dd><?= e(fmt_text($product['design_number'])) ?></dd>
            <dt>Jewel Code</dt><dd><?= e(fmt_text($product['jewel_code'])) ?></dd>
            <dt>Gross Wt.</dt><dd><?= e(fmt_weight($product['gross_weight'])) ?></dd>
            <dt>Net Wt.</dt><dd><?= e(fmt_weight($product['net_weight'])) ?></dd>
          </dl>
          <form method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="product_id" value="<?= (int) $product['id'] ?>">
            <input type="hidden" name="quantity" value="1">
            <button type="submit" class="btn btn-primary btn-sm btn-block">Add to Order</button>
          </form>
        </div>
      </article>
    <?php endforeach; ?>
  </div>

  <?php if ($totalPages > 1): ?>
    <div class="filter-bar" style="margin-top:28px; justify-content:center;">
      <?php for ($i = 1; $i <= $totalPages; $i++): ?>
        <a class="filter-pill<?= $i === $page ? ' is-active' : '' ?>" href="<?= e(page_link($i, $activeCategory)) ?>"><?= $i ?></a>
      <?php endfor; ?>
    </div>
  <?php endif; ?>
<?php endif; ?>

<?php layout_footer(); ?>
