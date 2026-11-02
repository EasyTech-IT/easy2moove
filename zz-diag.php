<?php
header('Content-Type: text/plain');
if (isset($_GET['early'])) {
    ignore_user_abort(true);
    $out = 'ok';
    header('Content-Length: ' . strlen($out));
    header('Connection: close');
    echo $out;
    while (ob_get_level() > 0) { @ob_end_flush(); }
    flush();
    if (function_exists('fastcgi_finish_request')) { fastcgi_finish_request(); }
    sleep(8);
    exit;
}
echo php_sapi_name(), "\n", PHP_VERSION, "\n", 'fastcgi_finish_request=', function_exists('fastcgi_finish_request') ? 'yes' : 'no', "\n";
echo 'sendmail_path=', ini_get('sendmail_path'), "\n", 'smtp=', ini_get('SMTP'), "\n";
echo 'output_buffering=', ini_get('output_buffering'), "\n";
