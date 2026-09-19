<?php require '../functions.php'; 
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (login_party($_POST['party_id'], $_POST['password'])) {
        redirect('catalogue.php');
    }
    $error = 'Invalid credentials';
}
?>
<!DOCTYPE html>
<html>
<head><title>Login</title>
<style>body{font-family:Georgia,serif;margin:20px;} input{padding:8px;margin:5px 0;width:200px;}</style>
</head>
<body>
<h1>Wholesaler Login</h1>
<?php if(isset($error)): ?><p style="color:red"><?= e($error) ?></p><?php endif; ?>
<form method="POST">
<input type="text" name="party_id" placeholder="Party ID" required>
<br><input type="password" name="password" placeholder="Password" required>
<br><button>Login</button>
</form>
<p><a href="../public/home.php">Back</a></p>
</body></html>
