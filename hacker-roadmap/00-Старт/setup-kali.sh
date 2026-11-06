#!/usr/bin/env bash
# Первичная настройка Kali Linux для учёбы.
# Запуск внутри Kali:  bash setup-kali.sh
# Скрипт можно запускать повторно — уже установленное он пропустит.

set -u

echo "==> Обновляю список пакетов и систему (может занять 10-30 минут)"
sudo apt update
sudo apt full-upgrade -y

# Большинство инструментов в Kali уже есть; здесь — то, что пригодится
# по плану обучения. Если какой-то пакет не поставится, скрипт его пропустит.
PKGS=(
  git curl wget tmux vim tree      # базовые утилиты
  openvpn                          # подключение к TryHackMe / HackTheBox
  nmap wireshark                   # сети
  burpsuite sqlmap gobuster ffuf feroxbuster seclists  # веб
  rlwrap                           # удобные шеллы в лабах
  python3-pip python3-venv pipx    # Python
)

for p in "${PKGS[@]}"; do
  if dpkg -s "$p" >/dev/null 2>&1; then
    echo "[=] $p уже установлен"
  elif sudo apt install -y "$p"; then
    echo "[+] $p установлен"
  else
    echo "[!] $p не удалось установить — пропускаю (запиши в дневник и разберись)"
  fi
done

echo "==> Создаю рабочие папки"
mkdir -p ~/labs/{tryhackme,hackthebox,portswigger,ctf,bandit} ~/tools ~/scripts

echo
echo "Готово!"
echo "Что дальше:"
echo "  1. Выключи виртуалку и сделай снимок (snapshot) «чистая система»."
echo "  2. Открой Прогресс.md в Obsidian и отметь пункты этапа 0."
