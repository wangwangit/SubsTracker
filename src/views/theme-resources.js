const themeResources = `
<style>
  /* === 全局暗黑模式核心变量与覆盖 === */
  :root {
    --dark-bg-primary: #111827;   /* 深灰/黑背景 */
    --dark-bg-secondary: #1f2937; /* 卡片/容器背景 */
    --dark-border: #374151;       /* 边框颜色 */
    --dark-text-main: #f9fafb;    /* 主要文字 */
    --dark-text-muted: #9ca3af;   /* 次要文字 */
  }
  html.dark body { background-color: var(--dark-bg-primary); color: var(--dark-text-muted); }
  html.dark .bg-white { background-color: var(--dark-bg-secondary) !important; color: var(--dark-text-main); }
  html.dark .bg-gray-50 { background-color: var(--dark-bg-primary) !important; }
  html.dark .bg-gray-100 { background-color: var(--dark-border) !important; }
  html.dark .shadow-md, html.dark .shadow-lg, html.dark .shadow-xl { 
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3); 
  }
  html.dark .text-gray-900, html.dark .text-gray-800 { color: var(--dark-text-main) !important; }
  html.dark .text-gray-700 { color: #d1d5db !important; }
  html.dark .text-gray-600, html.dark .text-gray-500 { color: var(--dark-text-muted) !important; }
  html.dark .text-indigo-600 { color: #818cf8 !important; }
  html.dark .border-gray-200, html.dark .border-gray-300 { border-color: var(--dark-border) !important; }
  html.dark .divide-y > :not([hidden]) ~ :not([hidden]) { border-color: var(--dark-border) !important; }
  html.dark .divide-gray-200 > :not([hidden]) ~ :not([hidden]) { border-color: var(--dark-border) !important; }
  html.dark input, html.dark select, html.dark textarea {
    background-color: #374151 !important;
    border-color: #4b5563 !important;
    color: white !important;
  }
  html.dark input::placeholder, html.dark textarea::placeholder { color: #9ca3af; }
  html.dark input:focus, html.dark select:focus, html.dark textarea:focus {
    border-color: #818cf8 !important;
    background-color: #4b5563 !important;
  }
  html.dark nav { background-color: var(--dark-bg-secondary) !important; border-bottom: 1px solid var(--dark-border); }
  html.dark thead {
    background-color: #111827 !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  html.dark thead th {
    color: #f9fafb !important;
    background-color: #111827 !important;
    border-bottom: 1px solid #4b5563 !important;
    letter-spacing: 0.08em;
  }
  html.dark tbody tr:hover { background-color: #374151 !important; }
  html.dark tbody tr.bg-gray-100 { background-color: #374151 !important; }
  /* 弹窗与日期选择器 */
  html.dark .custom-date-picker { background-color: var(--dark-bg-secondary); border-color: var(--dark-border); }
  html.dark .custom-date-picker .calendar-day { color: #e5e7eb; }
  html.dark .custom-date-picker .calendar-day:hover { background-color: #374151; }
  html.dark .custom-date-picker .calendar-day.other-month { color: #4b5563; }
  html.dark .month-option, html.dark .year-option { color: #e5e7eb; }
  html.dark .month-option:hover, html.dark .year-option:hover { background-color: #374151 !important; }
  html.dark .custom-dropdown-list { background-color: var(--dark-bg-secondary); border-color: var(--dark-border); }
  html.dark .dropdown-item { color: #d1d5db; border-bottom-color: var(--dark-border); }
  html.dark .dropdown-item:hover { background-color: #374151; color: #818cf8; }
  html.dark #mobile-menu { background-color: var(--dark-bg-secondary); border-color: var(--dark-border); }
  html.dark #mobile-menu a { color: #e5e7eb; }
  html.dark #mobile-menu a:hover { background-color: #374151; }
  html.dark #mobile-menu-btn { color: #e5e7eb; }
  html.dark #mobile-menu-btn:hover { background-color: #374151; }
  html.dark .loading-skeleton { background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%); }
  
  @media (max-width: 767px) {   /* === 移动端表格样式(高对比度版) === */
    html.dark .responsive-table td:before {  /* 强制提亮移动端表格的 Label */
      color: #e5e7eb !important;    /* 改为极亮的浅灰色 (接近纯白) */
      font-weight: 700 !important;  /* 加粗字体 */
      opacity: 1 !important;
      text-transform: uppercase;    /* 可选：增加大写使其更突出 */
      letter-spacing: 0.05em;
    }
    html.dark .responsive-table tr {
      border-color: #374151 !important;
      background-color: #1f2937 !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important; /* 阴影稍微加深 */
    }
    
    html.dark .responsive-table td {
      border-bottom-color: #374151 !important;
    }
    
    html.dark .td-content-wrapper {
        color: #f3f4f6;
    }
  }
</style>
<script>
  (function() {
    function applyTheme(mode) {
      const html = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (mode === 'dark' || (mode === 'system' && isSystemDark)) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }

    const savedTheme = localStorage.getItem('themeMode') || 'system';
    applyTheme(savedTheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const currentMode = localStorage.getItem('themeMode') || 'system';
      if (currentMode === 'system') {
        applyTheme('system');
      }
    });

    window.addEventListener('load', async () => {
      if (window.location.pathname.startsWith('/admin')) {
        try {
          const res = await fetch('/api/config');
          const config = await res.json();
          if (config.THEME_MODE && config.THEME_MODE !== localStorage.getItem('themeMode')) {
            localStorage.setItem('themeMode', config.THEME_MODE);
            applyTheme(config.THEME_MODE);
            const select = document.getElementById('themeModeSelect');
            if (select) select.value = config.THEME_MODE;
          }
        } catch(e) {}
      }
    });
    
    window.updateAppTheme = function(mode) {
      localStorage.setItem('themeMode', mode);
      applyTheme(mode);
    };
  })();
</script>
`

export { themeResources };
