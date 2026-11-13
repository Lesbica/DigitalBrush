#!/usr/bin/env bash
# Phase 0 setup on the deploy server. Run once, BEFORE pushing the Phase 0 code to master.
#
#   ssh <user>@<server> 'mkdir -p ~/paintings'
#   scp -r server/scripts/setup-phase0.sh server/migrations <user>@<server>:~/paintings/
#   ssh -t <user>@<server> 'bash ~/paintings/setup-phase0.sh'
#
# What it does (asks before each step that changes something):
#   1. Applies pending SQL migrations from ~/paintings/migrations (recorded in schema_migrations).
#      They only add columns/tables, so the old backend keeps working.
#   2. Rotates the MySQL password of the app user (SET PASSWORD) to a newly generated one.
#   3. Writes ~/paintings/backend.env (chmod 600) used by `docker run --env-file` in the CI deploy.
#
# Secrets are typed here (hidden input) or generated here; nothing is printed to the screen.
# Needs: docker, openssl. The MySQL client runs from the mysql:8 image on the same docker
# network as the backend, so it reaches the DB the same way the backend does.

set -euo pipefail

DIR="$HOME/paintings"
ENV_FILE="$DIR/backend.env"
MIGRATIONS_DIR="$DIR/migrations"
NETWORK="paintings-net"
MYSQL_IMAGE="mysql:8.0"

ask() { # ask VAR "Prompt" "default"
  local __var="$1" __prompt="$2" __def="${3:-}" __val
  read -r -p "$__prompt${__def:+ [$__def]}: " __val
  printf -v "$__var" '%s' "${__val:-$__def}"
}
ask_secret() { # ask_secret VAR "Prompt"
  local __var="$1" __prompt="$2" __val
  read -r -s -p "$__prompt: " __val; echo
  printf -v "$__var" '%s' "$__val"
}
confirm() { local a; read -r -p "$1 [y/N]: " a; [[ "$a" =~ ^[Yy]$ ]]; }

# Runs the mysql client with the given password; extra args go to mysql, stdin is passed through.
mysql_as() {
  local pw="$1"; shift
  local f; f="$(mktemp)"; chmod 600 "$f"
  printf 'MYSQL_PWD=%s\n' "$pw" > "$f"
  local rc=0
  docker run --rm -i --network "$NETWORK" --env-file "$f" "$MYSQL_IMAGE" \
    mysql --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -B "$DB_NAME" "$@" || rc=$?
  rm -f "$f"
  return $rc
}

command -v docker >/dev/null || { echo "docker not found"; exit 1; }
command -v openssl >/dev/null || { echo "openssl not found"; exit 1; }
mkdir -p "$DIR"; chmod 700 "$DIR"
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null

echo "== Database connection =="
ask DB_HOST "DB host" "172.17.3.23"
ask DB_PORT "DB port" "3306"
ask DB_USER "DB user" "artuser"
ask DB_NAME "DB name" "PaintingsDB"
ask_secret DB_PASSWORD "CURRENT DB password"

echo "Checking connection..."
mysql_as "$DB_PASSWORD" -e "SELECT 1" >/dev/null || { echo "❌ Cannot connect to the DB with these settings"; exit 1; }
echo "✅ Connected"

# ---- 1. Migrations ----
echo
echo "== 1. Migrations =="
[[ -d "$MIGRATIONS_DIR" ]] || { echo "❌ $MIGRATIONS_DIR not found (copy server/migrations next to this script)"; exit 1; }
mysql_as "$DB_PASSWORD" -e "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB"
APPLIED="$(mysql_as "$DB_PASSWORD" -e "SELECT name FROM schema_migrations")"
PENDING=()
for f in "$MIGRATIONS_DIR"/*.sql; do
  name="$(basename "$f")"
  grep -qxF "$name" <<<"$APPLIED" || PENDING+=("$f")
done

if [[ ${#PENDING[@]} -eq 0 ]]; then
  echo "Nothing to apply."
else
  printf 'Pending: %s\n' "${PENDING[@]##*/}"
  if confirm "Apply them now?"; then
    for f in "${PENDING[@]}"; do
      name="$(basename "$f")"
      echo -n "  $name ... "
      mysql_as "$DB_PASSWORD" < "$f"
      mysql_as "$DB_PASSWORD" -e "INSERT INTO schema_migrations (name) VALUES ('$name')"
      echo "ok"
    done
    echo "✅ Migrations applied"
  else
    echo "⚠ Skipped. The new backend needs them, payments will fail without them."
  fi
fi

# ---- 2. Rotate DB password ----
echo
echo "== 2. Rotate DB password for '$DB_USER' =="
echo "The currently running backend uses the old password and will lose DB access"
echo "until the new code is deployed with $ENV_FILE. Do this right before pushing to master."
FINAL_DB_PASSWORD="$DB_PASSWORD"
if confirm "Rotate the DB password now?"; then
  NEW_DB_PASSWORD="$(openssl rand -hex 24)"
  OLD_ESC="${DB_PASSWORD//\'/\'\'}"
  if mysql_as "$DB_PASSWORD" -e "SET PASSWORD = '$NEW_DB_PASSWORD'" 2>/dev/null \
     || mysql_as "$DB_PASSWORD" -e "ALTER USER CURRENT_USER() IDENTIFIED BY '$NEW_DB_PASSWORD' REPLACE '$OLD_ESC'"; then
    mysql_as "$NEW_DB_PASSWORD" -e "SELECT 1" >/dev/null || { echo "❌ New password does not work, check the DB manually"; exit 1; }
    FINAL_DB_PASSWORD="$NEW_DB_PASSWORD"
    echo "✅ DB password rotated (the new one is written only to $ENV_FILE)"
  else
    echo "❌ Rotation failed, keeping the current password"
  fi
else
  echo "Skipped; backend.env will contain the current password."
fi

# ---- 3. backend.env ----
echo
echo "== 3. Write $ENV_FILE =="
ask APP_URL "APP_URL" "https://bestartgallery.pp.ua"
ask API_URL "API_URL (public URL incl. /api)" "https://bestartgallery.pp.ua/api"
ask CORS_ORIGIN "CORS_ORIGIN" "https://bestartgallery.pp.ua"
echo "WayForPay keys: merchant portal → store settings (Merchant login / Merchant secret key)."
ask WAYFORPAY_MERCHANT_ACCOUNT "WAYFORPAY_MERCHANT_ACCOUNT"
ask_secret WAYFORPAY_SECRET_KEY "WAYFORPAY_SECRET_KEY"
ask WAYFORPAY_DOMAIN "WAYFORPAY_DOMAIN (store domain in WayForPay)" "bestartgallery.pp.ua"
SESSION_SECRET="$(openssl rand -hex 48)"

if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
  chmod 600 "$ENV_FILE".bak.*
  echo "Existing file backed up."
fi

umask 077
# docker --env-file takes values literally: no quotes around values.
cat > "$ENV_FILE" <<EOF
PORT=8080
NODE_ENV=production
CORS_ORIGIN=$CORS_ORIGIN
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECURE=true
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$FINAL_DB_PASSWORD
DB_NAME=$DB_NAME
APP_URL=$APP_URL
API_URL=$API_URL
PAYMENT_PROVIDER=wayforpay
WAYFORPAY_MERCHANT_ACCOUNT=$WAYFORPAY_MERCHANT_ACCOUNT
WAYFORPAY_SECRET_KEY=$WAYFORPAY_SECRET_KEY
WAYFORPAY_DOMAIN=$WAYFORPAY_DOMAIN
EOF
chmod 600 "$ENV_FILE"
echo "✅ $ENV_FILE written"

echo
echo "Done. Next: merge the Phase 0 branch into master; CI will start the backend with this env file."
