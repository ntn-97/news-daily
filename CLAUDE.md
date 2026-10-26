# Hướng dẫn cho Claude Code trong repo này

Đọc `README.md` trước: ba cách dùng (extension, GitHub Pages, server trên Mac), nguồn dữ liệu, nguồn nào đã thử
mà không dùng được và vì sao.

## Luật cứng

- **`core/` phải chạy được ở cả Node, service worker của extension và trình duyệt**: không import `node:*`,
  không dùng `document` / `window`. Hàm tải được truyền vào (`FetchText`), lưu trữ do nơi gọi lo.
  Mã chỉ dành cho Node để trong `server/` hoặc `scripts/`.
- **Server và script chạy thẳng `.ts` bằng Node 24** (bỏ kiểu khi chạy): import trong `server/`, `scripts/`,
  `core/`, `shared/` phải ghi đuôi `.ts`, chỉ dùng cú pháp xoá được (không enum, namespace, parameter property).
  Web và extension import qua alias `@core/...`, `@shared/...`.
- **Bóc dữ liệu lệch khuôn thì ném lỗi, không trả số rỗng hay bỏ qua.** Giá vàng sai 10.000 lần mà trông như
  thật còn tệ hơn không có giá. Mỗi hàm `parse…` có test trên file thật trong `core/__fixtures__/`.
- **Đổi ngưỡng gộp tin (`SAME_STORY…` trong `core/rank.ts`) phải chạy lại `rank.test.ts`** — test dùng
  509 bài thật, có cả cặp phải gộp lẫn cặp không được gộp. Thêm cặp mới vào test khi gặp gộp sai.
- **Đổi khuôn `State` (`core/state.ts`) phải tăng `v`**: state cũ nằm trong chrome.storage của người dùng và trên
  trang GitHub Pages; `reviveState` gặp `v` lạ thì bắt đầu lại từ trống thay vì đọc sai.
- Trang của extension cấm script nội tuyến (CSP của Manifest V3): không viết `<script>` có nội dung trong
  `index.html`, để file riêng trong `public/` như `theme-init.js`.
- Không tải nguồn dày hơn hiện tại (`CONCURRENCY` 6, 20 phút / lần, VCB tối thiểu 5 phút): đây là server
  của người khác, và bản tin đọc buổi sáng không cần nhanh hơn.
- Không cào Facebook / TikTok cho mục "Nóng trên mạng" (cần đăng nhập, dễ bị khoá tài khoản).
- Giao diện tiếng Việt, số kiểu Việt Nam (`src/lib/format.ts`). Comment tiếng Việt, giải thích vì sao.

## Lưu ý

- shadcn ở đây là style `base-nova` (Base UI, không phải Radix): `Button` không có `asChild`.
- Màu riêng (sun, up/down, tag-*) là token trong `src/index.css`, chọn riêng cho nền sáng và nền tối.
  Giá tăng xanh, giảm đỏ theo thói quen đọc bảng giá ở Việt Nam.
- `manifest.json` của extension sinh trong `vite.config.ts`; `host_permissions` lấy từ `core/sources.ts` và các URL
  giá trong `core/prices.ts`, `core/stocks.ts`.
- `node --watch` (npm run dev) khởi động lại API khi sửa file server và chạy ngay một lượt làm mới.
  Tắt `npm run dev` phải tắt cả tiến trình `node --watch` cha, không chỉ tiến trình giữ cổng 4600.
