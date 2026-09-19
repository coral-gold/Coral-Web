<?php require '../functions.php'; session_start_custom();
if (!is_admin()) {
    echo '<h1>Admin Login</h1>';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (login_admin($_POST['user'], $_POST['pass'])) {
            redirect('dashboard.php');
        }
        echo '<p style="color:red">Invalid</p>';
    }
    ?>
    <form method="POST">
    <input type="text" name="user" placeholder="Username" required>
    <input type="password" name="pass" placeholder="Password" required>
    <button>Login</button>
    </form>
    <?php exit;
}
redirect('dashboard.php');
