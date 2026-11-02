<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const SITE_HOST = 'easy2moove.de';
const OWNER_MAIL = 'info@easy2moove.de';
const FROM_MAIL = 'info@easy2moove.de';
const BRAND = 'Easy2Moove';
const SITE_URL = 'https://easy2moove.de';
const PHONE = '+49 155 67375105';

const SERVICES = [
    'umzug' => 'Umzug',
    'firmenumzug' => 'Firmenumzug',
    'entruempelung' => 'Entrümpelung',
    'moebelmontage' => 'Möbelmontage',
    'lagerung' => 'Lagerung',
    'transporter' => 'Transporter mieten',
    'sonstiges' => 'Sonstiges',
];
const MOVE_SERVICES = ['umzug', 'firmenumzug'];
const CONTACT_PREFS = ['whatsapp' => 'WhatsApp', 'anruf' => 'Anruf', 'email' => 'E-Mail'];

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function clean(string $value, int $max): string
{
    $value = str_replace("\0", '', $value);
    $value = preg_replace('/[^\P{C}\n]+/u', ' ', $value) ?? '';
    $value = trim($value);
    return mb_substr($value, 0, $max);
}

function oneLine(string $value, int $max): string
{
    return clean(preg_replace('/\s+/u', ' ', $value) ?? '', $max);
}

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function encodeHeader(string $value): string
{
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'message' => 'Methode nicht erlaubt.']);
}

// Nur Anfragen von der eigenen Domain zulassen
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($origin !== '') {
    $host = (string) parse_url($origin, PHP_URL_HOST);
    if (!in_array(strtolower($host), [SITE_HOST, 'www.' . SITE_HOST], true)) {
        respond(403, ['ok' => false, 'message' => 'Anfrage nicht erlaubt.']);
    }
}

// Honeypot und Mindest-Ausfüllzeit gegen Bots
if (!empty($_POST['website'])) {
    respond(200, ['ok' => true]);
}
$started = (int) ($_POST['ts'] ?? 0);
if ($started > 0 && (time() - intdiv($started, 1000)) < 3) {
    respond(429, ['ok' => false, 'message' => 'Bitte versuchen Sie es erneut.']);
}

// Einfaches Rate-Limit pro IP (max. 5 Anfragen pro Stunde)
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/e2m_rate_' . hash('sha256', $ip);
$hits = [];
if (is_file($rateFile)) {
    $hits = array_filter(
        array_map('intval', file($rateFile, FILE_IGNORE_NEW_LINES) ?: []),
        static fn(int $t): bool => $t > time() - 3600
    );
}
if (count($hits) >= 5) {
    respond(429, ['ok' => false, 'message' => 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.']);
}

$service = (string) ($_POST['service'] ?? '');
$name = oneLine((string) ($_POST['name'] ?? ''), 100);
$email = oneLine((string) ($_POST['email'] ?? ''), 150);
$phone = oneLine((string) ($_POST['phone'] ?? ''), 40);
$from = oneLine((string) ($_POST['move_from'] ?? ''), 200);
$to = oneLine((string) ($_POST['move_to'] ?? ''), 200);
$date = oneLine((string) ($_POST['move_date'] ?? ''), 10);
$pref = (string) ($_POST['contact_pref'] ?? '');
$message = clean((string) ($_POST['message'] ?? ''), 3000);
$consent = !empty($_POST['consent']);

$errors = [];
if (!isset(SERVICES[$service])) {
    $errors['service'] = 'Bitte wählen Sie eine Leistung.';
}
if ($name === '') {
    $errors['name'] = 'Bitte geben Sie Ihren Namen ein.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
}
if (!preg_match('/^\+?[0-9 ()\/\-]{6,25}$/', $phone)) {
    $errors['phone'] = 'Bitte geben Sie eine gültige Telefonnummer ein.';
}
$isMove = in_array($service, MOVE_SERVICES, true);
if ($isMove) {
    if ($from === '') {
        $errors['move_from'] = 'Bitte geben Sie den Auszugsort an.';
    }
    if ($to === '') {
        $errors['move_to'] = 'Bitte geben Sie den Einzugsort an.';
    }
}
$d = DateTime::createFromFormat('!Y-m-d', $date);
if ($date === '' && !$isMove) {
    $d = null;
} elseif (!$d || $d->format('Y-m-d') !== $date || $d < new DateTime('today')) {
    $errors['move_date'] = 'Bitte wählen Sie ein gültiges Datum.';
}
if (!isset(CONTACT_PREFS[$pref])) {
    $errors['contact_pref'] = 'Bitte wählen Sie einen Kontaktweg.';
}
if ($message === '') {
    $errors['message'] = 'Bitte beschreiben Sie Ihr Anliegen.';
}
if (!$consent) {
    $errors['consent'] = 'Bitte stimmen Sie der Datenschutzerklärung zu.';
}
if ($errors) {
    respond(422, ['ok' => false, 'message' => 'Bitte prüfen Sie Ihre Eingaben.', 'errors' => $errors]);
}

$serviceLabel = SERVICES[$service];
$dateDe = $date !== '' ? (new DateTime($date))->format('d.m.Y') : '';
$dateLabel = $isMove ? 'Umzugsdatum' : 'Wunschtermin';
$prefLabel = CONTACT_PREFS[$pref];
$sentAt = (new DateTime('now', new DateTimeZone('Europe/Berlin')))->format('d.m.Y, H:i') . ' Uhr';
$year = date('Y');

function icon(string $name, int $size = 32): string
{
    return '<img src="' . SITE_URL . '/img/email/' . $name . '.png" width="' . $size . '" height="' . $size . '" alt="" style="display:block;border:0;width:' . $size . 'px;height:' . $size . 'px;">';
}

// Farbig sind nur die wichtigen Angaben: Leistung (Markenfarbe) und der bevorzugte Kontaktweg
const CHANNELS = [
    'whatsapp' => ['icon' => 'whatsapp', 'main' => '#25d366', 'dark' => '#128c4a', 'tint' => '#e5f9ec', 'owner' => 'Bitte per WhatsApp melden', 'customer' => 'Wir melden uns per WhatsApp bei Ihnen'],
    'anruf' => ['icon' => 'phone', 'main' => '#f97316', 'dark' => '#c2410c', 'tint' => '#fff0e5', 'owner' => 'Bitte telefonisch zurückrufen', 'customer' => 'Wir rufen Sie zurück'],
    'email' => ['icon' => 'mail', 'main' => '#7c3aed', 'dark' => '#6d28d9', 'tint' => '#f1eafd', 'owner' => 'Bitte per E-Mail antworten', 'customer' => 'Wir antworten Ihnen per E-Mail'],
];

function row(string $icon, string $label, string $valueHtml, bool $last): string
{
    return '<tr><td style="padding:10px 14px;' . ($last ? '' : 'border-bottom:1px solid #eeeeee;') . '"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        . '<td style="width:34px;vertical-align:middle;">' . icon($icon . '_g', 24) . '</td>'
        . '<td style="vertical-align:middle;"><div style="font-size:11px;line-height:1.3;color:#6b7280;">' . $label . '</div>'
        . '<div style="font-size:15px;line-height:1.4;font-weight:600;color:#222222;word-break:break-word;">' . $valueHtml . '</div></td></tr></table></td></tr>';
}

function detailsCard(array $items): string
{
    $html = '';
    $last = count($items) - 1;
    foreach (array_values($items) as $i => [$icon, $label, $value]) {
        $html .= row($icon, $label, $value, $i === $last);
    }
    return '<tr><td style="padding:12px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;">'
        . $html . '</table></td></tr>';
}

function highlights(string $serviceLabel, string $pref, string $channelLabel, string $hint): string
{
    $c = CHANNELS[$pref];
    return '<tr><td style="padding:16px 28px 0;"><table role="presentation" cellpadding="0" cellspacing="0" style="background:#e6f6ee;border:1px solid #00a859;border-radius:999px;"><tr>'
        . '<td style="padding:5px 4px 5px 10px;">' . icon('truck', 20) . '</td>'
        . '<td style="padding:5px 14px 5px 4px;font-size:14px;font-weight:700;color:#007a3d;">' . e($serviceLabel) . '</td></tr></table></td></tr>'
        . '<tr><td style="padding:12px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' . $c['tint'] . ';border:1.5px solid ' . $c['main'] . ';border-radius:10px;"><tr>'
        . '<td style="padding:12px 12px 12px 14px;width:40px;vertical-align:middle;">' . icon($c['icon'], 40) . '</td>'
        . '<td style="padding:12px 14px 12px 0;vertical-align:middle;"><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' . $c['dark'] . ';">' . $channelLabel . '</div>'
        . '<div style="font-size:18px;line-height:1.3;font-weight:700;color:#222222;">' . e(CONTACT_PREFS[$pref]) . '</div>'
        . '<div style="font-size:13px;color:#555555;">' . $hint . '</div></td></tr></table></td></tr>';
}

function layout(string $title, string $titleIcon, string $intro, string $top, string $middle, string $extra, string $footer): string
{
    return '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:24px 12px;background:#f7f7f7;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dddddd;">'
        . '<tr><td style="background:#ffffff;padding:22px 28px 18px;border-bottom:4px solid #00a859;"><a href="' . SITE_URL . '"><img src="' . SITE_URL . '/img/logo-nav.png" width="200" alt="' . BRAND . ' – Transport &amp; Vermietung" style="display:block;border:0;width:200px;max-width:100%;height:auto;"></a></td></tr>'
        . '<tr><td style="padding:24px 28px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:12px;vertical-align:middle;">' . icon($titleIcon, 36) . '</td>'
        . '<td style="vertical-align:middle;"><h1 style="margin:0;font-size:19px;line-height:1.3;color:#222222;">' . $title . '</h1></td></tr></table>'
        . '<p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#555555;">' . $intro . '</p></td></tr>'
        . $top . $middle . $extra
        . '<tr><td style="padding:20px 28px 26px;border-top:1px solid #eeeeee;font-size:12px;line-height:1.6;color:#6b7280;">' . $footer . '</td></tr>'
        . '</table></body></html>';
}

function messageBox(string $messageHtml): string
{
    return '<tr><td style="padding:12px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-left:4px solid #00a859;border-radius:8px;">'
        . '<tr><td style="padding:10px 14px 2px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:8px;">' . icon('message_g', 22) . '</td>'
        . '<td style="font-size:12px;color:#6b7280;">Nachricht</td></tr></table></td></tr>'
        . '<tr><td style="padding:2px 14px 12px;font-size:15px;line-height:1.55;color:#222222;">' . $messageHtml . '</td></tr></table></td></tr>';
}

function ctaButton(string $href, string $label, string $color): string
{
    return '<a href="' . $href . '" style="display:inline-block;background:' . $color . ';color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;">' . $label . '</a>';
}

function whatsappNumber(string $phone): string
{
    $digits = preg_replace('/[^0-9+]/', '', $phone) ?? '';
    if (str_starts_with($digits, '+')) {
        return substr($digits, 1);
    }
    if (str_starts_with($digits, '00')) {
        return substr($digits, 2);
    }
    if (str_starts_with($digits, '0')) {
        return '49' . substr($digits, 1);
    }
    return $digits;
}

$legalFooter = '© ' . $year . ' ' . BRAND . ' – Einzelunternehmen, Am Herrenhöfchen 22, 63654 Büdingen. Alle Rechte vorbehalten. '
    . 'Texte, Gestaltung und Marken dieser Nachricht sind urheberrechtlich geschützt; Vervielfältigung oder Weitergabe ist ohne Zustimmung nicht gestattet. '
    . '<br><a href="' . SITE_URL . '/impressum" style="color:#6b7280;">Impressum</a> · <a href="' . SITE_URL . '/datenschutz" style="color:#6b7280;">Datenschutz</a>';

$messageHtml = nl2br(e($message), false);

// --- Mail an den Geschäftsführer ---
$route = $isMove ? e($from) . ' <span style="color:#00a859;">→</span> ' . e($to) : '';
$ownerItems = [
    ['user', 'Name', e($name)],
    ['phone', 'Telefon', '<a href="tel:' . e(preg_replace('/[^0-9+]/', '', $phone) ?? '') . '" style="color:#222222;text-decoration:none;">' . e($phone) . '</a>'],
    ['mail', 'E-Mail', '<a href="mailto:' . e($email) . '" style="color:#222222;text-decoration:none;">' . e($email) . '</a>'],
];
if ($isMove) {
    $ownerItems[] = ['pin', 'Strecke', $route];
}
if ($dateDe !== '') {
    $ownerItems[] = ['calendar', $dateLabel, e($dateDe)];
}
$channel = CHANNELS[$pref];
$replyHref = match ($pref) {
    'whatsapp' => 'https://wa.me/' . whatsappNumber($phone),
    'anruf' => 'tel:' . e(preg_replace('/[^0-9+]/', '', $phone) ?? ''),
    default => 'mailto:' . e($email),
};
$replyLabel = match ($pref) {
    'whatsapp' => 'Per WhatsApp antworten',
    'anruf' => 'Jetzt anrufen',
    default => 'Per E-Mail antworten',
};
$ownerHtml = layout(
    'Neue Anfrage über die Webseite',
    'inbox',
    'Eingegangen am ' . e($sentAt) . '.',
    highlights($serviceLabel, $pref, 'Bevorzugter Kontaktweg', $channel['owner']),
    detailsCard($ownerItems) . messageBox($messageHtml),
    '<tr><td style="padding:16px 28px 24px;">' . ctaButton($replyHref, $replyLabel, $channel['main']) . '</td></tr>',
    'Die Einwilligung zur Datenverarbeitung gemäß Datenschutzerklärung wurde am ' . e($sentAt) . ' erteilt. Daten nur zur Bearbeitung der Anfrage verwenden (Art. 6 Abs. 1 lit. b DSGVO).<br><br>' . $legalFooter
);
$ownerText = "Neue Anfrage über die Webseite ($sentAt)\n\nLeistung: $serviceLabel\nName: $name\nTelefon: $phone\nE-Mail: $email\n"
    . ($isMove ? "Von: $from\nNach: $to\n" : '') . ($dateDe !== '' ? "$dateLabel: $dateDe\n" : '') . "Kontaktweg: $prefLabel\n"
    . "\nNachricht:\n$message\n\n© $year " . BRAND . ". Alle Rechte vorbehalten.\n";

// --- Bestätigung an den Absender ---
$confirmItems = [['phone', 'Telefon', e($phone)]];
if ($isMove) {
    $confirmItems[] = ['pin', 'Strecke', $route];
}
if ($dateDe !== '') {
    $confirmItems[] = ['calendar', $dateLabel, e($dateDe)];
}
$confirmHtml = layout(
    'Vielen Dank für Ihre Anfrage, ' . e($name) . '!',
    'check',
    'Wir haben Ihre Nachricht erhalten und melden uns schnellstmöglich bei Ihnen. Hier eine Zusammenfassung Ihrer Angaben:',
    highlights($serviceLabel, $pref, 'Gewünschter Kontaktweg', $channel['customer']),
    detailsCard($confirmItems) . messageBox($messageHtml),
    '<tr><td style="padding:16px 28px 24px;"><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#555555;line-height:1.6;">'
    . '<tr><td style="padding:0 10px 8px 0;">' . icon('phone_g', 24) . '</td><td style="padding-bottom:8px;">Dringend? Rufen Sie uns an: <a href="tel:+4915567375105" style="color:#007a3d;font-weight:600;">' . PHONE . '</a></td></tr>'
    . '<tr><td style="padding:0 10px 0 0;">' . icon('mail_g', 24) . '</td><td>Oder schreiben Sie an <a href="mailto:' . OWNER_MAIL . '" style="color:#007a3d;font-weight:600;">' . OWNER_MAIL . '</a></td></tr></table></td></tr>',
    'Diese Bestätigung wurde automatisch erstellt, weil Ihre E-Mail-Adresse im Kontaktformular auf ' . SITE_HOST . ' angegeben wurde. '
    . 'Ihre Daten verwenden wir ausschließlich zur Bearbeitung Ihrer Anfrage. Sie haben das Recht auf Auskunft, Berichtigung und Löschung (siehe Datenschutzerklärung).<br><br>' . $legalFooter
);
$confirmText = "Hallo $name,\n\nvielen Dank für Ihre Anfrage bei " . BRAND . ". Wir melden uns schnellstmöglich.\n\n"
    . "Leistung: $serviceLabel\n" . ($isMove ? "Von: $from\nNach: $to\n" : '') . ($dateDe !== '' ? "$dateLabel: $dateDe\n" : '') . "Kontaktweg: $prefLabel\n"
    . "Telefon: $phone\n\nIhre Nachricht:\n$message\n\nTelefon: " . PHONE . "\nE-Mail: " . OWNER_MAIL . "\n\n© $year " . BRAND . ". Alle Rechte vorbehalten.\n";

function sendMail(string $to, string $subject, string $text, string $html, string $replyTo = '', float $wait = 1.5): bool
{
    $boundary = 'e2m_' . bin2hex(random_bytes(8));
    $headers = [
        'From: ' . encodeHeader(BRAND) . ' <' . FROM_MAIL . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'X-Mailer: Easy2Moove',
    ];
    if ($replyTo !== '') {
        $headers[] = 'Reply-To: ' . $replyTo;
    }
    $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text))
        . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($html))
        . "--$boundary--";
    // mail() wartet auf den Mailserver (teils >30 s); sendmail direkt starten und nur kurz auf Fehler warten
    if (function_exists('proc_open')) {
        $message = 'To: ' . $to . "\r\nSubject: " . encodeHeader($subject) . "\r\n" . implode("\r\n", $headers) . "\r\n\r\n" . $body;
        $proc = @proc_open(
            ['/usr/sbin/sendmail', '-t', '-i', '-f' . FROM_MAIL],
            [0 => ['pipe', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
            $pipes
        );
        if (is_resource($proc)) {
            fwrite($pipes[0], $message);
            fclose($pipes[0]);
            $deadline = microtime(true) + $wait;
            while (microtime(true) < $deadline) {
                $status = proc_get_status($proc);
                if (!$status['running']) {
                    $ok = $status['exitcode'] === 0;
                    proc_close($proc);
                    return $ok;
                }
                usleep(100000);
            }
            return true;
        }
    }
    return mail($to, encodeHeader($subject), $body, implode("\r\n", $headers), '-f' . FROM_MAIL);
}

$subjectOwner = 'Neue Anfrage: ' . $serviceLabel . ' – ' . $name;
if (!sendMail(OWNER_MAIL, $subjectOwner, $ownerText, $ownerHtml, $email)) {
    respond(500, ['ok' => false, 'message' => 'Die Nachricht konnte nicht gesendet werden. Bitte rufen Sie uns an oder schreiben Sie direkt an ' . OWNER_MAIL . '.']);
}
$hits[] = time();
@file_put_contents($rateFile, implode("\n", $hits), LOCK_EX);

// Antwort sofort an den Browser senden; die Bestätigung an den Absender wird danach verschickt
ignore_user_abort(true);
@set_time_limit(60);
$json = json_encode(['ok' => true, 'confirmationEmailSent' => true], JSON_UNESCAPED_UNICODE);
http_response_code(200);
header('Content-Length: ' . strlen($json));
header('Connection: close');
echo $json;
while (ob_get_level() > 0) {
    @ob_end_flush();
}
flush();
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}

sendMail($email, 'Ihre Anfrage bei ' . BRAND . ' – Bestätigung', $confirmText, $confirmHtml, OWNER_MAIL, 0.2);
