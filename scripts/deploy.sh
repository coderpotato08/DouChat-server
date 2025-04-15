#!/bin/bash

REMOTE_USER="deploy"
REMOTE_HOST="116.62.221.22"
REMOTE_DIR="/home/deploy/chat-room-server"

LOCAL_DIR="."

# 使用 rsync 上传文件，排除 node_modules 和 .git 文件夹
rsync -avz \
      --exclude='src/public' \
      --exclude='scripts' \
      --exclude='node_modules' \
      --exclude='.git' \$LOCAL_DIR/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR

echo "✅ upload success!"
