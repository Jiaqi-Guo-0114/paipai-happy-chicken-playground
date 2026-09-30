#!/bin/zsh
set -e
project_dir="$(cd "$(dirname "$0")" && pwd)"
exec "$project_dir/tools/setup_ipad_pwa.command"
