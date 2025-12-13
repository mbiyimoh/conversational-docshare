#!/bin/bash

# 33 Strategies Brand Reskin Kit - Installation Script
# Usage: ./install.sh /path/to/target-project

set -e

TARGET_DIR="$1"

if [ -z "$TARGET_DIR" ]; then
    echo "Usage: ./install.sh /path/to/target-project"
    exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory does not exist: $TARGET_DIR"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing 33 Strategies Brand Reskin Kit..."
echo "Target: $TARGET_DIR"

# Copy the kit to target project
cp -r "$SCRIPT_DIR" "$TARGET_DIR/brand-reskin-kit"
echo "✓ Copied brand-reskin-kit/"

# Create .claude/commands/design directory if it doesn't exist
mkdir -p "$TARGET_DIR/.claude/commands/design"
echo "✓ Created .claude/commands/design/"

# Copy slash command
cp "$SCRIPT_DIR/design-overhaul.md" "$TARGET_DIR/.claude/commands/design/overhaul.md"
echo "✓ Installed /design:overhaul command"

# Check if framer-motion is in package.json
if [ -f "$TARGET_DIR/package.json" ]; then
    if ! grep -q "framer-motion" "$TARGET_DIR/package.json"; then
        echo ""
        echo "Note: framer-motion is not installed. Run:"
        echo "  cd $TARGET_DIR && npm install framer-motion"
    fi
fi

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Read brand-reskin-kit/README.md for usage instructions"
echo "2. Fill out brand-reskin-kit/OVERHAUL-SPEC-TEMPLATE.md"
echo "3. Use /design:overhaul <component> to reskin components"
echo "4. Follow brand-reskin-kit/EXECUTION-CHECKLIST.md"
