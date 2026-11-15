# Перенос версии с личными аккаунтами и лимитом

Обновлено 15 ноября 2026 года. Код обновления — `08e7af2`, ветка `feature/reader-trials-test-checkout`.

Команды учитывают ранее настроенный сервер `ai@10.44.78.78`, сервис `al-qalam-api`, исходники в `/home/ai/al-qalam/Mederes` и корень Nginx `/var/www/al-qalam`. Выполняйте блоки по порядку. Если возникает ошибка, сначала устраните её.

## 1. Подготовить архивы на MacBook

```bash
cd /Users/ruman/Documents/agre/Mederes
git archive --format=tar.gz -o /tmp/al-qalam-back-08e7af2.tar.gz 08e7af2 back
cd app
npm run build
tar -czf /tmp/al-qalam-ui-08e7af2.tar.gz -C dist .
scp /tmp/al-qalam-back-08e7af2.tar.gz /tmp/al-qalam-ui-08e7af2.tar.gz ai@10.44.78.78:~/al-qalam/
```

Архив backend содержит только файлы Git. Серверный `.env`, модели и аудио остаются на сервере. Frontend собран на MacBook, установка npm на сервере не требуется.

## 2. На сервере проверить пути и сделать копию

```bash
ssh ai@10.44.78.78
sudo systemctl show al-qalam-api -p WorkingDirectory -p ExecStart
sudo nginx -T 2>/dev/null | grep -nE 'server_name|root |ai-api|ai-stream|proxy_pass'
```

Рабочая папка API должна быть `/home/ai/al-qalam/Mederes/back`, бинарник `/home/ai/al-qalam/Mederes/bin/al-qalam-api`, корень нужного сайта — `/var/www/al-qalam`. При других значениях скорректируйте команды до выполнения.

Следующий блок запускается целиком в Bash. Указана база `medrese`; если `DB_NAME` серверного `back/.env` отличается, замените имя в `pg_dump`.

```bash
bash <<'BASH'
set -euo pipefail
cd "$HOME/al-qalam"
umask 077
backup_dir="$HOME/al-qalam/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
sudo -u postgres pg_dump -Fc medrese > "$backup_dir/medrese.dump"
test -s "$backup_dir/medrese.dump"
sudo -u postgres pg_restore --list < "$backup_dir/medrese.dump" > /dev/null
cp -a Mederes/back "$backup_dir/back"
cp -a Mederes/bin/al-qalam-api "$backup_dir/al-qalam-api"
sudo cp -a /var/www/al-qalam "$backup_dir/site"
sudo cp -a /etc/nginx "$backup_dir/nginx"
echo "Копия сохранена в $backup_dir"
BASH
```

## 3. Обновить код и собрать новый бинарник

Этот блок синхронизирует каталоги кода полностью, поэтому удалённые в новой версии Go-файлы уйдут из сборки. Для каждой загрузки создаётся своя папка распаковки.

```bash
bash <<'BASH'
set -euo pipefail
cd "$HOME/al-qalam"
stage_dir=$(mktemp -d "$HOME/al-qalam/reader-update.XXXXXXXX")
tar -xzf al-qalam-back-08e7af2.tar.gz -C "$stage_dir"
mkdir -p "$stage_dir/site"
tar -xzf al-qalam-ui-08e7af2.tar.gz -C "$stage_dir/site"
for code_dir in cmd internal pkg migrations; do
  rsync -a --delete "$stage_dir/back/$code_dir/" "Mederes/back/$code_dir/"
done
cp "$stage_dir/back/go.mod" "$stage_dir/back/go.sum" Mederes/back/
cd Mederes/back
go test ./...
go build -o ../bin/al-qalam-api.next ./cmd/server
echo "Сборка готова. Файлы сайта находятся в $stage_dir/site"
BASH
```

## 4. Проверить Nginx перед включением лимита

В `/etc/nginx/sites-available/al-qalam.ru` замените старые location-блоки для Python следующими. Если блок с таким путём уже есть, отредактируйте его, чтобы избежать дубликатов.

```nginx
location ^~ /ai-api/ {
    return 404;
}
location ^~ /ai-stream {
    return 404;
}
location ^~ /api/practice/ {
    client_max_body_size 20m;
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 100s;
    proxy_send_timeout 100s;
}
```

Существующий `/api/` должен вести в Go API на `127.0.0.1:8000`. Python AI продолжает работать на `127.0.0.1:8001`. Для внешнего прокси администратору передайте требования — направлять `/api/`, включая `/api/practice/`, в этот контейнер, разрешить тело 20 МБ и таймаут 100 секунд, закрыть прямые `/ai-api/` и `/ai-stream`. Иначе старый публичный маршрут позволит обойти лимит.

```bash
sudo nginx -t
```

## 5. Включить backend и сайт

Подставьте путь `reader-update.XXXXXXXX`, который был напечатан на шаге сборки.

```bash
bash <<'BASH'
set -euo pipefail
cd "$HOME/al-qalam/Mederes/back"
mv ../bin/al-qalam-api.next ../bin/al-qalam-api
sudo systemctl restart al-qalam-api
curl --fail http://127.0.0.1:8000/health
BASH
```

Backend применит миграции 020–022. Если health не отвечает, проверьте `sudo journalctl -u al-qalam-api -n 60 --no-pager` до переключения сайта.

```bash
sudo rsync -a --delete /home/ai/al-qalam/reader-update.XXXXXXXX/site/ /var/www/al-qalam/
sudo find /var/www/al-qalam -type d -exec chmod 755 {} +
sudo find /var/www/al-qalam -type f -exec chmod 644 {} +
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Проверить с MacBook

```bash
curl -I https://al-qalam.ru/reader
curl -i https://al-qalam.ru/api/practice/health
curl -i https://al-qalam.ru/ai-api/health
```

Ожидаются 200 для страницы, 401 для практики без входа и 404 для старого AI-пути. Затем зарегистрируйте отдельный личный аккаунт, выполните три чтения и убедитесь, что новая запись блокируется. Войдите как владелец через `/login`, на `/platform` откройте личных пользователей и сбросьте лимит этого аккаунта.

Существующий владелец и школы сохраняются. Повторный bootstrap владельца не требуется.

## Оплата на сервере

Текущий выпуск поддерживает тестовый магазин вне `APP_ENV=production`. При production тестовая оплата отключена. Подписку можно выдать вручную из админки. Локальный секрет тестового магазина нельзя копировать поверх серверного `.env`. Для реальных списаний нужны отдельный выпуск с боевым магазином, проверкой уведомлений и окончательными условиями оплаты. Сохраните production-настройку сервера.

## Возврат предыдущей версии

Используйте каталог копии из шага 2. Остановите API, скопируйте сохранённый бинарник обратно, восстановите статические файлы и перезапустите сервис. Дополнительные миграции можно оставить в базе при возврате предыдущей совместимой версии. Восстановление старого дампа откатит также пользовательские изменения после резервирования, поэтому для обычного отката сначала используйте сохранённые бинарник и сайт.

## Приватный GitHub

Settings → General → Danger Zone → Change repository visibility → Make private. Этот способ переноса через архив продолжит работать. Для будущего git pull на сервере понадобится SSH deploy key с чтением приватного репозитория. Уже существующие публичные копии и форки сохраняются у их владельцев. Инструкция GitHub — https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility .
