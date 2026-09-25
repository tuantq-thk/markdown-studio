# Markdown Studio

Markdown Studio là ứng dụng đọc, chỉnh sửa và tổ chức tài liệu Markdown trực tiếp trên trình duyệt. Ứng dụng chạy hoàn toàn ở phía client, lưu workspace bằng IndexedDB và không gửi nội dung tài liệu lên máy chủ.

## Mục tiêu

- Mở Markdown nhanh mà không cần VSCode hay extension preview.
- Quản lý nhiều tài liệu theo cây thư mục có thể thu gọn.
- Hiển thị code đa ngôn ngữ gần với IDE bằng Shiki.
- Render Mermaid/UML cục bộ, không chuyển source sơ đồ ra dịch vụ ngoài.
- Có thể chỉnh sửa, lưu tự động và tải file `.md` trở lại máy.
- Deploy như một static site trên GitHub Pages.

## Tính năng

### Tài liệu và thư mục

- Tạo tài liệu mới trong thư mục đang chọn.
- Import hoặc kéo thả nhiều file `.md`, `.markdown`, `.mdown`.
- Import nguyên cây thư mục bằng `showDirectoryPicker()` trên Chrome/Edge.
- File import được đưa vào thư mục đang chọn; đường dẫn tương đối có sẵn được giữ lại.
- Tạo thư mục nhiều cấp, chọn thư mục đích và chuyển tài liệu giữa các thư mục.
- Kéo thả file để đổi thứ tự hoặc chuyển folder; kéo folder để đổi thứ tự, đổi cấp hoặc đưa về root.
- Menu ba chấm trên từng folder gom thao tác đổi tên và chuyển vào thùng rác.
- Thu gọn từng thư mục hoặc toàn bộ thư mục gốc.
- Đổi tên file/thư mục, chuyển file hoặc cả cây thư mục vào thùng rác và chặn đường dẫn trùng.
- Tìm full-text theo tên, đường dẫn và nội dung bằng Web Worker; kết quả có xếp hạng và snippet theo mô hình RAG-lite cục bộ.
- Giới hạn 2 MB/file để tránh làm treo tab trình duyệt.
- Sidebar được virtualize, vẫn cuộn mượt khi workspace có hàng nghìn tài liệu.
- Backup/restore workspace bằng ZIP hoặc JSON có version và validation.
- ZIP chứa `workspace.json`, từng file Markdown và ảnh data-URL được nhúng trong tài liệu.

### Markdown và code

- CommonMark cùng bảng, strikethrough, autolink, task list và footnote.
- Editor toolbar hỗ trợ H1–H3, bold, italic, strikethrough, inline code, code block, link, quote, bullet list, ordered list, checklist và horizontal rule.
- Raw HTML bị vô hiệu hóa; HTML kết quả tiếp tục được sanitize bằng DOMPurify.
- Shiki chạy trong Web Worker và chỉ đóng gói nhóm grammar phổ biến: PHP, JavaScript/TypeScript, Python, Ruby, Java, C/C++, C#, Go, Rust, SQL, Bash, JSON, YAML, HTML, CSS/SCSS, Vue, JSX/TSX, Markdown, Docker và Diff.
- Code block có nhãn ngôn ngữ, theme sáng/tối theo từng token và nút sao chép.
- Ngôn ngữ không nhận diện được sẽ hiển thị như plain code thay vì làm hỏng preview.

### Mermaid và UML

Dùng fenced code block `mermaid` hoặc `uml`:

````markdown
```mermaid
flowchart LR
    A[Import Markdown] --> B[Parse]
    B --> C[Preview]
```
````

Các loại sơ đồ Mermaid được hỗ trợ gồm flowchart, sequence diagram, class diagram, state diagram, ER diagram, requirement diagram, architecture, timeline, mindmap, C4 và những diagram type có trong phiên bản Mermaid hiện tại.

Ví dụ UML class diagram:

````markdown
```uml
classDiagram
    class Article {
        +int id
        +string title
        +publish()
    }
    class Author
    Author "1" --> "*" Article
```
````

`uml` sử dụng cú pháp Mermaid. PlantUML server không được gọi vì ứng dụng ưu tiên chạy offline và không làm rò rỉ nội dung sơ đồ.

Mermaid syntax được parse/validate trong Web Worker. Bước layout và tạo SVG dùng Mermaid browser renderer khi cần, sau đó SVG được chuyển vào iframe `sandbox` riêng để cách ly DOM/style khỏi trang tài liệu.

### Trải nghiệm đọc

- TOC sinh từ `h1`–`h3`, xử lý heading tiếng Việt và heading trùng.
- Heading đang đọc được active bằng `IntersectionObserver`.
- TOC tự cuộn để giữ heading active trong vùng nhìn thấy.
- TOC có vùng cuộn riêng và progress cố định ở đáy, không tràn khỏi màn hình với tài liệu dài.
- Thanh tiến trình đọc nằm ngay dưới topbar.
- Nút trở về đầu trang.
- Scrollbar mỏng, dark/light mode và responsive trên desktop/mobile.
- Khi chuyển tài liệu, preview trở về đầu trang và tiến trình đặt lại `0%`.
- Chế độ đọc toàn trang ẩn toàn bộ sidebar, TOC và toolbar để tập trung vào nội dung; nhấn `Esc` để thoát.
- Sidebar và TOC có thể kéo thay đổi độ rộng; kích thước được ghi nhớ trên thiết bị.
- Command palette mở bằng `Ctrl/⌘ + K`; hỗ trợ tìm file và điều khiển hoàn toàn bằng `↑`, `↓`, `Enter`, `Esc`.
- Ảnh HTTP/HTTPS trong Markdown bị chặn mặc định để tránh request ngoài ý muốn; có thể bật theo phiên làm việc.

### Offline và phục hồi

- Web App Manifest và service worker cho phép cài đặt như PWA và mở lại sau khi tài nguyên đã được cache.
- Khi IndexedDB không khả dụng hoặc hết quota, app hiển thị recovery banner và nút backup ngay.
- Dashboard dung lượng dùng Storage Estimate API và cảnh báo khi workspace đạt từ 80% quota.
- Khi service worker cài xong phiên bản mới, app hiển thị banner **Cập nhật ngay** thay vì âm thầm reload.
- IndexedDB migration chạy tuần tự qua version 1–3, bảo toàn documents/meta và bổ sung trash/history.
- Mỗi tài liệu giữ tối đa 20 autosave snapshot để khôi phục nội dung bị ghi đè.

### Phím tắt

| Phím tắt | Tác dụng |
| --- | --- |
| `Ctrl/⌘ + S` | Tải tài liệu hiện tại về máy |
| `Ctrl/⌘ + O` | Mở hộp chọn file |
| `Ctrl/⌘ + Shift + P` | Chuyển giữa Editor và Preview |
| `Ctrl/⌘ + Shift + F` | Bật/tắt chế độ đọc toàn trang |
| `Ctrl/⌘ + K` | Mở/đóng command palette |

Trong command palette: `↑`/`↓` đổi lựa chọn, `Enter` thực thi và `Esc` đóng.

## Cách sử dụng

### Bắt đầu nhanh

1. Mở ứng dụng; `welcome.md` được tạo trong lần sử dụng đầu tiên.
2. Chọn **Mở file**, **Nhập thư mục** hoặc kéo file Markdown vào cửa sổ.
3. Chọn một thư mục trước khi import nếu muốn nhóm file ngay từ đầu.
4. Chọn **Editor** để chỉnh sửa và **Preview** để đọc kết quả.
5. Trên Chrome/Edge, nút **Save** ghi trực tiếp qua File System Access API. Trình duyệt không hỗ trợ sẽ fallback sang download.

### Thùng rác và lịch sử

1. Nút xóa chuyển tài liệu hoặc toàn bộ folder vào thùng rác, không xóa vĩnh viễn ngay.
2. Nhấn **Hoàn tác** trên thông báo hoặc mở **Thùng rác** trong sidebar để khôi phục.
3. Dùng nút folder trong thùng rác để khôi phục đồng loạt toàn bộ tài liệu con.
4. Chỉ nút xóa trong cửa sổ thùng rác mới xóa vĩnh viễn.
5. Nhấn biểu tượng lịch sử trên toolbar để xem tối đa 20 snapshot của file hiện tại.
6. Khi restore snapshot, nội dung hiện tại được lưu thành một snapshot khác trước khi thay thế.

### Tổ chức workspace

1. Chọn thư mục cha mong muốn; chọn thư mục gốc nếu muốn tạo ở cấp cao nhất.
2. Nhấn biểu tượng tạo folder và nhập tên. Tên có dấu `/` tạo cấu trúc nhiều cấp.
3. File mới và file import sẽ đi vào thư mục đang chọn.
4. Dùng select trên thanh tài liệu để chuyển file hiện tại sang folder khác.
5. Nhấn chevron để collapse/expand từng folder hoặc toàn bộ root.

## Luồng hoạt động

```text
Paste / Create / Import / Drop
            │
            ▼
    Validate type + size
            │
            ▼
 DocumentRecord + folder path
            │
       ┌────┴───────────┐
       ▼                ▼
   React state       IndexedDB
       │          documents + meta
       ▼
 markdown-it → DOMPurify
       │
       ├── Shiki grammar tải theo code fence
       ├── Mermaid render cục bộ
       ├── TOC + active heading
       └── Preview / download Blob
```

### Luồng render Markdown

1. Nội dung thay đổi được debounce trước khi render.
2. Các ngôn ngữ trong fenced code block được phát hiện.
3. Shiki chỉ tải grammar chưa có trong phiên hiện tại.
4. `markdown-it` parse Markdown và plugin xử lý task list/footnote.
5. Fence `mermaid`/`uml` được đánh dấu để render riêng.
6. DOMPurify sanitize HTML.
7. Code block được bổ sung toolbar và nút copy.
8. Heading `h1`–`h3` tạo TOC.
9. Mermaid thay source diagram bằng SVG an toàn với `securityLevel: strict`.

### Luồng autosave

1. Người dùng nhập trong editor.
2. React state cập nhật ngay để preview phản hồi nhanh.
3. Sau 450 ms không có thay đổi mới, document được ghi vào IndexedDB và nội dung trước đợt sửa được lưu vào history.
4. History được giới hạn 20 phiên bản/file để kiểm soát dung lượng.
5. Tài liệu vẫn chỉ tồn tại trong browser profile hiện tại cho đến khi người dùng Save/download/backup.

### Backup và restore workspace

1. Nhấn **Backup ZIP** để tải `markdown-studio-backup-YYYY-MM-DD.zip`.
2. ZIP chứa `workspace.json`, thư mục `documents/`, ảnh data-URL trong `assets/` và file hướng dẫn.
3. Nhấn **Restore**, chọn ZIP mới hoặc JSON từ phiên bản cũ và xác nhận thay thế workspace.
4. Restore kiểm tra version, cấu trúc document và đường dẫn trùng trước khi ghi transaction vào IndexedDB.

> [!WARNING]
> Restore thay thế toàn bộ workspace hiện tại. Hãy backup trước khi restore một file chưa được kiểm chứng.

## Lưu trữ dữ liệu

Database IndexedDB: `markdown-studio`.

| Store | Key | Dữ liệu |
| --- | --- | --- |
| `documents` | `DocumentRecord.id` | `id`, `name`, `path`, `content`, `updatedAt` |
| `meta` | `activeId` | ID tài liệu mở gần nhất |
| `meta` | `folders` | Danh sách đường dẫn thư mục |
| `trash` | `DocumentRecord.id` | Document đã xóa cùng `deletedAt` |
| `history` | Auto increment | Tối đa 20 snapshot cho mỗi document |

`theme` và danh sách folder đang collapse được lưu trong `localStorage`.

Lưu ý:

- Dữ liệu gắn với domain, browser và browser profile.
- Xóa site data hoặc IndexedDB sẽ xóa workspace cục bộ.
- Deploy sang domain khác không tự di chuyển dữ liệu cũ.
- Hãy download các file quan trọng về máy; IndexedDB không phải hệ thống backup.

## Cấu trúc project

```text
markdown-studio/
├── .github/workflows/deploy.yml   # Unit, E2E, lint, build và deploy GitHub Pages
├── public/favicon.svg
├── src/
│   ├── components/
│   │   ├── EditorToolbar.tsx      # Thanh công cụ soạn Markdown
│   │   └── FolderTree.tsx         # Cây kéo-thả, menu và virtualization
│   ├── lib/
│   │   ├── diagrams.ts            # Mermaid/UML renderer
│   │   ├── diagram-client.ts       # Giao tiếp Mermaid parser worker
│   │   ├── editor-format.ts        # Selection-aware Markdown formatting
│   │   ├── files.ts               # Validate và đọc file import
│   │   ├── highlight-client.ts     # Giao tiếp Shiki worker
│   │   ├── highlighter.ts          # Shiki grammar/highlight engine
│   │   ├── markdown.ts            # Markdown, Shiki, sanitize, TOC, code toolbar
│   │   ├── search-client.ts        # Giao tiếp full-text search worker
│   │   ├── search-engine.ts        # Index, ranking và snippet RAG-lite
│   │   ├── storage.ts             # IndexedDB repository
│   │   └── workspace.ts           # Backup/restore schema và validation
│   ├── test/setup.ts
│   ├── workers/
│   │   ├── diagram.worker.ts
│   │   ├── highlight.worker.ts
│   │   └── search.worker.ts
│   ├── App.tsx                    # Điều phối state và các user flow
│   ├── main.tsx
│   ├── styles.css
│   ├── types.ts
│   └── vendor.d.ts
├── index.html                     # SEO metadata và application entry
├── public/manifest.webmanifest    # Metadata cài đặt PWA
├── public/sw.js                   # Offline runtime cache
├── e2e/markdown-studio.spec.ts    # Playwright offline/restore/resize/Pages
├── playwright.config.ts
├── package.json
├── vite.config.ts
└── README.md
```

## Chạy local

Yêu cầu Node.js 24 (khớp với môi trường GitHub Actions).

```bash
npm install
npm run dev
```

Các script luôn chỉ định trực tiếp `vite.config.ts`. Cấu hình này đặt `worker.format: 'es'` để Mermaid/Shiki Worker có thể code-split. Nếu cập nhật project bằng cách giải nén đè lên một bản cũ, hãy xóa `vite.config.js` và `vite.config.d.ts` còn sót lại; gói phát hành mới không chứa hai file này.

## Kiểm tra chất lượng

```bash
npm run test
npm run test:e2e
npm run lint
npm run build
npm audit --omit=dev
```

Unit/integration test bao phủ import, IndexedDB migration, trash/history, backup ZIP, Markdown/XSS, Shiki, Mermaid, command palette và UI chính. Playwright kiểm tra offline PWA, restore, drag-resize và asset URL tương thích GitHub Pages.

Build dùng dynamic import để tách Markdown/Shiki và Mermaid khỏi entry bundle. Grammar Shiki tiếp tục được tải riêng theo ngôn ngữ xuất hiện trong từng tài liệu.

## Deploy GitHub Pages

1. Push project lên GitHub.
2. Push vào `main`; workflow cài Chromium, chạy unit/E2E test, lint, build rồi deploy thư mục `dist`.
3. Workflow dùng `enablement: true` để tự bật Pages và chọn GitHub Actions làm nguồn ở lần deploy đầu tiên.

Nếu bước **Configure GitHub Pages** vẫn báo `Not Found`, tài khoản chạy workflow không có quyền quản trị repository hoặc tổ chức đã chặn GitHub Pages. Khi đó, dùng tài khoản admin mở **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**, rồi chạy lại workflow. Không đặt `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION`; workflow đã dùng Node.js 24 và các action chạy trên runtime hiện hành.

Vite dùng `base: './'`, do đó app hoạt động ở cả custom domain và project page dạng `https://username.github.io/markdown-studio/`.

## Nguyên tắc bảo mật

- Raw HTML không được render.
- Kết quả parser được sanitize.
- Link ngoài dùng `noopener noreferrer`.
- Mermaid chạy với `securityLevel: strict`.
- Không có backend, analytics hoặc API upload tài liệu.
- Không gọi PlantUML server hay dịch vụ render diagram bên ngoài.
