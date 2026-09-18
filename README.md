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
- File import được đưa vào thư mục đang chọn; đường dẫn tương đối có sẵn được giữ lại.
- Tạo thư mục nhiều cấp, chọn thư mục đích và chuyển tài liệu giữa các thư mục.
- Thu gọn từng thư mục hoặc toàn bộ thư mục gốc.
- Tìm theo tên file hoặc đường dẫn.
- Giới hạn 2 MB/file để tránh làm treo tab trình duyệt.

### Markdown và code

- CommonMark cùng bảng, strikethrough, autolink, task list và footnote.
- Raw HTML bị vô hiệu hóa; HTML kết quả tiếp tục được sanitize bằng DOMPurify.
- Shiki tải grammar theo nhu cầu và hỗ trợ các ngôn ngữ đi kèm Shiki như PHP, Blade, JavaScript, TypeScript, Python, Java, Go, Rust, SQL, Bash, JSON, YAML, HTML, CSS, Vue, JSX/TSX và nhiều ngôn ngữ khác.
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

### Trải nghiệm đọc

- TOC sinh từ `h1`–`h3`, xử lý heading tiếng Việt và heading trùng.
- Heading đang đọc được active bằng `IntersectionObserver`.
- TOC tự cuộn để giữ heading active trong vùng nhìn thấy.
- Thanh tiến trình đọc nằm ngay dưới topbar.
- Nút trở về đầu trang.
- Scrollbar mỏng, dark/light mode và responsive trên desktop/mobile.
- Khi chuyển tài liệu, preview trở về đầu trang và tiến trình đặt lại `0%`.

### Phím tắt

| Phím tắt | Tác dụng |
| --- | --- |
| `Ctrl/⌘ + S` | Tải tài liệu hiện tại về máy |
| `Ctrl/⌘ + O` | Mở hộp chọn file |
| `Ctrl/⌘ + Shift + P` | Chuyển giữa Editor và Preview |

## Cách sử dụng

### Bắt đầu nhanh

1. Mở ứng dụng; `welcome.md` được tạo trong lần sử dụng đầu tiên.
2. Chọn **Nhập file** hoặc kéo file Markdown vào cửa sổ.
3. Chọn một thư mục trước khi import nếu muốn nhóm file ngay từ đầu.
4. Chọn **Editor** để chỉnh sửa và **Preview** để đọc kết quả.
5. Dùng nút download hoặc `Ctrl/⌘ + S` để lưu file đã chỉnh sửa về máy.

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
3. Sau 450 ms không có thay đổi mới, document được ghi vào IndexedDB.
4. Tài liệu vẫn chỉ tồn tại trong browser profile hiện tại cho đến khi người dùng tải file về máy.

## Lưu trữ dữ liệu

Database IndexedDB: `markdown-studio`.

| Store | Key | Dữ liệu |
| --- | --- | --- |
| `documents` | `DocumentRecord.id` | `id`, `name`, `path`, `content`, `updatedAt` |
| `meta` | `activeId` | ID tài liệu mở gần nhất |
| `meta` | `folders` | Danh sách đường dẫn thư mục |

`theme` và danh sách folder đang collapse được lưu trong `localStorage`.

Lưu ý:

- Dữ liệu gắn với domain, browser và browser profile.
- Xóa site data hoặc IndexedDB sẽ xóa workspace cục bộ.
- Deploy sang domain khác không tự di chuyển dữ liệu cũ.
- Hãy download các file quan trọng về máy; IndexedDB không phải hệ thống backup.

## Cấu trúc project

```text
markdown-studio/
├── .github/workflows/deploy.yml   # Test, lint, build và deploy GitHub Pages
├── public/favicon.svg
├── src/
│   ├── components/
│   │   └── FolderTree.tsx         # Cây folder/file và collapse
│   ├── lib/
│   │   ├── diagrams.ts            # Mermaid/UML renderer
│   │   ├── files.ts               # Validate và đọc file import
│   │   ├── markdown.ts            # Markdown, Shiki, sanitize, TOC, code toolbar
│   │   └── storage.ts             # IndexedDB repository
│   ├── test/setup.ts
│   ├── App.tsx                    # Điều phối state và các user flow
│   ├── main.tsx
│   ├── styles.css
│   ├── types.ts
│   └── vendor.d.ts
├── index.html                     # SEO metadata và application entry
├── package.json
├── vite.config.ts
└── README.md
```

## Chạy local

Yêu cầu Node.js 20.19+ hoặc 22.12+.

```bash
npm install
npm run dev
```

## Kiểm tra chất lượng

```bash
npm run test
npm run lint
npm run build
npm audit --omit=dev
```

Test bao phủ import file, giới hạn dung lượng, folder path, IndexedDB, Markdown mở rộng, XSS, link ngoài, Shiki đa ngôn ngữ, Mermaid fence, code copy, phím tắt, tạo/collapse folder và download Markdown.

## Deploy GitHub Pages

1. Push project lên GitHub.
2. Mở **Settings → Pages → Source** và chọn **GitHub Actions**.
3. Push vào `main`; workflow sẽ chạy test, lint, build rồi deploy thư mục `dist`.

Vite dùng `base: './'`, do đó app hoạt động ở cả custom domain và project page dạng `https://username.github.io/markdown-studio/`.

## Nguyên tắc bảo mật

- Raw HTML không được render.
- Kết quả parser được sanitize.
- Link ngoài dùng `noopener noreferrer`.
- Mermaid chạy với `securityLevel: strict`.
- Không có backend, analytics hoặc API upload tài liệu.
- Không gọi PlantUML server hay dịch vụ render diagram bên ngoài.
