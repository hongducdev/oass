# Oass Build Report

Ngày cập nhật: 2026-08-04

## Tổng quan

Oass hiện là ứng dụng desktop Windows dùng Tauri 2 và Rust. Giao diện được xây bằng React, Tailwind CSS, các primitive theo shadcn/ui và xterm.js. Toàn bộ project WinUI 3 cũ đã được loại bỏ sau khi bản Tauri đạt parity chức năng và vượt qua validation.

Trạng thái: frontend build thành công, TypeScript không lỗi, Rust compile thành công và 3/3 test backend đạt.

## Kiến trúc hiện tại

- `src/`: React UI, title bar, session sidebar, terminal workspace, AI panel, Settings và shadcn/ui primitives.
- `src-tauri/`: Tauri 2 application, Rust commands, native PTY, Windows Credential Manager và HTTP streaming.
- `package.json`: Vite, TypeScript và Tauri development workflow.
- `src-tauri/Cargo.toml`: Rust dependencies và build configuration.

## Giao diện

- Custom frameless title bar theo cấu trúc Windows Terminal.
- Search sessions và tabs được căn giữa theo chiều dọc.
- Session sidebar, nhiều terminal tab và phím tắt `Ctrl+T`.
- Terminal session header, trạng thái LIVE và bottom command composer theo phong cách Warp.
- AI Assistant và Settings dùng panel bo góc.
- Ở cửa sổ rộng, panel hiển thị cạnh terminal.
- Dưới 1050 px, panel chuyển thành overlay để không làm co terminal.
- Ở kích thước tối thiểu 800x560, backdrop làm rõ panel và cho phép bấm ra ngoài để đóng.
- Dark theme thống nhất với violet accent, Cascadia terminal font và trạng thái focus rõ ràng.

## Terminal Rust PTY

- Dùng `portable-pty` và Windows ConPTY, không dùng redirected stdout giả terminal.
- Ưu tiên PowerShell 7 tại `Program Files`, fallback về Windows PowerShell.
- Hỗ trợ create, write, resize và close cho từng terminal session.
- xterm.js xử lý input, ANSI output, cursor, selection và terminal handshake.
- Đóng session sẽ kill child process tương ứng.
- Rust smoke test xác nhận ConPTY handshake và capture output thành công.
- Rust test riêng xác nhận PowerShell executable được resolve hợp lệ.

## AI và Settings

- Chat gọi OpenAI-compatible `/chat/completions` qua Rust `reqwest`.
- SSE token stream được gửi về React qua Tauri `Channel`.
- Endpoint mặc định: `http://localhost:20128/v1`.
- Model mặc định: `gpt-4.1-mini`.
- Endpoint chỉ được dùng qua HTTPS, hoặc HTTP nếu host là loopback.
- API key được lưu bằng Windows Credential Manager qua crate `keyring`.
- Endpoint và model được lưu trong `localStorage`; API key không được ghi rõ chữ vào đó.
- Validation không gửi model request thật để tránh sử dụng key hoặc phát sinh chi phí ngoài phạm vi.

## Visual validation

Visual gate 6/6 đã được người dùng phê duyệt với ngân sách 3 vòng.

- Loop 1: native Tauri tại 1240x800, xác nhận shell, xterm, PTY, title bar và composer.
- Loop 2: 900x650, xác nhận Settings overlay không làm co terminal.
- Loop 3: 800x560, xác nhận AI overlay, backdrop và thao tác đóng panel.
- Frontend console không có warning hoặc error trong các vòng browser validation.

Artifacts:

- `agentter-tauri-loop-1.png`
- `agentter-tauri-loop-2.png`
- `agentter-tauri-loop-3.png`

## Validation

### Repo validation

```powershell
npm test
```

Lệnh này chạy:

- `tsc --noEmit`
- `cargo test --manifest-path src-tauri/Cargo.toml`

Kết quả gần nhất: 3 test Rust đạt, 0 test lỗi.

### Frontend production build

```powershell
npm run build
```

Kết quả: TypeScript và Vite production build thành công. Vite còn cảnh báo bundle xterm/lucide lớn hơn 500 kB, không chặn build.

### Rust check

```powershell
npm run rust:check
```

Kết quả: Rust backend compile check thành công.

## Cách chạy

Cài dependencies:

```powershell
npm install
```

Chạy app desktop:

```powershell
npm run tauri dev
```

Build frontend:

```powershell
npm run build
```

## Phần WinUI đã xóa

Các mục sau đã được xóa vĩnh viễn theo phê duyệt của người dùng:

- `AgentTer.sln`
- `NuGet.config`
- `src/AgentTer.App`
- `src/AgentTer.AI`
- `src/AgentTer.Shared`
- `src/AgentTer.Terminal`

Workspace hiện không phải Git repository, vì vậy các mục đã xóa không thể khôi phục bằng Git.

## Rủi ro còn lại

- Chưa gửi request thật tới 9router trong validation.
- Production bundle hiện còn một chunk lớn do xterm.js và icon dependencies; có thể tối ưu bằng code splitting nếu thời gian khởi động trở thành vấn đề đo được.
- Hai script cũ trong `assets/shell-scripts/` được giữ lại vì nằm ngoài phạm vi xóa đã phê duyệt và hiện không được Tauri runtime sử dụng.
