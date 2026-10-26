# Bản Tin Sáng

Trang tin cá nhân đọc mỗi sáng: tin nóng trên mạng xã hội, drama & phốt, thế giới & địa chính trị,
trong nước, giá vàng, giá xăng dầu, tỷ giá, chứng khoán trong nước, và từ khoá người Việt đang tìm nhiều
trên Google.

Tin cùng một việc từ nhiều báo được gộp làm một ("4 báo cùng đưa tin"); càng nhiều báo đưa, tin càng
được xếp cao. Tin đăng sau lần đọc trước có dấu **Mới**, tin đã bấm đọc bị làm mờ.

## Ba cách dùng, chung một mã nguồn

| Dùng ở đâu | Bản build | Lấy tin bằng gì |
| --- | --- | --- |
| Chrome trên máy tính | extension (`dist-extension/`) | Service worker của extension tự tải RSS + giá 20 phút / lần. Không cần server |
| Điện thoại | trang tĩnh trên GitHub Pages (`dist-static/`) | GitHub Actions tải 30 phút / lần, đăng `brief.json` |
| Máy Mac (phát triển) | `npm run dev` | Server Hono trên Mac |

Ba nơi dùng chung lõi `core/` (đọc RSS, bóc giá, gộp tin, ghép bản tin); chỉ khác chỗ lưu dữ liệu
(chrome.storage / `state.json` trên trang / `data/state.json`). Giao diện chọn nguồn lúc build theo
`--mode` (xem `src/lib/source.ts`).

### Extension Chrome

```bash
npm install
npm run build:extension
```

Mở `chrome://extensions` → bật **Chế độ dành cho nhà phát triển** (góc phải trên) → **Tải tiện ích đã giải nén**
(Load unpacked) → chọn thư mục `dist-extension`. Ghim biểu tượng mặt trời lên thanh công cụ; bấm vào là mở
bản tin. Số trên biểu tượng = số tin mới từ lần mở trước.

Sửa code xong: chạy lại `npm run build:extension` rồi bấm nút tải lại (↻) trên thẻ extension trong `chrome://extensions`.

### Điện thoại (GitHub Pages)

Repo phải để công khai (GitHub Pages miễn phí chỉ cho repo công khai). Thiết lập một lần:

1. Tạo repo trống trên github.com, đẩy code lên nhánh `main`.
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Tab **Actions** → workflow "Đăng bản tin" → **Run workflow** (hoặc chờ lịch chạy kế tiếp).

Sau đó trang ở `https://<tài khoản>.github.io/<tên repo>/`, tự cập nhật 30 phút / lần (GitHub có thể trễ
vài phút tới vài chục phút lúc đông máy). Trên điện thoại: iPhone mở bằng Safari → nút Chia sẻ → **Thêm vào
MH chính**; Android mở bằng Chrome → menu ⋮ → **Thêm vào màn hình chính**. Từ đó mở như một ứng dụng.

Dữ liệu lượt trước (`state.json`, ~0,5 MB) nằm ngay trên trang đã đăng; lượt sau tải về đọc tiếp, nên repo
không phình vì commit dữ liệu. Repo công khai không có commit trong 60 ngày thì GitHub tự tắt lịch chạy;
workflow có bước bật lại mỗi lượt, nếu vẫn bị tắt GitHub sẽ gửi email — vào tab Actions bấm **Enable workflow**.

### Máy Mac

```bash
npm run dev      # API :4600 + web :5200 → http://localhost:5200 (điện thoại cùng wifi: http://<IP Mac>:5200)
npm run build && npm start    # một tiến trình → http://localhost:4600
```

Lệnh khác: `npm test` · `npm run typecheck` · `npm run lint` · `npm run build:static && npm run publish:brief`
(dựng thử bản GitHub Pages vào `dist-static/`).

## Nguồn dữ liệu (thử được ngày 20/10/2026)

| Mục | Nguồn |
| --- | --- |
| Nóng trên mạng | Kenh14 (Hot trend, Nhân vật, Xã hội\*), Thanh Niên Giới trẻ, Dân trí Đời sống\* |
| Drama & phốt | Kenh14 Star / Sao Việt, giải trí của VnExpress, Dân trí, Thanh Niên, Tuổi Trẻ, Znews |
| Thế giới | VnExpress, Tuổi Trẻ, Thanh Niên, Dân trí, Znews, BBC Tiếng Việt, RFI Tiếng Việt |
| Trong nước | VnExpress (Nổi bật, Thời sự), Tuổi Trẻ, Thanh Niên, Dân trí Xã hội, Znews Xã hội |
| Đang tìm | Google Trends RSS `geo=VN` |
| Giá vàng | API PNJ (`edge-api.pnj.io`): vàng miếng SJC + nhẫn trơn 999.9, đơn vị gốc nghìn đồng / chỉ |
| Vàng thế giới | `api.gold-api.com/price/XAU`, quy ra đồng / lượng theo giá bán USD của Vietcombank |
| Tỷ giá | XML Vietcombank (VCB yêu cầu không gọi dày hơn 5 phút / lần) |
| Xăng dầu | Bảng Petrolimex chép trên `webgia.com/gia-xang-dau/petrolimex/`, kèm dầu thô WTI / Brent |
| Chứng khoán | API công khai VNDirect (`api-finfo.vndirect.com.vn/v4`): VN-Index, VN30, HNX, UPCoM, số mã tăng / giảm; 5 mã HOSE tăng / giảm mạnh nhất trong số mã khớp lệnh ≥ 10 tỷ (thử ngày 26/10/2026) |
| Nhận định, mã chuyên gia nhắc tới | RSS Vietstock "Nhận định thị trường" và "Ý kiến chuyên gia"; mã trong tiêu đề hỏi lại VNDirect để chắc là mã thật |

\* chỉ lấy bài có dấu hiệu đang lan trên mạng hoặc có phốt (xem `SOCIAL_WORDS`, `DRAMA_WORDS` trong `core/rank.ts`).

Thêm / bỏ báo: sửa `core/sources.ts`. Quyền truy cập trang của extension (`host_permissions`) sinh tự động từ
danh sách này lúc build.

### Những nguồn đã thử và vì sao không dùng

- **Facebook**: không đọc được bảng tin khi chưa đăng nhập, và cào khi đăng nhập dễ bị khoá tài khoản.
  "Nóng trên mạng" vì vậy lấy từ các chuyên mục báo chuyên đưa lại chuyện đang lan trên MXH.
- **SJC** (`sjc.com.vn`): chặn bằng Cloudflare. Giá vàng miếng SJC lấy qua bảng của PNJ.
- **DOJI**: API báo "Site off-line".
- **Petrolimex** (`petrolimex.com.vn`): giá tải bằng JS qua API có mã hoá; webgia.com trả HTML tĩnh.
- **PVOil**: trả 403. **Saostar, Yan, 2sao, Ngôi sao, Tiin, Afamily**: không còn RSS.
- **Khuyến nghị của VNDirect** (`/v4/recommendations`, giá mục tiêu của các công ty chứng khoán): dừng cập nhật
  từ 23/07/2026. **TCBS**: API chặn bằng Cloudflare.

## Cách hoạt động

- `core/refresh.ts` tải ~25 RSS (6 request song song) + Google Trends + giá, ghi vào `State` (`core/state.ts`):
  bài giữ 3 ngày, giá giữ 10 ngày (giá không đổi thì tối đa một điểm / giờ). Một nguồn lỗi không làm hỏng cả
  lượt; lỗi hiện ở cuối trang, tin cũ của nguồn đó vẫn giữ.
- `core/rank.ts` gộp bài trùng bằng TF-IDF (từ đơn + cặp từ) và cosine trên tiêu đề + sapo. Ngưỡng 0,28
  chọn bằng mắt trên 509 bài thật; hai tiêu đề đều có tên riêng mà không chung tên nào thì cần 0,45
  (tránh gộp "TP.HCM bổ nhiệm cán bộ" với "Hà Tĩnh bổ nhiệm cán bộ"). Test hồi quy dùng đúng 509 bài đó
  (`core/__fixtures__/articles-2026-10-20.json`).
- Xếp hạng: độ mới (giảm dần theo giờ) + số báo cùng đưa + điểm cộng cho nhãn Phốt / MXH / Địa chính trị.
- Chứng khoán (`core/stocks.ts`): trong giờ giao dịch (8:45–15:15 thứ Hai–Sáu) tải cùng mỗi lượt 20 phút,
  ngoài giờ 2 giờ / lần. Mỗi lượt 4–5 request nhỏ tới VNDirect vì lọc, sắp xếp làm ngay trên server của họ.
- So sánh giá: vàng và tỷ giá so với giá ghi được cách đây ≥ 20 giờ ("hôm qua"); xăng dầu so với kỳ điều
  chỉnh trước. Vì so với dữ liệu tự ghi, ngày đầu chạy chưa có mức tăng / giảm. Extension, GitHub Pages và
  server trên Mac mỗi nơi ghi lịch sử riêng.
- "Tin mới" và "đã đọc" lưu trong localStorage của từng trình duyệt; mở lại trang sau hơn 2 giờ là một lần đọc mới.

## Khi một nguồn lỗi

Xem hộp lỗi cuối trang (hoặc log của server / của lượt chạy trong tab Actions). Thường gặp:

- `HTTP 404` / `Không phải RSS/Atom`: báo đổi đường dẫn RSS → tìm lại trong trang `/rss` của báo, sửa `core/sources.ts`.
- `PNJ: thiếu hoặc lệch đơn vị giá`, `webgia: …`, `VCB: …`: nguồn đổi khuôn dữ liệu. Bộ bóc cố ý ném lỗi
  thay vì hiện số sai; lưu một bản mới vào `core/__fixtures__/`, sửa hàm `parse…` trong `core/prices.ts` cho
  tới khi test qua.
- `The operation was aborted due to timeout`: báo chậm (Thanh Niên hay bị), lượt sau thường tự hết.
- Chỉ lỗi trên GitHub Actions mà extension vẫn lấy được: trang đó chặn máy chủ nước ngoài (máy của GitHub ở Mỹ).
- Thử extension bằng Chrome headless (Playwright): Vietcombank chặn user-agent "HeadlessChrome" — phải chạy
  với `--user-agent` của Chrome thường. Chrome thật không bị.
