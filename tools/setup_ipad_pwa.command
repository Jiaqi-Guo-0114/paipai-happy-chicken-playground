#!/bin/zsh
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
port="${PAIPAI_PORT:-8443}"
bonjour_name="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
bonjour_host="${bonjour_name}.local"
lan_ip="$(ipconfig getifaddr en0 2>/dev/null || true)"

if [[ -z "$lan_ip" ]]; then
  route_interface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  if [[ -n "$route_interface" ]]; then
    lan_ip="$(ipconfig getifaddr "$route_interface" 2>/dev/null || true)"
  fi
fi

if [[ -z "$lan_ip" ]]; then
  echo "没有找到局域网 IP。请先让 Mac 和 iPad 连接同一个 Wi-Fi。"
  read -k 1 "?按任意键退出…"
  exit 1
fi

default_cert_dir="$(python3 -c 'from pathlib import Path; print(Path.home() / "Library" / "Application Support" / "PaipaiHappyChicken" / "certs")')"
cert_dir="${PAIPAI_CERT_DIR:-$default_cert_dir}"
ca_key="$cert_dir/paipai-local-ca.key"
ca_cert="$cert_dir/paipai-local-ca.pem"
server_key="$cert_dir/paipai-server.key"
server_csr="$cert_dir/paipai-server.csr"
server_cert="$cert_dir/paipai-server.pem"
extensions="$cert_dir/paipai-server.ext"
public_ca="${PAIPAI_PUBLIC_CA:-$project_dir/iPad安装证书.cer}"

umask 077
mkdir -p "$cert_dir"

if [[ ! -f "$ca_key" || ! -f "$ca_cert" ]]; then
  echo "正在为本游戏生成独立的本地证书颁发机构…"
  openssl genrsa -out "$ca_key" 3072
  openssl req -x509 -new -sha256 -days 3650 -key "$ca_key" -out "$ca_cert" \
    -subj "/CN=Paipai Happy Chicken Local CA/O=Paipai Family Game"
fi

openssl genrsa -out "$server_key" 2048
openssl req -new -sha256 -key "$server_key" -out "$server_csr" \
  -subj "/CN=$bonjour_host/O=Paipai Family Game"

printf '%s\n' \
  'basicConstraints=CA:FALSE' \
  'keyUsage=digitalSignature,keyEncipherment' \
  'extendedKeyUsage=serverAuth' \
  "subjectAltName=DNS:$bonjour_host,DNS:localhost,IP:$lan_ip,IP:127.0.0.1" \
  > "$extensions"

openssl x509 -req -sha256 -days 825 -in "$server_csr" -CA "$ca_cert" -CAkey "$ca_key" \
  -CAcreateserial -out "$server_cert" -extfile "$extensions"
openssl x509 -in "$ca_cert" -outform DER -out "$public_ca"
chmod 600 "$ca_key" "$server_key"

echo
echo "证书已经准备好。私钥仅保存在："
echo "  $cert_dir"
echo
echo "请按顺序操作："
echo "  1. 用 AirDrop 把“iPad安装证书.cer”发送到 iPad 并安装。"
echo "  2. iPad：设置 → 通用 → 关于本机 → 证书信任设置，完全信任该证书。"
echo "  3. Safari 打开下面任一地址："
echo "     https://$bonjour_host:$port/"
echo "     https://$lan_ip:$port/"
echo "  4. 等菜单显示“离线资源已准备好”，再添加到主屏幕。"
echo "  5. 断开 Wi-Fi 冷启动验证；验证后可删除 iPad 上的本地 CA。"
echo
if [[ "${PAIPAI_NO_OPEN:-0}" != "1" ]]; then
  open -R "$public_ca" >/dev/null 2>&1 || true
fi

exec python3 "$project_dir/tools/serve_https.py" \
  --root "$project_dir" --cert "$server_cert" --key "$server_key" --port "$port"
