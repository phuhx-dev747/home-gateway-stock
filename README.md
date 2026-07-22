# Home Gateway Stock / Monitor

Hướng dẫn build, chạy trực tiếp và chạy thông qua PM2.

## 1. Build project
```bash
go build -o gateway-monitor main.go
```

## 2. Chạy trực tiếp (Development)
```bash
PORT=3001 ./gateway-monitor
```

## 3. Chạy bằng PM2 (Production)
Dự án đã cấu hình sẵn file `ecosystem.config.js`.

### Khởi chạy service bằng PM2
```bash
pm2 start ecosystem.config.js
```

### Các lệnh quản lý PM2 khác
* Xem trạng thái/danh sách ứng dụng:
  ```bash
  pm2 list
  ```
* Xem logs trực tiếp:
  ```bash
  pm2 logs gateway-monitor
  ```
* Restart ứng dụng:
  ```bash
  pm2 restart gateway-monitor
  ```
* Dừng ứng dụng:
  ```bash
  pm2 stop gateway-monitor
  ```
* Xóa ứng dụng khỏi PM2:
  ```bash
  pm2 delete gateway-monitor
  ```
