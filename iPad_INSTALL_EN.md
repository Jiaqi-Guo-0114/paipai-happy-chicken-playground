# Private iPad offline installation

1. Connect the Mac and iPad to the same home Wi-Fi.
2. On the Mac, open `启动iPad安装.command`. The first run creates a dedicated local CA and HTTPS certificate.
3. Send `iPad安装证书.cer` to the iPad with AirDrop and install it.
4. On the iPad, open Settings → General → About → Certificate Trust Settings and fully trust `Paipai Happy Chicken Local CA`.
5. Open either private HTTPS address shown by the Mac in Safari. Wait until the menu says the offline files are ready.
6. In Safari's Share menu, choose Add to Home Screen. Start the installed game once.
7. Close the server, disconnect the iPad from Wi-Fi, and launch the Home Screen app again. Complete an activity, unlock a sticker, close the app and reopen it to check saved progress.

You may remove the local CA from the iPad after verification. To update the game later, temporarily reinstall the certificate and open the Home Screen app while the server is running.

Private keys remain in the Mac user's `Library/Application Support/PaipaiHappyChicken/certs` directory. The game folder contains only the exported public certificate.
