# Gitea Custom Theme - XART

Gitea 1.25.4 自定义主题配置，适用于群晖 NAS 部署。

## 包含主题

| 主题 | 类型 | 来源 |
|------|------|------|
| snowykami | 默认主题 | [Liteyuki Studio](https://liteyuki.icu) |
| liteyuki-magipoke | 暗色/亮色混合 | Liteyuki Studio |
| github-auto/light/dark/soft-dark | GitHub 风格 | [lutinglt/gitea-github-theme](https://github.com/lutinglt/gitea-github-theme) v1.25.4 |
| catppuccin-* | 多色系 | [catppuccin/gitea](https://github.com/catppuccin/gitea) |

## 花活 (custom/footer.tmpl)

- macOS 风格代码块标签 (liteyuki-magipoke 主题下)
- 代码截图按钮 (html2canvas)
- Live2D 看板娘
- 雪花特效
- 自定义背景图片 (localStorage)
- Liteyuki footer 脚本

## 安装

1. 将 `templates/` 和 `public/` 复制到 Gitea 的 `custom/` 目录:

```bash
# 群晖套件安装路径示例
cp -r templates/ /var/packages/gitea/var/custom/templates/
cp -r public/ /var/packages/gitea/var/custom/public/
```

2. 修改 `app.ini` 的 `[ui]` 部分:

```ini
[ui]
THEMES = gitea-auto,gitea-light,gitea-dark,snowykami,liteyuki-magipoke,github-auto,github-light,github-dark,github-soft-dark
DEFAULT_THEME = snowykami
```

3. 重启 Gitea

## 注意事项

- **不要覆盖 base 模板** (`base/head.tmpl`, `base/footer.tmpl` 等)，会导致 JS 冲突
- 使用 `custom/header.tmpl`, `custom/footer.tmpl` 等注入点添加自定义内容
- 确保所有模板文件权限为 644，Gitea 运行用户可读
- 兼容 Gitea 1.25.x，其他版本未测试

## 目录结构

```
custom/
├── templates/
│   └── custom/
│       ├── header.tmpl      # CSS 注入 (雪花样式等)
│       ├── footer.tmpl      # JS 注入 (花活功能)
│       └── body_outer_pre.tmpl  # 雪花容器 DOM
└── public/
    └── assets/
        ├── css/
        │   ├── theme-snowykami.css
        │   ├── theme-liteyuki-magipoke*.css
        │   ├── theme-github-*.css
        │   └── catppuccin-gitea/
        └── img/
            └── bg/           # 背景图片
```
