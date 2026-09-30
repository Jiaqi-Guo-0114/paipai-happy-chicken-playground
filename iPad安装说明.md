# iPad 私有离线安装

1. 让 Mac 与 iPad 暂时连接同一个家庭 Wi-Fi。
2. 在 Mac 上双击 `启动iPad安装.command`。首次运行会生成本游戏专用的本地 CA 与 HTTPS 证书。
3. 脚本会在 Finder 中选中 `iPad安装证书.cer`。用 AirDrop 把它发送到 iPad 并安装。
4. 在 iPad 打开“设置 → 通用 → 关于本机 → 证书信任设置”，对 `Paipai Happy Chicken Local CA` 启用完全信任。
5. 按终端显示的地址，用 Safari 打开游戏。等菜单右下角显示“离线资源已准备好 · 可添加到主屏幕”。
6. 在 Safari 分享菜单里选择“添加到主屏幕”，随后从主屏幕启动一次。
7. 关闭游戏与 Mac 上的服务，断开 iPad 的 Wi-Fi，再从主屏幕冷启动。完成一个游戏、获得一枚贴纸、强制关闭后重开，确认进度仍在。

验证完成后，可以从 iPad 删除本地 CA。以后更新游戏时，重新安装证书、启动服务并让主屏幕游戏联网打开一次即可更新离线缓存。

证书私钥只会保存在 Mac 当前用户的 `Library/Application Support/PaipaiHappyChicken/certs` 中，不会写进游戏包；项目目录只导出不含私钥的公开安装证书。
