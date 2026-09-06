#!/bin/bash
# Temp-Build (umgeht die goose-shell node/npm-Shims via absolute Node-Binary)
cd "$(dirname "$0")" || exit 1
NODE=/Users/johannes/.config/goose/mcp-hermit/cache/pkg/node-24.15.0/bin/node
set -e
echo "— build-dev —"
BUILD=dev "$NODE" ./node_modules/rolldown/bin/cli.mjs -c rolldown.config.ts
echo "— build-prod —"
BUILD=production "$NODE" ./node_modules/rolldown/bin/cli.mjs -c rolldown.config.ts
echo "BUILD OK"
