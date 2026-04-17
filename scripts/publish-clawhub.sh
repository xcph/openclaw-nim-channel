#!/bin/bash
# ClawHub 发布脚本
# 用法: ./scripts/publish-clawhub.sh [changelog]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo -e "${BLUE}🚀 ClawHub 发布脚本${NC}"
echo "================================"

# 检查是否登录
echo -e "${YELLOW}检查登录状态...${NC}"
if ! npx clawhub whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ 未登录 ClawHub，正在打开浏览器登录...${NC}"
    npx clawhub login
fi

WHOAMI=$(npx clawhub whoami 2>/dev/null | grep -o '@[^ ]*' || echo "unknown")
echo -e "${GREEN}✓ 已登录: ${WHOAMI}${NC}"

# 从 package.json 读取信息
NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
DESCRIPTION=$(node -p "require('./package.json').description")

# 获取 git 信息
GIT_COMMIT=$(git rev-parse HEAD)
GIT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# changelog 参数
CHANGELOG="${1:-Release v${VERSION}}"

echo ""
echo -e "${BLUE}📦 发布信息:${NC}"
echo "  名称: $NAME"
echo "  版本: $VERSION"
echo "  描述: $DESCRIPTION"
echo "  Git Commit: ${GIT_COMMIT:0:8}"
echo "  Git Remote: $GIT_REMOTE"
echo "  Changelog: $CHANGELOG"
echo ""

# 确认发布
read -p "确认发布到 ClawHub? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}已取消发布${NC}"
    exit 0
fi

# 执行发布
echo ""
echo -e "${YELLOW}正在发布...${NC}"

npx clawhub package publish "$PROJECT_DIR" \
    --family "code-plugin" \
    --name "$NAME" \
    --display-name "NetEase IM (云信)" \
    --version "$VERSION" \
    --changelog "$CHANGELOG" \
    --source-repo "$GIT_REMOTE" \
    --source-commit "$GIT_COMMIT" \
    --source-ref "$GIT_BRANCH"

echo ""
echo -e "${GREEN}✅ 发布成功!${NC}"
echo ""
echo -e "${BLUE}📋 发布详情:${NC}"
npx clawhub package inspect "$NAME" | cat
