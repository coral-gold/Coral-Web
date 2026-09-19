<?php
declare(strict_types=1);

function admin_nav(): array
{
    return [
        'dashboard'  => ['href' => url('admin/dashboard.php'),  'label' => 'Dashboard'],
        'products'   => ['href' => url('admin/products.php'),   'label' => 'Products'],
        'categories' => ['href' => url('admin/categories.php'), 'label' => 'Categories'],
        'parties'    => ['href' => url('admin/parties.php'),    'label' => 'Parties'],
        'import'     => ['href' => url('admin/import.php'),     'label' => 'Import'],
        'quotations' => ['href' => url('admin/quotations.php'), 'label' => 'Quotations'],
        'content'    => ['href' => url('admin/content.php'),    'label' => 'Site Content'],
    ];
}

/**
 * Handles an uploaded product photo. Returns the stored relative path, or
 * null when nothing was uploaded. Throws RuntimeException on a bad file.
 */
function handle_image_upload(string $field): ?string
{
    if (!isset($_FILES[$field]) || ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $file = $_FILES[$field];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException('The image failed to upload. Please try again.');
    }
    if ($file['size'] > 6 * 1024 * 1024) {
        throw new RuntimeException('Image is too large. Please upload a file under 6 MB.');
    }

    $allowed = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_WEBP => 'webp',
    ];

    $info = @getimagesize($file['tmp_name']);
    if ($info === false || !isset($allowed[$info[2]])) {
        throw new RuntimeException('Please upload a JPG, PNG or WebP image.');
    }

    $dir = CORAL_ROOT . '/assets/uploads';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Upload folder is not writable on the server.');
    }

    $filename = bin2hex(random_bytes(8)) . '.' . $allowed[$info[2]];
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
        throw new RuntimeException('Could not save the uploaded image.');
    }

    return 'assets/uploads/' . $filename;
}
