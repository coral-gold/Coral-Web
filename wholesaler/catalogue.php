<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/order.php';

$party = require_party();
$categories = db_all('SELECT * FROM categories ORDER BY name');

wholesaler_layout_head('Catalogue');
?>
<div class="ws-layout">
  <nav class="ws-sidebar">
    <a href="catalogue.php" class="nav-item active">📦 Catalogue</a>
    <a href="my-quotations.php" class="nav-item">📋 My Quotations</a>
    <a href="logout.php" class="nav-item">🚪 Logout</a>
  </nav>
  <main class="ws-main">
    <div class="d-flex justify-between align-center mb-2 flex-wrap" style="gap:10px">
      <h1>Catalogue</h1>
      <button id="cart-btn" class="cart-badge" type="button">
        🛒 Quotation &nbsp;<span id="cart-count">0</span> pcs
      </button>
    </div>

    <div class="search-bar">
      <input id="search-input" type="search" class="form-control" placeholder="Search design number or jewel code…">
    </div>

    <div class="catalogue-filters">
      <button class="filter-btn active" data-cat="">All</button>
      <?php foreach ($categories as $c): ?>
        <button class="filter-btn" data-cat="<?= (int)$c['id'] ?>"><?= e($c['name']) ?></button>
      <?php endforeach; ?>
    </div>

    <div id="product-grid" class="product-grid">
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:#888">
        <span class="spinner"></span> Loading products…
      </div>
    </div>

    <div class="text-center mt-3">
      <button id="load-more" class="btn btn-outline" style="display:none">Load More</button>
    </div>
  </main>
</div>

<!-- Quotation panel overlay -->
<div id="panel-overlay"></div>
<div id="quot-panel">
  <div class="panel-header">
    <h3>Quotation Items</h3>
    <button id="panel-close" type="button">✕</button>
  </div>
  <div class="panel-body" id="panel-body">
    <p id="panel-empty" style="display:none;text-align:center;color:#888;padding:40px">Your quotation is empty.</p>
  </div>
  <div class="panel-footer">
    <div id="panel-summary"></div>
    <textarea id="quot-notes" placeholder="Notes / remarks (optional)"></textarea>
    <button id="gen-quot-btn" class="btn btn-primary" style="width:100%">Generate Quotation PDF</button>
  </div>
</div>

<script src="<?= url('js/catalogue.js') ?>"></script>
</body>
</html>
