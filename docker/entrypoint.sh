#!/bin/sh
set -eu

TLS_MODE="${PV_WEBHOOK_TLS_MODE:-auto}"
PORT="${PV_WEBHOOK_PORT:-3000}"
SSL_CERT_PATH_VALUE="${SSL_CERT_PATH:-}"
SSL_KEY_PATH_VALUE="${SSL_KEY_PATH:-}"
SSL_CA_PATH_VALUE="${SSL_CA_PATH:-}"

require_file() {
  if [ -z "$2" ]; then
    echo "Missing required value for $1." >&2
    exit 1
  fi
  if [ ! -f "$2" ]; then
    echo "File for $1 was not found: $2" >&2
    exit 1
  fi
}

set -- pv serve --webhook --port "$PORT"

if [ -n "${PV_WEBHOOK_CONCURRENCY:-}" ]; then
  set -- "$@" --concurrency "$PV_WEBHOOK_CONCURRENCY"
fi

if [ -n "${PV_WEBHOOK_QUEUE_LIMIT:-}" ]; then
  set -- "$@" --queue-limit "$PV_WEBHOOK_QUEUE_LIMIT"
fi

if [ -n "${PV_WEBHOOK_TIMEOUT_MS:-}" ]; then
  set -- "$@" --timeout "$PV_WEBHOOK_TIMEOUT_MS"
fi

case "$TLS_MODE" in
  http)
    ;;
  https)
    require_file "SSL_CERT_PATH" "$SSL_CERT_PATH_VALUE"
    require_file "SSL_KEY_PATH" "$SSL_KEY_PATH_VALUE"
    set -- "$@" --ssl-cert "$SSL_CERT_PATH_VALUE" --ssl-key "$SSL_KEY_PATH_VALUE"
    if [ -n "$SSL_CA_PATH_VALUE" ]; then
      require_file "SSL_CA_PATH" "$SSL_CA_PATH_VALUE"
      set -- "$@" --ssl-ca "$SSL_CA_PATH_VALUE"
    fi
    ;;
  auto)
    if [ -n "$SSL_CERT_PATH_VALUE" ] && [ -n "$SSL_KEY_PATH_VALUE" ]; then
      require_file "SSL_CERT_PATH" "$SSL_CERT_PATH_VALUE"
      require_file "SSL_KEY_PATH" "$SSL_KEY_PATH_VALUE"
      set -- "$@" --ssl-cert "$SSL_CERT_PATH_VALUE" --ssl-key "$SSL_KEY_PATH_VALUE"
      if [ -n "$SSL_CA_PATH_VALUE" ]; then
        require_file "SSL_CA_PATH" "$SSL_CA_PATH_VALUE"
        set -- "$@" --ssl-ca "$SSL_CA_PATH_VALUE"
      fi
    fi
    ;;
  *)
    echo "Unsupported PV_WEBHOOK_TLS_MODE: $TLS_MODE. Use http, https, or auto." >&2
    exit 1
    ;;
esac

exec "$@"

