#!/usr/bin/env bash
set -e

echo "========================================"
echo "CR CLI Installer"
echo "========================================"
echo

LOCAL_BIN_DIR="$HOME/.local/bin"

echo "[1/3] Checking for cr binary..."

if [ ! -f "cr" ]; then
    echo
    echo "ERROR: cr binary not found in current directory"
    echo "Please run this script from the directory containing the cr binary"
    echo
    exit 1
fi

echo "     Found cr binary"
echo

echo "[2/3] Installing to $LOCAL_BIN_DIR..."

mkdir -p "$LOCAL_BIN_DIR"
cp cr "$LOCAL_BIN_DIR/cr"
chmod +x "$LOCAL_BIN_DIR/cr"

echo "     Installed successfully"
echo

echo "[3/3] Updating PATH..."

# Detect shell configuration file
SHELL_PROFILE=""
if [ -n "$BASH_VERSION" ]; then
    SHELL_PROFILE="$HOME/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_PROFILE="$HOME/.bashrc"
elif [ -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
else
    SHELL_PROFILE="$HOME/.profile"
fi

# Check if already in PATH
if grep -q "export PATH=\"\$LOCAL_BIN_DIR:\$PATH\"" "$SHELL_PROFILE" 2>/dev/null || \
   grep -q "export PATH=\"$LOCAL_BIN_DIR:\$PATH\"" "$SHELL_PROFILE" 2>/dev/null || \
   grep -q "$LOCAL_BIN_DIR" "$SHELL_PROFILE" 2>/dev/null; then
    echo "     Already in PATH ($SHELL_PROFILE)"
else
    echo >> "$SHELL_PROFILE"
    echo "# Added by CR CLI installer" >> "$SHELL_PROFILE"
    echo "export PATH=\"$LOCAL_BIN_DIR:\$PATH\"" >> "$SHELL_PROFILE"
    echo "     Added to PATH ($SHELL_PROFILE)"
fi

echo
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo
echo "IMPORTANT: Restart your terminal or run:"
echo "  source $SHELL_PROFILE"
echo
echo "To verify installation, run:"
echo "  cr help"
echo
