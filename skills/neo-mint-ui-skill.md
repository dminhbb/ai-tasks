# Skill: Chuyển đổi giao diện Web App sang Neo Mint Enterprise UI

## Mục tiêu
Chuyển giao diện web app hiện tại sang phong cách **Neo Mint Enterprise**: minimalist, clean, dễ nhìn, phân lớp rõ ràng, card separation mạnh hơn, background ngoài card đậm hơn, sidebar/panel trái giảm độ đậm so với dark navy ban đầu nhưng vẫn đủ tương phản.

Phong cách mong muốn:
- Clean, hiện đại, enterprise/internal tool.
- Màu chủ đạo mint/teal nhưng không dùng quá nhiều.
- Background tổng thể đậm hơn card để card nổi rõ.
- Card có border rõ hơn, shadow nhẹ.
- Sidebar dịu hơn `#0F172A`, không quá đen.
- Assistant/slide panel có sắc độ riêng, không hòa vào main content.
- Text rõ, không dùng màu quá nhạt.

---

## Color Tokens - Light Mode

```css
:root {
  /* App structure */
  --app-bg: #DDE7EA;
  --main-bg: #E7EEF1;
  --surface: #FFFFFF;
  --surface-soft: #F8FAFC;
  --surface-muted: #EEF4F5;

  /* Sidebar / Panel */
  --sidebar-bg: #F4F8F9;
  --sidebar-border: #CBD5DA;
  --sidebar-text: #1E293B;
  --sidebar-text-muted: #64748B;
  --sidebar-hover: #E6F3F1;
  --sidebar-active-bg: #D6F3EF;
  --sidebar-active-text: #0F766E;

  /* Assistant / Slide panel */
  --panel-bg: #F1F6F7;
  --panel-border: #C7D2DA;
  --panel-card-bg: #FFFFFF;

  /* Card */
  --card-bg: #FFFFFF;
  --card-border: #BFCBD3;
  --card-border-soft: #CBD5DA;
  --card-shadow: 0 1px 2px rgba(15, 23, 42, 0.07), 0 8px 24px rgba(15, 23, 42, 0.06);

  /* Brand */
  --primary: #0F766E;
  --primary-hover: #115E59;
  --primary-soft: #D6F3EF;
  --primary-subtle: #ECFDF5;
  --accent: #14B8A6;

  /* State */
  --success: #16A34A;
  --success-bg: #DCFCE7;
  --warning: #D97706;
  --warning-bg: #FEF3C7;
  --danger: #DC2626;
  --danger-bg: #FEE2E2;
  --info: #2563EB;
  --info-bg: #DBEAFE;

  /* Text */
  --text-title: #0B1220;
  --text-body: #334155;
  --text-muted: #64748B;
  --text-subtle: #7C8A9A;
  --text-inverse: #F8FAFC;

  /* Form */
  --input-bg: #FFFFFF;
  --input-border: #BFCBD3;
  --input-focus: #0F766E;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}
```

---

## Color Tokens - Dark Mode

```css
[data-theme="dark"] {
  --app-bg: #0E1B24;
  --main-bg: #132430;
  --surface: #1A2C38;
  --surface-soft: #203544;
  --surface-muted: #263D4D;

  --sidebar-bg: #263F4E;
  --sidebar-border: #3D5868;
  --sidebar-text: #F8FAFC;
  --sidebar-text-muted: #C2CED6;
  --sidebar-hover: #315264;
  --sidebar-active-bg: #0F766E;
  --sidebar-active-text: #FFFFFF;

  --panel-bg: #102231;
  --panel-border: #2D4656;
  --panel-card-bg: #182E3C;

  --card-bg: #1B303D;
  --card-border: #3B5667;
  --card-border-soft: #314B5B;
  --card-shadow: 0 1px 2px rgba(0, 0, 0, 0.24), 0 10px 28px rgba(0, 0, 0, 0.18);

  --primary: #2DD4BF;
  --primary-hover: #5EEAD4;
  --primary-soft: #134E4A;
  --primary-subtle: #0F3F3B;
  --accent: #14B8A6;

  --success: #22C55E;
  --success-bg: #123D29;
  --warning: #F59E0B;
  --warning-bg: #4A3514;
  --danger: #F87171;
  --danger-bg: #4A1D23;
  --info: #60A5FA;
  --info-bg: #17375E;

  --text-title: #F8FAFC;
  --text-body: #D7E0E6;
  --text-muted: #AAB8C2;
  --text-subtle: #8FA1AD;
  --text-inverse: #0B1220;

  --input-bg: #152A38;
  --input-border: #3D5868;
  --input-focus: #2DD4BF;
}
```

---

## Layout Rules

### 1. App Shell
- Dùng `--app-bg` cho background ngoài cùng.
- Dùng `--main-bg` cho vùng nội dung chính.
- Card phải là `--card-bg`, không dùng cùng màu với main background.

```css
.app-shell {
  background: var(--app-bg);
  color: var(--text-body);
  min-height: 100vh;
}

.main-content {
  background: var(--main-bg);
  padding: 24px;
}
```

### 2. Sidebar trái
Sidebar không dùng navy quá đậm. Dùng nền sáng/xám xanh ở light mode và slate-blue vừa phải ở dark mode.

```css
.sidebar {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  color: var(--sidebar-text);
}

.sidebar-item {
  color: var(--sidebar-text);
  border-radius: var(--radius-md);
}

.sidebar-item:hover {
  background: var(--sidebar-hover);
}

.sidebar-item.active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
  font-weight: 600;
}
```

### 3. Card separation
Border cần rõ hơn UI minimalist thông thường.

```css
.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--card-shadow);
}
```

### 4. Assistant / Slide panel
Panel bên phải hoặc slide panel cần đậm/tách lớp hơn main content.

```css
.slide-panel,
.assistant-panel {
  background: var(--panel-bg);
  border-left: 1px solid var(--panel-border);
}

.assistant-panel .panel-card,
.slide-panel .panel-card {
  background: var(--panel-card-bg);
  border: 1px solid var(--card-border-soft);
  border-radius: var(--radius-md);
}
```

### 5. Typography
Không dùng text quá nhạt. Text chính nên rõ và có trọng lượng.

```css
h1, h2, h3, .title {
  color: var(--text-title);
  font-weight: 700;
}

body, p, .body-text {
  color: var(--text-body);
  font-weight: 500;
}

.muted-text {
  color: var(--text-muted);
}
```

---

## Button System

```css
.btn-primary {
  background: var(--primary);
  color: #FFFFFF;
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  font-weight: 600;
}

.btn-primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text-body);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
}

.btn-secondary:hover {
  background: var(--surface-muted);
}
```

---

## Table / Data Grid

```css
.table-wrapper {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table thead {
  background: var(--surface-soft);
  color: var(--text-title);
}

.table th {
  font-weight: 700;
}

.table td {
  color: var(--text-body);
  border-top: 1px solid var(--card-border-soft);
}

.table tr:hover {
  background: var(--primary-subtle);
}
```

---

## Form / Search / Input

```css
.input,
.search-input,
textarea,
select {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--text-body);
  border-radius: var(--radius-md);
}

.input:focus,
.search-input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--input-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
}
```

---

## Badge / Status

```css
.badge-success {
  background: var(--success-bg);
  color: var(--success);
}

.badge-warning {
  background: var(--warning-bg);
  color: var(--warning);
}

.badge-danger {
  background: var(--danger-bg);
  color: var(--danger);
}

.badge-info {
  background: var(--info-bg);
  color: var(--info);
}
```

---

## Tailwind Mapping Gợi Ý

Nếu app dùng Tailwind, thêm vào `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--app-bg)',
          main: 'var(--main-bg)',
          surface: 'var(--surface)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          border: 'var(--sidebar-border)',
          text: 'var(--sidebar-text)',
          hover: 'var(--sidebar-hover)',
          active: 'var(--sidebar-active-bg)',
        },
        panel: {
          bg: 'var(--panel-bg)',
          border: 'var(--panel-border)',
          card: 'var(--panel-card-bg)',
        },
        card: {
          bg: 'var(--card-bg)',
          border: 'var(--card-border)',
          soft: 'var(--card-border-soft)',
        },
        brand: {
          primary: 'var(--primary)',
          hover: 'var(--primary-hover)',
          soft: 'var(--primary-soft)',
          subtle: 'var(--primary-subtle)',
          accent: 'var(--accent)',
        },
        textx: {
          title: 'var(--text-title)',
          body: 'var(--text-body)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
        },
      },
      borderRadius: {
        uiSm: 'var(--radius-sm)',
        uiMd: 'var(--radius-md)',
        uiLg: 'var(--radius-lg)',
        uiXl: 'var(--radius-xl)',
      },
      boxShadow: {
        card: 'var(--card-shadow)',
      },
    },
  },
};
```

---

## Component Conversion Checklist

Khi dùng Codex trong VS Code, hãy yêu cầu chỉnh theo checklist này:

1. Tìm toàn bộ màu hard-code như `#fff`, `#f8fafc`, `gray-50`, `slate-900`, `text-gray-400`.
2. Thay bằng CSS variables/design tokens ở trên.
3. App/page wrapper dùng `--app-bg` hoặc `--main-bg`.
4. Card dùng `--card-bg`, `--card-border`, `--card-shadow`.
5. Sidebar dùng `--sidebar-bg`, `--sidebar-border`, `--sidebar-text`.
6. Active menu dùng mint rõ: `--sidebar-active-bg`, `--sidebar-active-text`.
7. Slide/assistant panel dùng `--panel-bg`, `--panel-border`.
8. Text title/body/muted phải theo token, tránh text quá nhạt.
9. Button primary dùng `--primary`, hover dùng `--primary-hover`.
10. Bảng/table phải có header rõ và border row rõ hơn.
11. Form/search input có border rõ và focus ring màu mint.
12. Giữ spacing thoáng: page padding `24px`, card gap `16px` hoặc `20px`.

---

## Prompt sử dụng với Codex trong VS Code

Dán prompt này vào Codex:

```text
Hãy refactor giao diện web app hiện tại sang design system Neo Mint Enterprise theo file skill này.

Yêu cầu chính:
- Giữ layout và logic hiện có, chỉ thay đổi giao diện.
- Thêm CSS variables cho light/dark mode nếu chưa có.
- Background ngoài card đậm hơn để card nổi rõ.
- Card dùng border rõ hơn và shadow nhẹ.
- Sidebar/panel bên trái giảm độ đậm, không dùng navy quá đen.
- Slide panel/assistant panel phải có background và border tách lớp rõ.
- Dùng mint/teal làm màu primary, không lạm dụng accent.
- Tăng contrast text, tránh text quá nhạt.
- Không phá vỡ responsive layout.
- Nếu app dùng Tailwind, map token vào tailwind.config.js hoặc dùng class arbitrary với CSS variables.
- Nếu app dùng CSS/SCSS thường, tạo file theme.css hoặc design-tokens.css và import vào entry point.

Sau khi sửa, hãy liệt kê các file đã thay đổi và giải thích ngắn gọn từng thay đổi.
```

---

## Prompt kiểm tra sau khi Codex sửa

```text
Hãy review lại giao diện sau khi áp dụng Neo Mint Enterprise.
Kiểm tra các điểm sau:
1. Card có đủ tách biệt khỏi background không?
2. Sidebar có bị quá đậm hoặc quá nhạt không?
3. Slide panel/assistant panel có tách lớp rõ không?
4. Text body và muted text có đủ dễ đọc không?
5. Button primary/active menu có nhất quán màu mint không?
6. Light mode và dark mode có dùng cùng hệ token không?
7. Có màu hard-code nào còn sót lại không?
8. Có component nào vẫn dùng gray quá nhạt gây khó nhìn không?

Nếu có vấn đề, hãy sửa trực tiếp.
```

---

## Nguyên tắc quan trọng

- Minimalist không có nghĩa là màu nhạt toàn bộ.
- Card phải nổi trên nền bằng cả border, shadow và chênh lệch background.
- Mint chỉ nên dùng cho điểm nhấn, active state, primary action, progress/chart highlight.
- Text chính phải đậm và rõ.
- Sidebar/panel nên có màu riêng để tạo cấu trúc app rõ ràng.
