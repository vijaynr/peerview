#!/usr/bin/env bash
set -e

echo "========================================"
echo "PeerView CLI Installer"
echo "========================================"
echo

LOCAL_BIN_DIR="$HOME/.local/bin"

echo "[1/3] Checking for pv binary..."

if [ ! -f "pv" ]; then
    echo
    echo "ERROR: pv binary not found in current directory"
    echo "Please run this script from the directory containing the pv binary"
    echo
    exit 1
fi

echo "     Found pv binary"
echo

echo "[2/3] Installing to $LOCAL_BIN_DIR..."

mkdir -p "$LOCAL_BIN_DIR"
cp pv "$LOCAL_BIN_DIR/pv"
chmod +x "$LOCAL_BIN_DIR/pv"

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
    echo "# Added by PeerView CLI installer" >> "$SHELL_PROFILE"
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
echo "  pv help"
echo
