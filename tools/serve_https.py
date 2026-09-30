#!/usr/bin/env python3
"""Serve the game over private HTTPS for iPad PWA installation."""

from __future__ import annotations

import argparse
import http.server
import mimetypes
import pathlib
import ssl


class GameRequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".cer": "application/pkix-cert",
        ".wav": "audio/wav",
    }

    def end_headers(self) -> None:
        requested = self.path.split("?", 1)[0]
        if requested.endswith(("/", "/index.html", "/sw.js", "/assets.js")):
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="派派的快乐小鸡私有 HTTPS 服务")
    parser.add_argument("--root", type=pathlib.Path, required=True, help="游戏项目目录")
    parser.add_argument("--cert", type=pathlib.Path, required=True, help="HTTPS 证书")
    parser.add_argument("--key", type=pathlib.Path, required=True, help="HTTPS 私钥")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8443)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = args.root.expanduser().resolve()
    cert = args.cert.expanduser().resolve()
    key = args.key.expanduser().resolve()
    for path, label in ((root, "游戏目录"), (cert, "证书"), (key, "私钥")):
        if not path.exists():
            raise SystemExit(f"{label}不存在：{path}")

    mimetypes.add_type("application/manifest+json", ".webmanifest")
    handler = lambda *handler_args, **handler_kwargs: GameRequestHandler(  # noqa: E731
        *handler_args, directory=str(root), **handler_kwargs
    )
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert), keyfile=str(key))
    server.socket = context.wrap_socket(server.socket, server_side=True)
    print(f"快乐小鸡 HTTPS 服务已启动：端口 {args.port}", flush=True)
    print("保持这个窗口打开；iPad 安装完成并验证离线后可按 Control-C 关闭。", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nHTTPS 服务已关闭。", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
