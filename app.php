<form method="post" enctype="multipart/form-data">
    <input name="file" type="file" />
    <input type="submit" name="uploadsubmit" value="Upload" />
</form>

<?php
print_r($_FILES);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
if(isset($_POST['uploadsubmit'])) {
 $url = 'http://localhost:3011/upload';
 $header = array('Content-Type: multipart/form-data');
 $fields = array('file' => '@' . $_FILES['file']['tmp_name'][0]);
 $token = 'NfxoS9oGjA6MiArPtwg4aR3Cp4ygAbNA2uv6Gg4m';
  echo $url;
 $resource = curl_init();
 curl_setopt($resource, CURLOPT_URL, $url);
 curl_setopt($resource, CURLOPT_HTTPHEADER, $header);
 curl_setopt($resource, CURLOPT_RETURNTRANSFER, 1);
 curl_setopt($resource, CURLOPT_POST, 1);
 curl_setopt($resource, CURLOPT_POSTFIELDS, $fields);
 curl_setopt($resource, CURLOPT_COOKIE, 'apiToken=' . $token);
 $result = json_decode(curl_exec($resource));
 print_r( $result );
 curl_close($resource);
}
?>