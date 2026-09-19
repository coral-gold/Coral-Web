<?php
/**
 * Catalogue for logged-in parties.
 *
 * Adding, quantity changes, removals and category switching all happen
 * through fetch (batch 3, items 5 & 8) — the only full navigation left is
 * generating the quotation, which deliberately produces a new document.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';
require_once __DIR__ . '/../includes/order.php';

$party = require_party();
$partyId = (int) $party['id'];

if (is_post()) {
    csrf_verify();
    if (post_str('action') === 'generate') {
        $quotationId = create_quotation_from_cart($partyId, post_str('notes'));
        if ($quotationId === null) {
            flash('error', 'Your quotation is empty, so there is nothing to generate.');
        } else {
            flash('success', 'Quotation generated.');
            redirect(url('order/quotation.php?id=' . $quotationId));
        }
    }
    redirect(url('order/index.php'));
}

$categories = db_all('SELECT * FROM categories ORDER BY name');

layout_header('Catalogue', 'order', order_nav($partyId), 'catalogue');
?>

<div class="page-head">
  <div>
    <h1>Catalogue</h1>
    <p>Browse by category and add the pieces you want to your quotation.</p>
  </div>
</div>

<div class="filter-bar" id="categoryFilters">
  <button type="button" class="filter-pill is-active" data-category="0">All</button>
  <?php foreach ($categories as $category): ?>
    <button type="button" class="filter-pill" data-category="<?= (int) $category['id'] ?>">
      <?= e($category['name']) ?>
    </button>
  <?php endforeach; ?>
</div>

<div class="product-grid" id="productGrid" aria-live="polite" aria-busy="true">
  <p class="empty-state">Loading catalogue&hellip;</p>
</div>

<div class="pager" id="pager" hidden></div>

<!-- Persistent quotation control (item 8) -->
<button type="button" class="quotation-fab" id="quotationFab" hidden>
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M6 4h12l1 16H5L6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M9 8h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
  View Quotation <span class="fab-count" id="fabCount">0</span>
</button>

<div class="panel-backdrop" id="panelBackdrop" hidden></div>
<aside class="quotation-panel" id="quotationPanel" hidden aria-label="Current quotation">
  <header class="panel-head">
    <h2>Current Quotation</h2>
    <button type="button" class="panel-close" id="panelClose" aria-label="Close">&times;</button>
  </header>

  <div class="panel-body" id="panelBody"></div>

  <footer class="panel-foot">
    <p class="no-price-note">Pricing is agreed separately — this is an item request list, not an invoice.</p>
    <form method="post" id="generateForm">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="generate">
      <div class="field">
        <label for="notes">Notes for Coral Gold (optional)</label>
        <textarea id="notes" name="notes" rows="2" placeholder="Anything we should know&hellip;"></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="generateBtn">Generate Quotation</button>
    </form>
  </footer>
</aside>

<script>
  window.CORAL_CSRF = <?= json_encode(csrf_token()) ?>;
  window.CORAL_BASE = <?= json_encode(base_path()) ?>;
</script>
<script src="<?= e(url('js/order-catalogue.js')) ?>" defer></script>

<?php layout_footer(); ?>
