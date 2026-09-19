<?php
/**
 * Cached thumbnails for listing views (batch 3, item 5).
 *
 * The order catalogue renders many cards at once, so it must not serve the
 * full-size photo for each. A resized copy is generated once into
 * assets/thumbs/ and reused; the original is only used where the picture is
 * actually viewed large.
 */

declare(strict_types=1);

const THUMB_DIR = 'assets/thumbs';

/**
 * Returns a web path to a thumbnail of the given image, generating it on
 * first use. Falls back to the original path if anything prevents resizing
 * (missing GD, unwritable folder, unreadable source) so images never vanish.
 */
function thumb_path(string $imagePath, int $width = 400): string
{
    if ($imagePath === '') {
        return '';
    }

    $source = CORAL_ROOT . '/' . ltrim($imagePath, '/');
    if (!is_file($source) || !function_exists('imagecreatetruecolor')) {
        return $imagePath;
    }

    // Cache key ties the thumbnail to the source path, size and mtime, so
    // replacing a photo produces a new file rather than a stale one.
    $key = substr(sha1($imagePath . '|' . $width . '|' . (string) filemtime($source)), 0, 16);
    $ext = strtolower(pathinfo($source, PATHINFO_EXTENSION));
    $ext = in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true) ? $ext : 'jpg';
    $relative = THUMB_DIR . '/' . $key . '.' . $ext;
    $target = CORAL_ROOT . '/' . $relative;

    if (is_file($target)) {
        return $relative;
    }

    $dir = CORAL_ROOT . '/' . THUMB_DIR;
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return $imagePath;
    }

    $info = @getimagesize($source);
    if ($info === false) {
        return $imagePath;
    }

    [$srcW, $srcH] = $info;
    if ($srcW <= $width) {
        return $imagePath; // already small enough to serve directly
    }

    $image = match ($info[2]) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($source),
        IMAGETYPE_PNG  => @imagecreatefrompng($source),
        IMAGETYPE_WEBP => @imagecreatefromwebp($source),
        default        => false,
    };
    if ($image === false) {
        return $imagePath;
    }

    $height = (int) round($srcH * ($width / $srcW));
    $canvas = imagecreatetruecolor($width, $height);

    if ($info[2] === IMAGETYPE_PNG || $info[2] === IMAGETYPE_WEBP) {
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
    }

    imagecopyresampled($canvas, $image, 0, 0, 0, 0, $width, $height, $srcW, $srcH);

    $ok = match ($ext) {
        'png'  => imagepng($canvas, $target, 6),
        'webp' => imagewebp($canvas, $target, 82),
        default => imagejpeg($canvas, $target, 82),
    };

    imagedestroy($image);
    imagedestroy($canvas);

    return $ok ? $relative : $imagePath;
}
