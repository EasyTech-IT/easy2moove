<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cleanText(mixed $value, int $maxLength = 1200): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value) ?? '';
    return mb_substr(trim($value), 0, $maxLength, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['message' => 'Diese Adresse akzeptiert nur Formularübermittlungen.']);
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '' && $host !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    if (!is_string($originHost) || strcasecmp($originHost, preg_replace('/:\d+$/', '', $host)) !== 0) {
        respond(403, ['message' => 'Die Anfrage konnte nicht verifiziert werden. Bitte laden Sie die Seite neu.']);
    }
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 7 * 1024 * 1024) {
    respond(413, ['message' => 'Die Anfrage ist zu groß. Bitte reduzieren Sie die Zahl oder Größe der Dateianhänge.']);
}

if (!empty($_POST['companyWebsite'])) {
    respond(400, ['message' => 'Die Anfrage konnte nicht verarbeitet werden.']);
}

$requestJson = $_POST['request'] ?? '';
if (!is_string($requestJson) || strlen($requestJson) > 40000) {
    respond(400, ['message' => 'Die Formulardaten fehlen oder sind ungültig. Bitte prüfen Sie Ihre Angaben.']);
}

$request = json_decode($requestJson, true);
if (!is_array($request)) {
    respond(400, ['message' => 'Die Formulardaten konnten nicht gelesen werden. Bitte versuchen Sie es erneut.']);
}

$name = cleanText($request['name'] ?? '', 120);
$email = cleanText($request['email'] ?? '', 254);
$phone = cleanText($request['phone'] ?? '', 60);
$service = cleanText($request['service'] ?? '', 80);
$allowedServices = ['Privatumzug', 'Firmenumzug', 'Seniorenumzug', 'Entrümpelung', 'Möbeltransport', 'Montage'];

if (
    $name === '' ||
    $phone === '' ||
    !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    !in_array($service, $allowedServices, true) ||
    empty($request['privacyAccepted'])
) {
    respond(422, ['message' => 'Bitte prüfen Sie Name, Telefonnummer, E-Mail-Adresse, Leistung und Datenschutzeinwilligung.']);
}

$rows = $request['summary'] ?? null;
if (!is_array($rows) || count($rows) > 40) {
    respond(400, ['message' => 'Die Anfrageübersicht ist ungültig. Bitte laden Sie die Seite neu.']);
}

$bodyLines = [
    'Neue kostenlose und unverbindliche Bewertungsanfrage über easy2moove.de',
    '',
];
foreach ($rows as $row) {
    if (!is_array($row)) {
        respond(400, ['message' => 'Die Anfrageübersicht ist ungültig. Bitte laden Sie die Seite neu.']);
    }
    $label = cleanText($row['label'] ?? '', 100);
    $value = cleanText($row['value'] ?? '', 1200);
    if ($label === '') {
        respond(400, ['message' => 'Die Anfrageübersicht ist unvollständig. Bitte laden Sie die Seite neu.']);
    }
    $bodyLines[] = $label . ': ' . ($value !== '' ? $value : 'Nicht angegeben');
}
$bodyLines[] = '';
$bodyLines[] = 'Bitte melden Sie sich bei der anfragenden Person zurück.';
$body = implode("\r\n", $bodyLines);

$attachments = [];
$mimeTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'application/pdf' => 'pdf',
];

if (isset($_FILES['photos'])) {
    $files = $_FILES['photos'];
    if (
        !is_array($files['name'] ?? null) ||
        !is_array($files['tmp_name'] ?? null) ||
        !is_array($files['size'] ?? null) ||
        !is_array($files['error'] ?? null)
    ) {
        respond(400, ['message' => 'Die Dateianhänge konnten nicht verarbeitet werden.']);
    }

    $fileCount = count($files['name']);
    if (
        $fileCount > 3 ||
        count($files['tmp_name']) !== $fileCount ||
        count($files['size']) !== $fileCount ||
        count($files['error']) !== $fileCount
    ) {
        respond(422, ['message' => 'Bitte wählen Sie höchstens 3 Dateien aus.']);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    for ($index = 0; $index < $fileCount; $index++) {
        $error = $files['error'][$index] ?? UPLOAD_ERR_NO_FILE;
        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($error !== UPLOAD_ERR_OK) {
            respond(422, ['message' => 'Ein Dateiupload ist fehlgeschlagen. Bitte versuchen Sie es erneut.']);
        }

        $temporaryPath = $files['tmp_name'][$index] ?? '';
        $fileSize = (int) ($files['size'][$index] ?? 0);
        if ($fileSize < 1 || $fileSize > 2 * 1024 * 1024 || !is_uploaded_file($temporaryPath)) {
            respond(422, ['message' => 'Jede Datei muss kleiner als 2 MB sein.']);
        }

        $mimeType = $finfo->file($temporaryPath);
        if (!is_string($mimeType) || !isset($mimeTypes[$mimeType])) {
            respond(422, ['message' => 'Erlaubt sind nur JPEG-, PNG- und WebP-Bilder sowie PDF-Dateien.']);
        }

        $fileContents = file_get_contents($temporaryPath);
        if (!is_string($fileContents)) {
            respond(500, ['message' => 'Ein Anhang konnte nicht gelesen werden. Bitte versuchen Sie es erneut.']);
        }

        $originalName = basename((string) ($files['name'][$index] ?? ''));
        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $originalName) ?? '';
        $safeName = trim($safeName, '._-');
        if ($safeName === '') {
            $safeName = 'Anhang.' . $mimeTypes[$mimeType];
        }

        $attachments[] = [
            'name' => substr($safeName, 0, 100),
            'mime' => $mimeType,
            'contents' => $fileContents,
        ];
    }
}

$boundary = '=_Easy2Moove_' . bin2hex(random_bytes(16));
$message = "--{$boundary}\r\n";
$message .= "Content-Type: text/plain; charset=UTF-8\r\n";
$message .= "Content-Transfer-Encoding: base64\r\n\r\n";
$message .= chunk_split(base64_encode($body), 76, "\r\n");

foreach ($attachments as $attachment) {
    $message .= "--{$boundary}\r\n";
    $message .= 'Content-Type: ' . $attachment['mime'] . "; name=\"{$attachment['name']}\"\r\n";
    $message .= "Content-Transfer-Encoding: base64\r\n";
    $message .= 'Content-Disposition: attachment; filename="' . $attachment['name'] . "\"\r\n\r\n";
    $message .= chunk_split(base64_encode($attachment['contents']), 76, "\r\n");
}
$message .= "--{$boundary}--\r\n";

$headers = [
    'From: Easy2Moove Website <info@easy2moove.de>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
];
$subject = '=?UTF-8?B?' . base64_encode('Neue Bewertungsanfrage über die Website') . '?=';

if (!@mail('info@easy2moove.de', $subject, $message, implode("\r\n", $headers))) {
    error_log('Easy2Moove Bewertungsformular: PHP mail() konnte die Anfrage nicht annehmen.');
    respond(502, ['message' => 'Der Mailserver konnte die Anfrage gerade nicht annehmen. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns telefonisch.']);
}

respond(200, ['message' => 'Ihre Anfrage wurde an Easy2Moove übermittelt.']);
