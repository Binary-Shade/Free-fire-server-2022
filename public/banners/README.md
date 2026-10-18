# Lobby banner images

Place an image such as `home.png` in this directory. The main server exposes it
at `/assets/banners/home.png`.

For the local MSI/App Player setup, start the login and main services with:

```powershell
$env:LOBBY_BANNER_IMAGE_URL='https://loginbp2.samosasmobiles.dpdns.org/assets/banners/home.png'
```

Restart the game after changing banner settings. Use a PNG or JPG sized for a
wide landscape banner; 1280x720 is a good starting point.
