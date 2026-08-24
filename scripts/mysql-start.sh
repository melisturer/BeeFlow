#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MYSQL_HOME="$ROOT/.tools/mysql-8.0.40-macos14-arm64"
DATADIR="$ROOT/.tools/mysql-data"
SOCK="$ROOT/.tools/mysql.sock"
PID="$ROOT/.tools/mysql.pid"
LOG="$ROOT/.tools/mysqld.log"

if [[ ! -x "$MYSQL_HOME/bin/mysqld" ]]; then
  echo "MySQL binary bulunamadı: $MYSQL_HOME"
  exit 1
fi

mkdir -p "$DATADIR"

if [[ ! -d "$DATADIR/mysql" ]]; then
  "$MYSQL_HOME/bin/mysqld" --initialize-insecure --datadir="$DATADIR" --basedir="$MYSQL_HOME"
fi

is_alive() {
  if [[ -f "$PID" ]] && kill -0 "$(cat "$PID")" 2>/dev/null; then
    return 0
  fi
  nc -z 127.0.0.1 3306 >/dev/null 2>&1
}

if is_alive; then
  echo "MySQL zaten çalışıyor"
  exit 0
fi

# Stale artifacts from crashed runs
rm -f "$SOCK" "$PID"

# Double-fork so mysqld survives parent shell / Cursor task aborts
daemonize_mysqld() {
  local bin="$MYSQL_HOME/bin/mysqld"
  (
    # First fork
    "$bin" \
      --datadir="$DATADIR" \
      --basedir="$MYSQL_HOME" \
      --port=3306 \
      --socket="$SOCK" \
      --pid-file="$PID" \
      --bind-address=127.0.0.1 \
      --mysqlx=0 \
      --innodb-buffer-pool-size=128M \
      --daemonize \
      >>"$LOG" 2>&1
  )
}

# Prefer native --daemonize; fall back to nohup+disown
if ! daemonize_mysqld; then
  nohup "$MYSQL_HOME/bin/mysqld" \
    --datadir="$DATADIR" \
    --basedir="$MYSQL_HOME" \
    --port=3306 \
    --socket="$SOCK" \
    --pid-file="$PID" \
    --bind-address=127.0.0.1 \
    --mysqlx=0 \
    --innodb-buffer-pool-size=128M \
    >>"$LOG" 2>&1 </dev/null &
  disown || true
fi

for i in $(seq 1 40); do
  if nc -z 127.0.0.1 3306 >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
  if [[ "$i" -eq 40 ]]; then
    echo "MySQL başlamadı. Log: $LOG"
    tail -40 "$LOG" || true
    exit 1
  fi
done

# Ensure app user/db exist (idempotent)
"$MYSQL_HOME/bin/mysql" -h127.0.0.1 -ubeeflow -pbeeflow -e "SELECT 1" &>/dev/null || \
"$MYSQL_HOME/bin/mysql" --socket="$SOCK" -uroot <<'SQL' || \
"$MYSQL_HOME/bin/mysql" --socket="$SOCK" -uroot -pbeeflow <<'SQL'
CREATE DATABASE IF NOT EXISTS beeflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'beeflow'@'%' IDENTIFIED BY 'beeflow';
CREATE USER IF NOT EXISTS 'beeflow'@'localhost' IDENTIFIED BY 'beeflow';
CREATE USER IF NOT EXISTS 'beeflow'@'127.0.0.1' IDENTIFIED BY 'beeflow';
GRANT ALL ON beeflow.* TO 'beeflow'@'%';
GRANT ALL ON beeflow.* TO 'beeflow'@'localhost';
GRANT ALL ON beeflow.* TO 'beeflow'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "MySQL hazır: mysql://beeflow:beeflow@127.0.0.1:3306/beeflow"
