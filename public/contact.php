<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/layout.php';

$contact_email   = db_one("SELECT value FROM content WHERE key_name='contact_email'"  )['value'] ?? '';
$contact_phone   = db_one("SELECT value FROM content WHERE key_name='contact_phone'"  )['value'] ?? '';
$contact_address = db_one("SELECT value FROM content WHERE key_name='contact_address'")['value'] ?? '';

$sent = false;
$err  = '';
if (is_post()) {
    csrf_verify();
    $name    = trim(post('name'));
    $email   = trim(post('email'));
    $message = trim(post('message'));
    if (!$name || !$email || !$message) {
        $err = 'All fields are required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $err = 'Please enter a valid email address.';
    } else {
        $to      = $contact_email ?: 'info@coralgold.in';
        $subject = 'Contact enquiry from ' . $name;
        $body    = "Name: {$name}\nEmail: {$email}\n\nMessage:\n{$message}";
        $headers = "From: noreply@coralgold.in\r\nReply-To: {$email}";
        mail($to, $subject, $body, $headers);
        $sent = true;
    }
}

layout_head('Contact Us');
?>
<section class="hero" style="padding:50px 20px">
  <div class="container">
    <h1>Contact Us</h1>
    <p>Get in touch with our wholesale team.</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="contact-grid">
      <div class="contact-info">
        <h3>Our Details</h3>
        <?php if ($contact_phone): ?>
          <p>📞 <?= e($contact_phone) ?></p>
        <?php endif; ?>
        <?php if ($contact_email): ?>
          <p>✉️ <a href="mailto:<?= e($contact_email) ?>"><?= e($contact_email) ?></a></p>
        <?php endif; ?>
        <?php if ($contact_address): ?>
          <p>📍 <?= nl2br(e($contact_address)) ?></p>
        <?php endif; ?>
        <div style="margin-top:24px">
          <h4 style="color:var(--crimson);margin-bottom:8px">Wholesale Enquiries</h4>
          <p style="font-size:14px;color:var(--mid)">If you are a retailer or jeweller interested in becoming a wholesale partner, please write to us with your business details.</p>
        </div>
      </div>
      <div class="contact-form-wrap">
        <?php if ($sent): ?>
          <div class="alert alert-success">Thank you! Your message has been sent. We'll respond within 1–2 business days.</div>
        <?php else: ?>
          <?php if ($err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endif; ?>
          <form method="POST">
            <?= csrf_field() ?>
            <div class="form-group">
              <label>Your Name</label>
              <input type="text" name="name" class="form-control" required value="<?= e(post('name')) ?>">
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" name="email" class="form-control" required value="<?= e(post('email')) ?>">
            </div>
            <div class="form-group">
              <label>Message</label>
              <textarea name="message" class="form-control" rows="5" required><?= e(post('message')) ?></textarea>
            </div>
            <div class="form-submit">
              <button type="submit" class="btn btn-primary">Send Message</button>
            </div>
          </form>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>

<?php layout_foot(); ?>
