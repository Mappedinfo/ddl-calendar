# DDL Calendar (YAML Config, GitHub Pages)

纯前端 DDL 日历网站：从 `public/deadlines.yaml` 读取数据，渲染日历 + 列表，并支持搜索/筛选。

## 开发

```bash
cd ddl-calendar
npm i
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## YAML 格式

文件：`ddl-calendar/public/deadlines.yaml`

- `site.timezone`: 默认时区（IANA，比如 `UTC` / `America/Los_Angeles`）
- `items[].deadline`: `YYYY-MM-DD HH:mm`（本地时间，搭配 `items[].timezone` 解释）
- `items[].timezone`: IANA 时区；额外支持 `AoE`（等价于 `Etc/GMT+12`）
- `items[].start/end`: 会期（可选），用于详情展示

## GitHub Pages

仓库根目录已提供 Actions 工作流：`.github/workflows/pages.yml`。

默认会以仓库名作为 base path（`/<repo>/`）构建并发布。

