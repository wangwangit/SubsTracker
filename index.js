// 訂閱續期通知網站 - 基於CloudFlare Workers (完全優化版)

// 時區工具函數
function formatTaipeiTime(date = new Date(), format = 'full') {
  if (format === 'date') {
    return date.toLocaleDateString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } else if (format === 'datetime') {
    return date.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } else {
    // full format
    return date.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei'
    });
  }
}

// 農曆轉換工具函數
const lunarCalendar = {
  // 農曆數據 (1900-2100年)
  lunarInfo: [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0
  ],

  // 天干地支
  gan: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
  zhi: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],

  // 農曆月份
  months: ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'],

  // 農曆日期
  days: ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
         '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
         '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'],

  // 獲取農曆年天數
  lunarYearDays: function(year) {
    let sum = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) {
      sum += (this.lunarInfo[year - 1900] & i) ? 1 : 0;
    }
    return sum + this.leapDays(year);
  },

  // 獲取閏月天數
  leapDays: function(year) {
    if (this.leapMonth(year)) {
      return (this.lunarInfo[year - 1900] & 0x10000) ? 30 : 29;
    }
    return 0;
  },

  // 獲取閏月月份
  leapMonth: function(year) {
    return this.lunarInfo[year - 1900] & 0xf;
  },

  // 獲取農曆月天數
  monthDays: function(year, month) {
    return (this.lunarInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29;
  },

  // 公曆轉農曆
  solar2lunar: function(year, month, day) {
    if (year < 1900 || year > 2100) return null;

    const baseDate = new Date(1900, 0, 31);
    const objDate = new Date(year, month - 1, day);
    let offset = Math.floor((objDate - baseDate) / 86400000);

    let temp = 0;
    let lunarYear = 1900;

    for (lunarYear = 1900; lunarYear < 2101 && offset > 0; lunarYear++) {
      temp = this.lunarYearDays(lunarYear);
      offset -= temp;
    }

    if (offset < 0) {
      offset += temp;
      lunarYear--;
    }

    let lunarMonth = 1;
    let leap = this.leapMonth(lunarYear);
    let isLeap = false;

    for (lunarMonth = 1; lunarMonth < 13 && offset > 0; lunarMonth++) {
      if (leap > 0 && lunarMonth === (leap + 1) && !isLeap) {
        --lunarMonth;
        isLeap = true;
        temp = this.leapDays(lunarYear);
      } else {
        temp = this.monthDays(lunarYear, lunarMonth);
      }

      if (isLeap && lunarMonth === (leap + 1)) isLeap = false;
      offset -= temp;
    }

    if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
      if (isLeap) {
        isLeap = false;
      } else {
        isLeap = true;
        --lunarMonth;
      }
    }

    if (offset < 0) {
      offset += temp;
      --lunarMonth;
    }

    const lunarDay = offset + 1;

    // 產生農曆字串
    const ganIndex = (lunarYear - 4) % 10;
    const zhiIndex = (lunarYear - 4) % 12;
    const yearStr = this.gan[ganIndex] + this.zhi[zhiIndex] + '年';
    const monthStr = (isLeap ? '閏' : '') + this.months[lunarMonth - 1] + '月';
    const dayStr = this.days[lunarDay - 1];

    return {
      year: lunarYear,
      month: lunarMonth,
      day: lunarDay,
      isLeap: isLeap,
      yearStr: yearStr,
      monthStr: monthStr,
      dayStr: dayStr,
      fullStr: yearStr + monthStr + dayStr
    };
  }
};

// 定義HTML範本
const loginPage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>訂閱管理系統</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
  <style>
    .login-container {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .login-box {
      backdrop-filter: blur(8px);
      background-color: rgba(255, 255, 255, 0.9);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      transition: all 0.3s;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    .input-field {
      transition: all 0.3s;
      border: 1px solid #e2e8f0;
    }
    .input-field:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.25);
    }
  </style>
</head>
<body class="login-container flex items-center justify-center">
  <div class="login-box p-8 rounded-xl w-full max-w-md">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold text-gray-800"><i class="fas fa-calendar-check mr-2"></i>訂閱管理系統</h1>
      <p class="text-gray-600 mt-2">登入管理您的訂閱提醒</p>
    </div>
    
    <form id="loginForm" class="space-y-6">
      <div>
        <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
          <i class="fas fa-user mr-2"></i>使用者名稱
        </label>
        <input type="text" id="username" name="username" required
          class="input-field w-full px-4 py-3 rounded-lg text-gray-700 focus:outline-none">
      </div>
      
      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
          <i class="fas fa-lock mr-2"></i>密碼
        </label>
        <input type="password" id="password" name="password" required
          class="input-field w-full px-4 py-3 rounded-lg text-gray-700 focus:outline-none">
      </div>
      
      <button type="submit" 
        class="btn-primary w-full py-3 rounded-lg text-white font-medium focus:outline-none">
        <i class="fas fa-sign-in-alt mr-2"></i>登入
      </button>
      
      <div id="errorMsg" class="text-red-500 text-center"></div>
    </form>
  </div>
  
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      const button = e.target.querySelector('button');
      const originalContent = button.innerHTML;
      button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>登入中...';
      button.disabled = true;
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
          window.location.href = '/admin';
        } else {
          document.getElementById('errorMsg').textContent = result.message || '使用者名稱或密碼錯誤';
          button.innerHTML = originalContent;
          button.disabled = false;
        }
      } catch (error) {
        document.getElementById('errorMsg').textContent = '發生錯誤，請稍後再試';
        button.innerHTML = originalContent;
        button.disabled = false;
      }
    });
  </script>
</body>
</html>
`;

const adminPage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>訂閱管理系統</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
  <style>
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); transition: all 0.3s; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .btn-danger { background: linear-gradient(135deg, #f87171 0%, #dc2626 100%); transition: all 0.3s; }
    .btn-danger:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .btn-success { background: linear-gradient(135deg, #34d399 0%, #059669 100%); transition: all 0.3s; }
    .btn-success:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .btn-warning { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); transition: all 0.3s; }
    .btn-warning:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .btn-info { background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); transition: all 0.3s; }
    .btn-info:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .table-container { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .modal-container { backdrop-filter: blur(8px); }
    .readonly-input { background-color: #f8fafc; border-color: #e2e8f0; cursor: not-allowed; }
    .error-message { font-size: 0.875rem; margin-top: 0.25rem; display: none; }
    .error-message.show { display: block; }

    /* 通用懸浮提示優化 */
    .hover-container {
      position: relative;
      width: 100%;
    }
    .hover-text {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.3s ease;
      display: block;
    }
    .hover-text:hover { color: #3b82f6; }
    .hover-tooltip {
      position: fixed;
      z-index: 9999;
      background: #1f2937;
      color: white;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.875rem;
      max-width: 320px;
      word-wrap: break-word;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      transform: translateY(-10px);
      white-space: normal;
      pointer-events: none;
      line-height: 1.4;
    }
    .hover-tooltip.show {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .hover-tooltip::before {
      content: '';
      position: absolute;
      top: -6px;
      left: 20px;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 6px solid #1f2937;
    }
    .hover-tooltip.tooltip-above::before {
      top: auto;
      bottom: -6px;
      border-bottom: none;
      border-top: 6px solid #1f2937;
    }

    /* 備註顯示優化 */
    .notes-container {
      position: relative;
      max-width: 200px;
      width: 100%;
    }
    .notes-text {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.3s ease;
      display: block;
    }
    .notes-text:hover { color: #3b82f6; }
    .notes-tooltip {
      position: fixed;
      z-index: 9999;
      background: #1f2937;
      color: white;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.875rem;
      max-width: 320px;
      word-wrap: break-word;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      transform: translateY(-10px);
      white-space: normal;
      pointer-events: none;
      line-height: 1.4;
    }
    .notes-tooltip.show {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .notes-tooltip::before {
      content: '';
      position: absolute;
      top: -6px;
      left: 20px;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 6px solid #1f2937;
    }
    .notes-tooltip.tooltip-above::before {
      top: auto;
      bottom: -6px;
      border-bottom: none;
      border-top: 6px solid #1f2937;
    }

    /* 農曆顯示樣式 */
    .lunar-display {
      font-size: 0.75rem;
      color: #6366f1;
      margin-top: 2px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .lunar-display.show {
      opacity: 1;
    }
    .lunar-toggle {
      display: inline-flex;
      align-items: center;
      margin-bottom: 8px;
      font-size: 0.875rem;
    }
    .lunar-toggle input[type="checkbox"] {
      margin-right: 6px;
    }

    /* 表格佈局優化 */
    .table-container {
      width: 100%;
      overflow: visible;
    }

    .table-container table {
      table-layout: fixed;
      width: 100%;
    }

    /* 防止表格內容溢出 */
    .table-container td {
      overflow: hidden;
      word-wrap: break-word;
    }

    .truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* 響應式優化 */
    .responsive-table { table-layout: fixed; width: 100%; }
    .td-content-wrapper { word-wrap: break-word; white-space: normal; text-align: left; width: 100%; }
    .td-content-wrapper > * { text-align: left; } /* Align content left within the wrapper */

    @media (max-width: 767px) {
      .table-container { overflow-x: initial; } /* Override previous setting */
      .responsive-table thead { display: none; }
      .responsive-table tbody, .responsive-table tr, .responsive-table td { display: block; width: 100%; }
      .responsive-table tr { margin-bottom: 1.5rem; border: 1px solid #ddd; border-radius: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow: hidden; }
      .responsive-table td { display: flex; justify-content: flex-start; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
      .responsive-table td:last-of-type { border-bottom: none; }
      .responsive-table td:before { content: attr(data-label); font-weight: 600; text-align: left; padding-right: 1rem; color: #374151; white-space: nowrap; }
      .action-buttons-wrapper { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; }
      
      .notes-container, .hover-container {
        max-width: 180px; /* Adjust for new layout */
        text-align: right;
      }
      .td-content-wrapper .notes-text {
        text-align: right;
      }
    }

    @media (min-width: 768px) {
      .table-container {
        overflow: visible;
      }
      /* .td-content-wrapper is aligned left by default */
    }

    /* Toast 樣式 */
    .toast {
      position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px;
      color: white; font-weight: 500; z-index: 1000; transform: translateX(400px);
      transition: all 0.3s ease-in-out; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .toast.show { transform: translateX(0); }
    .toast.success { background-color: #10b981; }
    .toast.error { background-color: #ef4444; }
    .toast.info { background-color: #3b82f6; }
    .toast.warning { background-color: #f59e0b; }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div id="toast-container"></div>

  <nav class="bg-white shadow-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <i class="fas fa-calendar-check text-indigo-600 text-2xl mr-2"></i>
          <span class="font-bold text-xl text-gray-800">訂閱管理系統</span>
        </div>
        <div class="flex items-center space-x-4">
          <a href="/admin" class="text-indigo-600 border-b-2 border-indigo-600 px-3 py-2 rounded-md text-sm font-medium">
            <i class="fas fa-list mr-1"></i>訂閱列表
          </a>
          <a href="/admin/config" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
            <i class="fas fa-cog mr-1"></i>系統設定
          </a>
          <a href="/api/logout" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
            <i class="fas fa-sign-out-alt mr-1"></i>登出
          </a>
        </div>
      </div>
    </div>
  </nav>
  
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-800">訂閱列表</h2>
      <div class="flex items-center space-x-4">
        <label class="lunar-toggle">
          <input type="checkbox" id="listShowLunar" class="form-checkbox h-4 w-4 text-indigo-600">
          <span class="text-gray-700">顯示農曆</span>
        </label>
        <button id="addSubscriptionBtn" class="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium flex items-center">
          <i class="fas fa-plus mr-2"></i>新增訂閱
        </button>
      </div>
    </div>
    
    <div class="table-container bg-white rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200 responsive-table">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style="width: 25%;">
                名稱
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style="width: 15%;">
                類型
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style="width: 20%;">
                到期時間 <i class="fas fa-sort-up ml-1 text-indigo-500" title="按到期時間升序排列"></i>
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style="width: 15%;">
                提醒設定
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style="width: 10%;">
                狀態
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style="width: 15%;">
                操作
              </th>
            </tr>
          </thead>
        <tbody id="subscriptionsBody" class="bg-white divide-y divide-gray-200">
        </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 新增/編輯訂閱的模態框 -->
  <div id="subscriptionModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 modal-container hidden flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
      <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
        <div class="flex items-center justify-between">
          <h3 id="modalTitle" class="text-lg font-medium text-gray-900">新增訂閱</h3>
          <button id="closeModal" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>
      
      <form id="subscriptionForm" class="p-6 space-y-6">
        <input type="hidden" id="subscriptionId">
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">訂閱名稱 *</label>
            <input type="text" id="name" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <div class="error-message text-red-500"></div>
          </div>
          
          <div>
            <label for="customType" class="block text-sm font-medium text-gray-700 mb-1">訂閱類型</label>
            <input type="text" id="customType" placeholder="例如：串流媒體、雲端服務、軟體等"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <div class="error-message text-red-500"></div>
          </div>
        </div>
        
        <div class="mb-4">
          <label class="lunar-toggle">
            <input type="checkbox" id="showLunar" class="form-checkbox h-4 w-4 text-indigo-600">
            <span class="text-gray-700">顯示農曆日期</span>
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input type="date" id="startDate"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <div id="startDateLunar" class="lunar-display"></div>
            <div class="error-message text-red-500"></div>
          </div>
          
          <div>
            <label for="periodValue" class="block text-sm font-medium text-gray-700 mb-1">週期數值 *</label>
            <input type="number" id="periodValue" min="1" value="1" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <div class="error-message text-red-500"></div>
          </div>
          
          <div>
            <label for="periodUnit" class="block text-sm font-medium text-gray-700 mb-1">週期單位 *</label>
            <select id="periodUnit" required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
              <option value="day">天</option>
              <option value="month" selected>月</option>
              <option value="year">年</option>
            </select>
            <div class="error-message text-red-500"></div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="expiryDate" class="block text-sm font-medium text-gray-700 mb-1">到期日期 *</label>
            <input type="date" id="expiryDate" required
              class="readonly-input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none">
            <div id="expiryDateLunar" class="lunar-display"></div>
            <div class="error-message text-red-500"></div>
          </div>
          
          <div class="flex items-end">
            <button type="button" id="calculateExpiryBtn" 
              class="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium h-10">
              <i class="fas fa-calculator mr-2"></i>自動計算到期日期
            </button>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="reminderDays" class="block text-sm font-medium text-gray-700 mb-1">提前提醒天數</label>
            <input type="number" id="reminderDays" min="0" value="7"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <p class="text-xs text-gray-500 mt-1">0 = 僅到期日當天提醒，1+ = 提前N天開始提醒</p>
            <div class="error-message text-red-500"></div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-3">選項設定</label>
            <div class="space-y-2">
              <label class="inline-flex items-center">
                <input type="checkbox" id="isActive" checked 
                  class="form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                <span class="ml-2 text-sm text-gray-700">啟用訂閱</span>
              </label>
              <label class="inline-flex items-center">
                <input type="checkbox" id="autoRenew" checked 
                  class="form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                <span class="ml-2 text-sm text-gray-700">自動續訂</span>
              </label>
            </div>
          </div>
        </div>
        
        <div>
          <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">備註</label>
          <textarea id="notes" rows="3" placeholder="可新增相關備註資訊..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"></textarea>
          <div class="error-message text-red-500"></div>
        </div>
        
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button type="button" id="cancelBtn" 
            class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button type="submit" 
            class="btn-primary text-white px-4 py-2 rounded-md text-sm font-medium">
            <i class="fas fa-save mr-2"></i>儲存
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // 時區工具函數 - 前端版本
    function formatTaipeiTime(date = new Date(), format = 'full') {
      if (format === 'date') {
        return date.toLocaleDateString('zh-TW', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      } else if (format === 'datetime') {
        return date.toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } else {
        // full format
        return date.toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei'
        });
      }
    }

    // 農曆轉換工具函數 - 前端版本
    const lunarCalendar = {
      // 農曆數據 (1900-2100年)
      lunarInfo: [
        0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
        0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
        0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
        0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
        0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
        0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
        0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
        0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
        0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
        0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
        0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
        0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
        0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
        0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
        0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0
      ],

      // 天干地支
      gan: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
      zhi: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],

      // 農曆月份
      months: ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'],

      // 農曆日期
      days: ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
             '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
             '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'],

      // 獲取農曆年天數
      lunarYearDays: function(year) {
        let sum = 348;
        for (let i = 0x8000; i > 0x8; i >>= 1) {
          sum += (this.lunarInfo[year - 1900] & i) ? 1 : 0;
        }
        return sum + this.leapDays(year);
      },

      // 獲取閏月天數
      leapDays: function(year) {
        if (this.leapMonth(year)) {
          return (this.lunarInfo[year - 1900] & 0x10000) ? 30 : 29;
        }
        return 0;
      },

      // 獲取閏月月份
      leapMonth: function(year) {
        return this.lunarInfo[year - 1900] & 0xf;
      },

      // 獲取農曆月天數
      monthDays: function(year, month) {
        return (this.lunarInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29;
      },

      // 公曆轉農曆
      solar2lunar: function(year, month, day) {
        if (year < 1900 || year > 2100) return null;

        const baseDate = new Date(1900, 0, 31);
        const objDate = new Date(year, month - 1, day);
        let offset = Math.floor((objDate - baseDate) / 86400000);

        let temp = 0;
        let lunarYear = 1900;

        for (lunarYear = 1900; lunarYear < 2101 && offset > 0; lunarYear++) {
          temp = this.lunarYearDays(lunarYear);
          offset -= temp;
        }

        if (offset < 0) {
          offset += temp;
          lunarYear--;
        }

        let lunarMonth = 1;
        let leap = this.leapMonth(lunarYear);
        let isLeap = false;

        for (lunarMonth = 1; lunarMonth < 13 && offset > 0; lunarMonth++) {
          if (leap > 0 && lunarMonth === (leap + 1) && !isLeap) {
            --lunarMonth;
            isLeap = true;
            temp = this.leapDays(lunarYear);
          } else {
            temp = this.monthDays(lunarYear, lunarMonth);
          }

          if (isLeap && lunarMonth === (leap + 1)) isLeap = false;
          offset -= temp;
        }

        if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
          if (isLeap) {
            isLeap = false;
          } else {
            isLeap = true;
            --lunarMonth;
          }
        }

        if (offset < 0) {
          offset += temp;
          --lunarMonth;
        }

        const lunarDay = offset + 1;

        // 產生農曆字串
        const ganIndex = (lunarYear - 4) % 10;
        const zhiIndex = (lunarYear - 4) % 12;
        const yearStr = this.gan[ganIndex] + this.zhi[zhiIndex] + '年';
        const monthStr = (isLeap ? '閏' : '') + this.months[lunarMonth - 1] + '月';
        const dayStr = this.days[lunarDay - 1];

        return {
          year: lunarYear,
          month: lunarMonth,
          day: lunarDay,
          isLeap: isLeap,
          yearStr: yearStr,
          monthStr: monthStr,
          dayStr: dayStr,
          fullStr: yearStr + monthStr + dayStr
        };
      }
    };

    // 農曆顯示相關函數
    function updateLunarDisplay(dateInputId, lunarDisplayId) {
      const dateInput = document.getElementById(dateInputId);
      const lunarDisplay = document.getElementById(lunarDisplayId);
      const showLunar = document.getElementById('showLunar');

      if (!dateInput.value || !showLunar.checked) {
        lunarDisplay.classList.remove('show');
        return;
      }

      const date = new Date(dateInput.value);
      const lunar = lunarCalendar.solar2lunar(date.getFullYear(), date.getMonth() + 1, date.getDate());

      if (lunar) {
        lunarDisplay.textContent = '農曆：' + lunar.fullStr;
        lunarDisplay.classList.add('show');
      } else {
        lunarDisplay.classList.remove('show');
      }
    }

    function toggleLunarDisplay() {
      const showLunar = document.getElementById('showLunar');
      updateLunarDisplay('startDate', 'startDateLunar');
      updateLunarDisplay('expiryDate', 'expiryDateLunar');

      // 儲存使用者偏好
      localStorage.setItem('showLunar', showLunar.checked);
    }

    function loadLunarPreference() {
      const showLunar = document.getElementById('showLunar');
      const saved = localStorage.getItem('showLunar');
      if (saved !== null) {
        showLunar.checked = saved === 'true';
      } else {
        showLunar.checked = true; // 預設顯示
      }
      toggleLunarDisplay();
    }

    function handleListLunarToggle() {
      const listShowLunar = document.getElementById('listShowLunar');
      // 儲存使用者偏好
      localStorage.setItem('showLunar', listShowLunar.checked);
      // 重新載入訂閱列表以套用農曆顯示設定
      loadSubscriptions();
    }

    function showToast(message, type = 'success', duration = 3000) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      
      const icon = type === 'success' ? 'check-circle' :
                   type === 'error' ? 'exclamation-circle' :
                   type === 'warning' ? 'exclamation-triangle' : 'info-circle';
      
      toast.innerHTML = '<div class="flex items-center"><i class="fas fa-' + icon + ' mr-2"></i><span>' + message + '</span></div>';
      
      container.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 100);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (container.contains(toast)) {
            container.removeChild(toast);
          }
        }, 300);
      }, duration);
    }

    function showFieldError(fieldId, message) {
      const field = document.getElementById(fieldId);
      const errorDiv = field.parentElement.querySelector('.error-message');
      if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        field.classList.add('border-red-500');
      }
    }

    function clearFieldErrors() {
      document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
      });
      document.querySelectorAll('.border-red-500').forEach(el => {
        el.classList.remove('border-red-500');
      });
    }

    function validateForm() {
      clearFieldErrors();
      let isValid = true;

      const name = document.getElementById('name').value.trim();
      if (!name) {
        showFieldError('name', '請輸入訂閱名稱');
        isValid = false;
      }

      const periodValue = document.getElementById('periodValue').value;
      if (!periodValue || periodValue < 1) {
        showFieldError('periodValue', '週期數值必須大於0');
        isValid = false;
      }

      const expiryDate = document.getElementById('expiryDate').value;
      if (!expiryDate) {
        showFieldError('expiryDate', '請選擇到期日期');
        isValid = false;
      }

      const reminderDays = document.getElementById('reminderDays').value;
      if (reminderDays === '' || reminderDays < 0) {
        showFieldError('reminderDays', '提醒天數不能為負數');
        isValid = false;
      }

      return isValid;
    }

    // 建立帶懸浮提示的文字元素
    function createHoverText(text, maxLength = 30, className = 'text-sm text-gray-900') {
      if (!text || text.length <= maxLength) {
        return '<div class="' + className + '">' + text + '</div>';
      }

      const truncated = text.substring(0, maxLength) + '...';
      return '<div class="hover-container">' +
        '<div class="hover-text ' + className + '" data-full-text="' + text.replace(/"/g, '&quot;') + '">' +
          truncated +
        '</div>' +
        '<div class="hover-tooltip"></div>' +
      '</div>';
    }

    // 獲取所有訂閱並按到期時間排序
    async function loadSubscriptions() {
      try {
        // 載入農曆顯示偏好
        const listShowLunar = document.getElementById('listShowLunar');
        const saved = localStorage.getItem('showLunar');
        if (saved !== null) {
          listShowLunar.checked = saved === 'true';
        } else {
          listShowLunar.checked = true; // 預設顯示
        }

        const tbody = document.getElementById('subscriptionsBody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>載入中...</td></tr>';

        const response = await fetch('/api/subscriptions');
        const data = await response.json();
        
        tbody.innerHTML = '';
        
        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">沒有訂閱資料</td></tr>';
          return;
        }
        
        // 按到期時間升序排序（最早到期的在前）
        data.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        
        data.forEach(subscription => {
          const row = document.createElement('tr');
          row.className = subscription.isActive === false ? 'hover:bg-gray-50 bg-gray-100' : 'hover:bg-gray-50';
          
          const expiryDate = new Date(subscription.expiryDate);
          const now = new Date();
          const daysDiff = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          
          let statusHtml = '';
          if (!subscription.isActive) {
            statusHtml = '<span class="px-2 py-1 text-xs font-medium rounded-full text-white bg-gray-500"><i class="fas fa-pause-circle mr-1"></i>已停用</span>';
          } else if (daysDiff < 0) {
            statusHtml = '<span class="px-2 py-1 text-xs font-medium rounded-full text-white bg-red-500"><i class="fas fa-exclamation-circle mr-1"></i>已過期</span>';
          } else if (daysDiff <= (subscription.reminderDays || 7)) {
            statusHtml = '<span class="px-2 py-1 text-xs font-medium rounded-full text-white bg-yellow-500"><i class="fas fa-exclamation-triangle mr-1"></i>即將到期</span>';
          } else {
            statusHtml = '<span class="px-2 py-1 text-xs font-medium rounded-full text-white bg-green-500"><i class="fas fa-check-circle mr-1"></i>正常</span>';
          }
          
          let periodText = '';
          if (subscription.periodValue && subscription.periodUnit) {
            const unitMap = { day: '天', month: '月', year: '年' };
            periodText = subscription.periodValue + ' ' + (unitMap[subscription.periodUnit] || subscription.periodUnit);
          }
          
          const autoRenewIcon = subscription.autoRenew !== false ? 
            '<i class="fas fa-sync-alt text-blue-500 ml-1" title="自動續訂"></i>' : 
            '<i class="fas fa-ban text-gray-400 ml-1" title="不自動續訂"></i>';
          
          // 檢查是否顯示農曆
          const showLunar = document.getElementById('listShowLunar').checked;
          let lunarExpiryText = '';
          let startLunarText = '';

          if (showLunar) {
            // 計算農曆日期
            const expiryDateObj = new Date(subscription.expiryDate);
            const lunarExpiry = lunarCalendar.solar2lunar(expiryDateObj.getFullYear(), expiryDateObj.getMonth() + 1, expiryDateObj.getDate());
            lunarExpiryText = lunarExpiry ? lunarExpiry.fullStr : '';

            if (subscription.startDate) {
              const startDateObj = new Date(subscription.startDate);
              const lunarStart = lunarCalendar.solar2lunar(startDateObj.getFullYear(), startDateObj.getMonth() + 1, startDateObj.getDate());
              startLunarText = lunarStart ? lunarStart.fullStr : '';
            }
          }

          // 處理備註顯示
          let notesHtml = '';
          if (subscription.notes) {
            const notes = subscription.notes;
            if (notes.length > 50) {
              const truncatedNotes = notes.substring(0, 50) + '...';
              notesHtml = '<div class="notes-container">' +
                '<div class="notes-text text-xs text-gray-500" data-full-notes="' + notes.replace(/"/g, '&quot;') + '">' +
                  truncatedNotes +
                '</div>' +
                '<div class="notes-tooltip"></div>' +
              '</div>';
            } else {
              notesHtml = '<div class="text-xs text-gray-500">' + notes + '</div>';
            }
          }

          // 產生各列內容
          const nameHtml = createHoverText(subscription.name, 20, 'text-sm font-medium text-gray-900');
          const typeHtml = createHoverText((subscription.customType || '其他'), 15, 'text-sm text-gray-900');
          const periodHtml = periodText ? createHoverText('週期: ' + periodText, 20, 'text-xs text-gray-500 mt-1') : '';

          // 到期時間相關資訊
          const expiryDateText = formatTaipeiTime(new Date(subscription.expiryDate), 'date');
          const lunarHtml = lunarExpiryText ? createHoverText('農曆: ' + lunarExpiryText, 25, 'text-xs text-blue-600 mt-1') : '';
          const daysLeftText = daysDiff < 0 ? '已過期' + Math.abs(daysDiff) + '天' : '還剩' + daysDiff + '天';
          const startDateText = subscription.startDate ?
            '開始: ' + formatTaipeiTime(new Date(subscription.startDate), 'date') + (startLunarText ? ' (' + startLunarText + ')' : '') : '';
          const startDateHtml = startDateText ? createHoverText(startDateText, 30, 'text-xs text-gray-500 mt-1') : '';

          row.innerHTML =
            '<td data-label="名稱" class="px-4 py-3"><div class="td-content-wrapper">' +
              nameHtml +
              notesHtml +
            '</div></td>' +
            '<td data-label="類型" class="px-4 py-3"><div class="td-content-wrapper">' +
              '<div class="flex items-center"><i class="fas fa-tag mr-1"></i><span>' + typeHtml + '</span></div>' +
              (periodHtml ? '<div class="flex items-center">' + periodHtml + autoRenewIcon + '</div>' : '') +
            '</div></td>' +
            '<td data-label="到期時間" class="px-4 py-3"><div class="td-content-wrapper">' +
              '<div class="text-sm text-gray-900">' + expiryDateText + '</div>' +
              lunarHtml +
              '<div class="text-xs text-gray-500 mt-1">' + daysLeftText + '</div>' +
              startDateHtml +
            '</div></td>' +
            '<td data-label="提醒設定" class="px-4 py-3"><div class="td-content-wrapper">' +
              '<div><i class="fas fa-bell mr-1"></i>提前' + (subscription.reminderDays || 0) + '天</div>' +
              (subscription.reminderDays === 0 ? '<div class="text-xs text-gray-500 mt-1">僅到期日提醒</div>' : '') +
            '</div></td>' +
            '<td data-label="狀態" class="px-4 py-3"><div class="td-content-wrapper">' + statusHtml + '</div></td>' +
            '<td data-label="操作" class="px-4 py-3">' +
              '<div class="action-buttons-wrapper">' +
                '<button class="edit btn-primary text-white px-2 py-1 rounded text-xs whitespace-nowrap" data-id="' + subscription.id + '"><i class="fas fa-edit mr-1"></i>編輯</button>' +
                '<button class="test-notify btn-info text-white px-2 py-1 rounded text-xs whitespace-nowrap" data-id="' + subscription.id + '"><i class="fas fa-paper-plane mr-1"></i>測試</button>' +
                '<button class="delete btn-danger text-white px-2 py-1 rounded text-xs whitespace-nowrap" data-id="' + subscription.id + '"><i class="fas fa-trash-alt mr-1"></i>刪除</button>' +
                (subscription.isActive ?
                  '<button class="toggle-status btn-warning text-white px-2 py-1 rounded text-xs whitespace-nowrap" data-id="' + subscription.id + '" data-action="deactivate"><i class="fas fa-pause-circle mr-1"></i>停用</button>' :
                  '<button class="toggle-status btn-success text-white px-2 py-1 rounded text-xs whitespace-nowrap" data-id="' + subscription.id + '" data-action="activate"><i class="fas fa-play-circle mr-1"></i>啟用</button>') +
              '</div>' +
            '</td>';
          
          tbody.appendChild(row);
        });
        
        document.querySelectorAll('.edit').forEach(button => {
          button.addEventListener('click', editSubscription);
        });
        
        document.querySelectorAll('.delete').forEach(button => {
          button.addEventListener('click', deleteSubscription);
        });
        
        document.querySelectorAll('.toggle-status').forEach(button => {
          button.addEventListener('click', toggleSubscriptionStatus);
        });

        document.querySelectorAll('.test-notify').forEach(button => {
          button.addEventListener('click', testSubscriptionNotification);
        });

        // 新增懸停功能
        function addHoverListeners() {
          // 計算懸浮提示位置
          function positionTooltip(element, tooltip) {
            const rect = element.getBoundingClientRect();
            const tooltipHeight = 100; // 預估高度
            const viewportHeight = window.innerHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            let top = rect.bottom + scrollTop + 8;
            let left = rect.left;

            // 如果下方空間不夠，顯示在上方
            if (rect.bottom + tooltipHeight > viewportHeight) {
              top = rect.top + scrollTop - tooltipHeight - 8;
              tooltip.style.transform = 'translateY(10px)';
              // 調整箭頭位置
              tooltip.classList.add('tooltip-above');
            } else {
              tooltip.style.transform = 'translateY(-10px)';
              tooltip.classList.remove('tooltip-above');
            }

            // 確保不超出右邊界
            const maxLeft = window.innerWidth - 320 - 20;
            if (left > maxLeft) {
              left = maxLeft;
            }

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
          }

          // 備註懸停功能
          document.querySelectorAll('.notes-text').forEach(notesElement => {
            const fullNotes = notesElement.getAttribute('data-full-notes');
            const tooltip = notesElement.parentElement.querySelector('.notes-tooltip');

            if (fullNotes && tooltip) {
              notesElement.addEventListener('mouseenter', () => {
                tooltip.textContent = fullNotes;
                positionTooltip(notesElement, tooltip);
                tooltip.classList.add('show');
              });

              notesElement.addEventListener('mouseleave', () => {
                tooltip.classList.remove('show');
              });

              // 捲動時隱藏提示
              window.addEventListener('scroll', () => {
                if (tooltip.classList.contains('show')) {
                  tooltip.classList.remove('show');
                }
              }, { passive: true });
            }
          });

          // 通用懸停功能
          document.querySelectorAll('.hover-text').forEach(hoverElement => {
            const fullText = hoverElement.getAttribute('data-full-text');
            const tooltip = hoverElement.parentElement.querySelector('.hover-tooltip');

            if (fullText && tooltip) {
              hoverElement.addEventListener('mouseenter', () => {
                tooltip.textContent = fullText;
                positionTooltip(hoverElement, tooltip);
                tooltip.classList.add('show');
              });

              hoverElement.addEventListener('mouseleave', () => {
                tooltip.classList.remove('show');
              });

              // 捲動時隱藏提示
              window.addEventListener('scroll', () => {
                if (tooltip.classList.contains('show')) {
                  tooltip.classList.remove('show');
                }
              }, { passive: true });
            }
          });
        }

        addHoverListeners();

        // 新增農曆開關事件監聽
        listShowLunar.removeEventListener('change', handleListLunarToggle);
        listShowLunar.addEventListener('change', handleListLunarToggle);
      } catch (error) {
        console.error('載入訂閱失敗:', error);
        const tbody = document.getElementById('subscriptionsBody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500"><i class="fas fa-exclamation-circle mr-2"></i>載入失敗，請重新整理頁面再試</td></tr>';
        showToast('載入訂閱列表失敗', 'error');
      }
    }
    
    async function testSubscriptionNotification(e) {
        const button = e.target.tagName === 'BUTTON' ? e.target : e.target.parentElement;
        const id = button.dataset.id;
        const originalContent = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>';
        button.disabled = true;

        try {
            const response = await fetch('/api/subscriptions/' + id + '/test-notify', { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                showToast(result.message || '測試通知已傳送', 'success');
            } else {
                showToast(result.message || '測試通知傳送失敗', 'error');
            }
        } catch (error) {
            console.error('測試通知失敗:', error);
            showToast('傳送測試通知時發生錯誤', 'error');
        } finally {
            button.innerHTML = originalContent;
            button.disabled = false;
        }
    }
    
    async function toggleSubscriptionStatus(e) {
      const id = e.target.dataset.id || e.target.parentElement.dataset.id;
      const action = e.target.dataset.action || e.target.parentElement.dataset.action;
      const isActivate = action === 'activate';
      
      const button = e.target.tagName === 'BUTTON' ? e.target : e.target.parentElement;
      const originalContent = button.innerHTML;
      button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + (isActivate ? '啟用中...' : '停用中...');
      button.disabled = true;
      
      try {
        const response = await fetch('/api/subscriptions/' + id + '/toggle-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: isActivate })
        });
        
        if (response.ok) {
          showToast((isActivate ? '啟用' : '停用') + '成功', 'success');
          loadSubscriptions();
        } else {
          const error = await response.json();
          showToast((isActivate ? '啟用' : '停用') + '失敗: ' + (error.message || '未知錯誤'), 'error');
          button.innerHTML = originalContent;
          button.disabled = false;
        }
      } catch (error) {
        console.error((isActivate ? '啟用' : '停用') + '訂閱失敗:', error);
        showToast((isActivate ? '啟用' : '停用') + '失敗，請稍後再試', 'error');
        button.innerHTML = originalContent;
        button.disabled = false;
      }
    }
    
    document.getElementById('addSubscriptionBtn').addEventListener('click', () => {
      document.getElementById('modalTitle').textContent = '新增訂閱';
      document.getElementById('subscriptionModal').classList.remove('hidden');

      document.getElementById('subscriptionForm').reset();
      document.getElementById('subscriptionId').value = '';
      clearFieldErrors();

      const today = new Date().toISOString().split('T')[0];
      document.getElementById('startDate').value = today;
      document.getElementById('reminderDays').value = '7';
      document.getElementById('isActive').checked = true;
      document.getElementById('autoRenew').checked = true;

      loadLunarPreference();
      calculateExpiryDate();
      setupModalEventListeners();
    });
    
    function setupModalEventListeners() {
      document.getElementById('calculateExpiryBtn').removeEventListener('click', calculateExpiryDate);
      document.getElementById('calculateExpiryBtn').addEventListener('click', calculateExpiryDate);

      ['startDate', 'periodValue', 'periodUnit'].forEach(id => {
        const element = document.getElementById(id);
        element.removeEventListener('change', calculateExpiryDate);
        element.addEventListener('change', calculateExpiryDate);
      });

      // 新增農曆顯示事件監聽
      document.getElementById('showLunar').removeEventListener('change', toggleLunarDisplay);
      document.getElementById('showLunar').addEventListener('change', toggleLunarDisplay);

      document.getElementById('startDate').removeEventListener('change', () => updateLunarDisplay('startDate', 'startDateLunar'));
      document.getElementById('startDate').addEventListener('change', () => updateLunarDisplay('startDate', 'startDateLunar'));

      document.getElementById('expiryDate').removeEventListener('change', () => updateLunarDisplay('expiryDate', 'expiryDateLunar'));
      document.getElementById('expiryDate').addEventListener('change', () => updateLunarDisplay('expiryDate', 'expiryDateLunar'));

      document.getElementById('cancelBtn').addEventListener('click', () => {
        document.getElementById('subscriptionModal').classList.add('hidden');
      });
    }
    
    function calculateExpiryDate() {
      const startDate = document.getElementById('startDate').value;
      const periodValue = parseInt(document.getElementById('periodValue').value);
      const periodUnit = document.getElementById('periodUnit').value;

      if (!startDate || !periodValue || !periodUnit) {
        return;
      }

      const start = new Date(startDate);
      const expiry = new Date(start);

      if (periodUnit === 'day') {
        expiry.setDate(start.getDate() + periodValue);
      } else if (periodUnit === 'month') {
        expiry.setMonth(start.getMonth() + periodValue);
      } else if (periodUnit === 'year') {
        expiry.setFullYear(start.getFullYear() + periodValue);
      }

      document.getElementById('expiryDate').value = expiry.toISOString().split('T')[0];

      // 更新農曆顯示
      updateLunarDisplay('startDate', 'startDateLunar');
      updateLunarDisplay('expiryDate', 'expiryDateLunar');
    }
    
    document.getElementById('closeModal').addEventListener('click', () => {
      document.getElementById('subscriptionModal').classList.add('hidden');
    });
    
    // 禁止點擊彈窗外區域關閉彈窗，防止誤操作丟失內容
    // document.getElementById('subscriptionModal').addEventListener('click', (event) => {
    //   if (event.target === document.getElementById('subscriptionModal')) {
    //     document.getElementById('subscriptionModal').classList.add('hidden');
    //   }
    // });
    
    document.getElementById('subscriptionForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!validateForm()) {
        return;
      }
      
      const id = document.getElementById('subscriptionId').value;
      const subscription = {
        name: document.getElementById('name').value.trim(),
        customType: document.getElementById('customType').value.trim(),
        notes: document.getElementById('notes').value.trim() || '',
        isActive: document.getElementById('isActive').checked,
        autoRenew: document.getElementById('autoRenew').checked,
        startDate: document.getElementById('startDate').value,
        expiryDate: document.getElementById('expiryDate').value,
        periodValue: parseInt(document.getElementById('periodValue').value),
        periodUnit: document.getElementById('periodUnit').value,
        reminderDays: parseInt(document.getElementById('reminderDays').value) || 0
      };
      
      const submitButton = e.target.querySelector('button[type="submit"]');
      const originalContent = submitButton.innerHTML;
      submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>' + (id ? '更新中...' : '儲存中...');
      submitButton.disabled = true;
      
      try {
        const url = id ? '/api/subscriptions/' + id : '/api/subscriptions';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        });
        
        const result = await response.json();
        
        if (result.success) {
          showToast((id ? '更新' : '新增') + '訂閱成功', 'success');
          document.getElementById('subscriptionModal').classList.add('hidden');
          loadSubscriptions();
        } else {
          showToast((id ? '更新' : '新增') + '訂閱失敗: ' + (result.message || '未知錯誤'), 'error');
        }
      } catch (error) {
        console.error((id ? '更新' : '新增') + '訂閱失敗:', error);
        showToast((id ? '更新' : '新增') + '訂閱失敗，請稍後再試', 'error');
      } finally {
        submitButton.innerHTML = originalContent;
        submitButton.disabled = false;
      }
    });
    
    async function editSubscription(e) {
      const id = e.target.dataset.id || e.target.parentElement.dataset.id;
      
      try {
        const response = await fetch('/api/subscriptions/' + id);
        const subscription = await response.json();
        
        if (subscription) {
          document.getElementById('modalTitle').textContent = '編輯訂閱';
          document.getElementById('subscriptionId').value = subscription.id;
          document.getElementById('name').value = subscription.name;
          document.getElementById('customType').value = subscription.customType || '';
          document.getElementById('notes').value = subscription.notes || '';
          document.getElementById('isActive').checked = subscription.isActive !== false;
          document.getElementById('autoRenew').checked = subscription.autoRenew !== false;
          document.getElementById('startDate').value = subscription.startDate ? subscription.startDate.split('T')[0] : '';
          document.getElementById('expiryDate').value = subscription.expiryDate ? subscription.expiryDate.split('T')[0] : '';
          document.getElementById('periodValue').value = subscription.periodValue || 1;
          document.getElementById('periodUnit').value = subscription.periodUnit || 'month';
          document.getElementById('reminderDays').value = subscription.reminderDays !== undefined ? subscription.reminderDays : 7;
          
          clearFieldErrors();
          loadLunarPreference();
          document.getElementById('subscriptionModal').classList.remove('hidden');
          setupModalEventListeners();

          // 更新農曆顯示
          setTimeout(() => {
            updateLunarDisplay('startDate', 'startDateLunar');
            updateLunarDisplay('expiryDate', 'expiryDateLunar');
          }, 100);
        }
      } catch (error) {
        console.error('獲取訂閱資訊失敗:', error);
        showToast('獲取訂閱資訊失敗', 'error');
      }
    }
    
    async function deleteSubscription(e) {
      const id = e.target.dataset.id || e.target.parentElement.dataset.id;
      
      if (!confirm('確定要刪除這個訂閱嗎？此操作不可復原。')) {
        return;
      }
      
      const button = e.target.tagName === 'BUTTON' ? e.target : e.target.parentElement;
      const originalContent = button.innerHTML;
      button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>刪除中...';
      button.disabled = true;
      
      try {
        const response = await fetch('/api/subscriptions/' + id, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          showToast('刪除成功', 'success');
          loadSubscriptions();
        } else {
          const error = await response.json();
          showToast('刪除失敗: ' + (error.message || '未知錯誤'), 'error');
          button.innerHTML = originalContent;
          button.disabled = false;
        }
      } catch (error) {
        console.error('刪除訂閱失敗:', error);
        showToast('刪除失敗，請稍後再試', 'error');
        button.innerHTML = originalContent;
        button.disabled = false;
      }
    }
    
    window.addEventListener('load', loadSubscriptions);
  </script>
</body>
</html>
`;

const configPage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>系統設定 - 訂閱管理系統</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
  <style>
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); transition: all 0.3s; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    .btn-secondary { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); transition: all 0.3s; }
    .btn-secondary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
    
    .toast {
      position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px;
      color: white; font-weight: 500; z-index: 1000; transform: translateX(400px);
      transition: all 0.3s ease-in-out; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .toast.show { transform: translateX(0); }
    .toast.success { background-color: #10b981; }
    .toast.error { background-color: #ef4444; }
    .toast.info { background-color: #3b82f6; }
    .toast.warning { background-color: #f59e0b; }
    
    .config-section { 
      border: 1px solid #e5e7eb; 
      border-radius: 8px; 
      padding: 16px; 
      margin-bottom: 24px; 
    }
    .config-section.active { 
      background-color: #f8fafc; 
      border-color: #6366f1; 
    }
    .config-section.inactive { 
      background-color: #f9fafb; 
      opacity: 0.7; 
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div id="toast-container"></div>

  <nav class="bg-white shadow-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <i class="fas fa-calendar-check text-indigo-600 text-2xl mr-2"></i>
          <span class="font-bold text-xl text-gray-800">訂閱管理系統</span>
        </div>
        <div class="flex items-center space-x-4">
          <a href="/admin" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
            <i class="fas fa-list mr-1"></i>訂閱列表
          </a>
          <a href="/admin/config" class="text-indigo-600 border-b-2 border-indigo-600 px-3 py-2 rounded-md text-sm font-medium">
            <i class="fas fa-cog mr-1"></i>系統設定
          </a>
          <a href="/api/logout" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
            <i class="fas fa-sign-out-alt mr-1"></i>登出
          </a>
        </div>
      </div>
    </div>
  </nav>
  
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">系統設定</h2>
      
      <form id="configForm" class="space-y-8">
        <div class="border-b border-gray-200 pb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">管理員帳號</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="adminUsername" class="block text-sm font-medium text-gray-700">使用者名稱</label>
              <input type="text" id="adminUsername" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            </div>
            <div>
              <label for="adminPassword" class="block text-sm font-medium text-gray-700">密碼</label>
              <input type="password" id="adminPassword" placeholder="如不修改密碼，請留空" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
              <p class="mt-1 text-sm text-gray-500">留空表示不修改目前密碼</p>
            </div>
          </div>
        </div>
        
        <div class="border-b border-gray-200 pb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">顯示設定</h3>
          <div class="mb-6">
            <label class="inline-flex items-center">
              <input type="checkbox" id="showLunarGlobal" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" checked>
              <span class="ml-2 text-sm text-gray-700">在通知中顯示農曆日期</span>
            </label>
            <p class="mt-1 text-sm text-gray-500">控制是否在通知訊息中包含農曆日期資訊</p>
          </div>
        </div>

        <div class="border-b border-gray-200 pb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">通知設定</h3>
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">通知方式（可多選）</label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label class="inline-flex items-center">
                <input type="checkbox" name="enabledNotifiers" value="telegram" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                <span class="ml-2 text-sm text-gray-700">Telegram</span>
              </label>
              <label class="inline-flex items-center">
                <input type="checkbox" name="enabledNotifiers" value="notifyx" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" checked>
                <span class="ml-2 text-sm text-gray-700 font-semibold">NotifyX</span>
              </label>
              <label class="inline-flex items-center">
                <input type="checkbox" name="enabledNotifiers" value="webhook" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                <span class="ml-2 text-sm text-gray-700">企業微信應用程式通知</span>
              </label>
              <label class="inline-flex items-center">
                <input type="checkbox" name="enabledNotifiers" value="wechatbot" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                <span class="ml-2 text-sm text-gray-700">企業微信機器人</span>
              </label>
              <label class="inline-flex items-center">
                <input type="checkbox" name="enabledNotifiers" value="email" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                <span class="ml-2 text-sm text-gray-700">郵件通知</span>
              </label>
            </div>
            <div class="mt-2 flex flex-wrap gap-4">
              <a href="https://www.notifyx.cn/" target="_blank" class="text-indigo-600 hover:text-indigo-800 text-sm">
                <i class="fas fa-external-link-alt ml-1"></i> NotifyX官網
              </a>
              <a href="https://push.wangwangit.com" target="_blank" class="text-indigo-600 hover:text-indigo-800 text-sm">
                <i class="fas fa-external-link-alt ml-1"></i> 企業微信應用程式通知官網
              </a>
              <a href="https://developer.work.weixin.qq.com/document/path/91770" target="_blank" class="text-indigo-600 hover:text-indigo-800 text-sm">
                <i class="fas fa-external-link-alt ml-1"></i> 企業微信機器人文件
              </a>
              <a href="https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/" target="_blank" class="text-indigo-600 hover:text-indigo-800 text-sm">
                <i class="fas fa-external-link-alt ml-1"></i> 獲取 Resend API Key
              </a>
            </div>
          </div>
          
          <div id="telegramConfig" class="config-section">
            <h4 class="text-md font-medium text-gray-900 mb-3">Telegram 設定</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label for="tgBotToken" class="block text-sm font-medium text-gray-700">Bot Token</label>
                <input type="text" id="tgBotToken" placeholder="從 @BotFather 獲取" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
              </div>
              <div>
                <label for="tgChatId" class="block text-sm font-medium text-gray-700">Chat ID</label>
                <input type="text" id="tgChatId" placeholder="可從 @userinfobot 獲取" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
              </div>
            </div>
            <div class="flex justify-end">
              <button type="button" id="testTelegramBtn" class="btn-secondary text-white px-4 py-2 rounded-md text-sm font-medium">
                <i class="fas fa-paper-plane mr-2"></i>測試 Telegram 通知
              </button>
            </div>
          </div>
          
          <div id="notifyxConfig" class="config-section">
            <h4 class="text-md font-medium text-gray-900 mb-3">NotifyX 設定</h4>
            <div class="mb-4">
              <label for="notifyxApiKey" class="block text-sm font-medium text-gray-700">API Key</label>
              <input type="text" id="notifyxApiKey" placeholder="從 NotifyX 平台獲取的 API Key" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
              <p class="mt-1 text-sm text-gray-500">從 <a href="https://www.notifyx.cn/" target="_blank" class="text-indigo-600 hover:text-indigo-800">NotifyX平台</a> 獲取的 API Key</p>
            </div>
            <div class="flex justify-end">
              <button type="button" id="testNotifyXBtn" class="btn-secondary text-white px-4 py-2 rounded-md text-sm font-medium">
                <i class="fas fa-paper-plane mr-2"></i>測試 NotifyX 通知
              </button>
            </div>
          </div>

          <div id="webhookConfig" class="config-section">
            <h4 class="text-md font-medium text-gray-900 mb-3">企業微信應用程式通知 設定</h4>
            <div class="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label for="webhookUrl" class="block text-sm font-medium text-gray-700">企業微信應用程式通知 URL</label>
                <input type="url" id="webhookUrl" placeholder="https://push.wangwangit.com/api/send/your-key" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <p class="mt-1 text-sm text-gray-500">從 <a href="https://push.wangwangit.com" target="_blank" class="text-indigo-600 hover:text-indigo-800">企業微信應用程式通知平台</a> 獲取的推送URL</p>
              </div>
              <div>
                <label for="webhookMethod" class="block text-sm font-medium text-gray-700">請求方法</label>
                <select id="webhookMethod" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
              <div>
                <label for="webhookHeaders" class="block text-sm font-medium text-gray-700">自訂請求頭 (JSON格式，可選)</label>
                <textarea id="webhookHeaders" rows="3" placeholder='{"Authorization": "Bearer your-token", "Content-Type": "application/json"}' class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                <p class="mt-1 text-sm text-gray-500">JSON格式的自訂請求頭，留空使用預設</p>
              </div>
              <div>
                <label for="webhookTemplate" class="block text-sm font-medium text-gray-700">訊息範本 (JSON格式，可選)</label>
                <textarea id="webhookTemplate" rows="4" placeholder='{"title": "{{title}}", "content": "{{content}}", "timestamp": "{{timestamp}}"}' class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                <p class="mt-1 text-sm text-gray-500">支援變數: {{title}}, {{content}}, {{timestamp}}。留空使用預設格式</p>
              </div>
            </div>
            <div class="flex justify-end">
              <button type="button" id="testWebhookBtn" class="btn-secondary text-white px-4 py-2 rounded-md text-sm font-medium">
                <i class="fas fa-paper-plane mr-2"></i>測試 企業微信應用程式通知
              </button>
            </div>
          </div>

          <div id="wechatbotConfig" class="config-section">
            <h4 class="text-md font-medium text-gray-900 mb-3">企業微信機器人 設定</h4>
            <div class="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label for="wechatbotWebhook" class="block text-sm font-medium text-gray-700">機器人 Webhook URL</label>
                <input type="url" id="wechatbotWebhook" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-key" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <p class="mt-1 text-sm text-gray-500">從企業微信群組聊天中新增機器人獲取的 Webhook URL</p>
              </div>
              <div>
                <label for="wechatbotMsgType" class="block text-sm font-medium text-gray-700">訊息類型</label>
                <select id="wechatbotMsgType" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="text">文字訊息</option>
                  <option value="markdown">Markdown訊息</option>
                </select>
                <p class="mt-1 text-sm text-gray-500">選擇傳送的訊息格式類型</p>
              </div>
              <div>
                <label for="wechatbotAtMobiles" class="block text-sm font-medium text-gray-700">@手機號碼 (可選)</label>
                <input type="text" id="wechatbotAtMobiles" placeholder="13800138000,13900139000" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <p class="mt-1 text-sm text-gray-500">需要@的手機號碼，多個用逗號分隔，留空則不@任何人</p>
              </div>
              <div>
                <label for="wechatbotAtAll" class="block text-sm font-medium text-gray-700 mb-2">@所有人</label>
                <label class="inline-flex items-center">
                  <input type="checkbox" id="wechatbotAtAll" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                  <span class="ml-2 text-sm text-gray-700">傳送訊息時@所有人</span>
                </label>
              </div>
            </div>
            <div class="flex justify-end">
              <button type="button" id="testWechatBotBtn" class="btn-secondary text-white px-4 py-2 rounded-md text-sm font-medium">
                <i class="fas fa-paper-plane mr-2"></i>測試 企業微信機器人
              </button>
            </div>
          </div>

          <div id="emailConfig" class="config-section">
            <h4 class="text-md font-medium text-gray-900 mb-3">郵件通知 設定</h4>
            <div class="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label for="resendApiKey" class="block text-sm font-medium text-gray-700">Resend API Key</label>
                <input type="text" id="resendApiKey" placeholder="re_xxxxxxxxxx" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <p class="mt-1 text-sm text-gray-500">從 <a href="https://resend.com/api-keys" target="_blank" class="text-indigo-600 hover:text-indigo-800">Resend控制台</a> 獲取的 API Key</p>
              </div>
              <div>
                <label for="emailFrom" class="block text-sm font-medium text-gray-700">寄件人信箱</label>
                <input type="email" id="emailFrom" placeholder="noreply@yourdomain.com" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <p class="mt-1 text-sm text-gray-500">必須是已在Resend驗證的網域信箱</p>
              </div>
              <div>
                <label for="emailFromName" class="block text-sm font-medium text-gray-700">寄件人名稱</label>
                <input type="text" id="emailFromName" placeholder="訂閱提醒系統" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <p class="mt-1 text-sm text-gray-500">顯示在郵件中的寄件人名稱</p>
              </div>
              <div>
                <label for="emailTo" class="block text-sm font-medium text-gray-700">收件人信箱</label>
                <input type="email" id="emailTo" placeholder="user@example.com" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <p class="mt-1 text-sm text-gray-500">接收通知郵件的信箱地址</p>
              </div>
            </div>
            <div class="flex justify-end">
              <button type="button" id="testEmailBtn" class="btn-secondary text-white px-4 py-2 rounded-md text-sm font-medium">
                <i class="fas fa-paper-plane mr-2"></i>測試 郵件通知
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <button type="submit" class="btn-primary text-white px-6 py-2 rounded-md text-sm font-medium">
            <i class="fas fa-save mr-2"></i>儲存設定
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    function showToast(message, type = 'success', duration = 3000) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      
      const icon = type === 'success' ? 'check-circle' :
                   type === 'error' ? 'exclamation-circle' :
                   type === 'warning' ? 'exclamation-triangle' : 'info-circle';
      
      toast.innerHTML = '<div class="flex items-center"><i class="fas fa-' + icon + ' mr-2"></i><span>' + message + '</span></div>';
      
      container.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 100);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (container.contains(toast)) {
            container.removeChild(toast);
          }
        }, 300);
      }, duration);
    }

    async function loadConfig() {
      try {
        const response = await fetch('/api/config');
        const config = await response.json();

        document.getElementById('adminUsername').value = config.ADMIN_USERNAME || '';
        document.getElementById('tgBotToken').value = config.TG_BOT_TOKEN || '';
        document.getElementById('tgChatId').value = config.TG_CHAT_ID || '';
        document.getElementById('notifyxApiKey').value = config.NOTIFYX_API_KEY || '';
        document.getElementById('webhookUrl').value = config.WEBHOOK_URL || '';
        document.getElementById('webhookMethod').value = config.WEBHOOK_METHOD || 'POST';
        document.getElementById('webhookHeaders').value = config.WEBHOOK_HEADERS || '';
        document.getElementById('webhookTemplate').value = config.WEBHOOK_TEMPLATE || '';
        document.getElementById('wechatbotWebhook').value = config.WECHATBOT_WEBHOOK || '';
        document.getElementById('wechatbotMsgType').value = config.WECHATBOT_MSG_TYPE || 'text';
        document.getElementById('wechatbotAtMobiles').value = config.WECHATBOT_AT_MOBILES || '';
        document.getElementById('wechatbotAtAll').checked = config.WECHATBOT_AT_ALL === 'true';
        document.getElementById('resendApiKey').value = config.RESEND_API_KEY || '';
        document.getElementById('emailFrom').value = config.EMAIL_FROM || '';
        document.getElementById('emailFromName').value = config.EMAIL_FROM_NAME || '訂閱提醒系統';
        document.getElementById('emailTo').value = config.EMAIL_TO || '';

        // 載入農曆顯示設定
        document.getElementById('showLunarGlobal').checked = config.SHOW_LUNAR === true;

        // 處理多選通知頻道
        const enabledNotifiers = config.ENABLED_NOTIFIERS || ['notifyx'];
        document.querySelectorAll('input[name="enabledNotifiers"]').forEach(checkbox => {
          checkbox.checked = enabledNotifiers.includes(checkbox.value);
        });

        toggleNotificationConfigs(enabledNotifiers);
      } catch (error) {
        console.error('載入設定失敗:', error);
        showToast('載入設定失敗，請重新整理頁面再試', 'error');
      }
    }
    
    function toggleNotificationConfigs(enabledNotifiers) {
      const telegramConfig = document.getElementById('telegramConfig');
      const notifyxConfig = document.getElementById('notifyxConfig');
      const webhookConfig = document.getElementById('webhookConfig');
      const wechatbotConfig = document.getElementById('wechatbotConfig');
      const emailConfig = document.getElementById('emailConfig');

      // 重置所有設定區域
      [telegramConfig, notifyxConfig, webhookConfig, wechatbotConfig, emailConfig].forEach(config => {
        config.classList.remove('active', 'inactive');
        config.classList.add('inactive');
      });

      // 激活選中的設定區域
      enabledNotifiers.forEach(type => {
        if (type === 'telegram') {
          telegramConfig.classList.remove('inactive');
          telegramConfig.classList.add('active');
        } else if (type === 'notifyx') {
          notifyxConfig.classList.remove('inactive');
          notifyxConfig.classList.add('active');
        } else if (type === 'webhook') {
          webhookConfig.classList.remove('inactive');
          webhookConfig.classList.add('active');
        } else if (type === 'wechatbot') {
          wechatbotConfig.classList.remove('inactive');
          wechatbotConfig.classList.add('active');
        } else if (type === 'email') {
          emailConfig.classList.remove('inactive');
          emailConfig.classList.add('active');
        }
      });
    }

    document.querySelectorAll('input[name="enabledNotifiers"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const enabledNotifiers = Array.from(document.querySelectorAll('input[name="enabledNotifiers"]:checked'))
          .map(cb => cb.value);
        toggleNotificationConfigs(enabledNotifiers);
      });
    });
    
    document.getElementById('configForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const enabledNotifiers = Array.from(document.querySelectorAll('input[name="enabledNotifiers"]:checked'))
        .map(cb => cb.value);

      if (enabledNotifiers.length === 0) {
        showToast('請至少選擇一種通知方式', 'warning');
        return;
      }

      const config = {
        ADMIN_USERNAME: document.getElementById('adminUsername').value.trim(),
        TG_BOT_TOKEN: document.getElementById('tgBotToken').value.trim(),
        TG_CHAT_ID: document.getElementById('tgChatId').value.trim(),
        NOTIFYX_API_KEY: document.getElementById('notifyxApiKey').value.trim(),
        WEBHOOK_URL: document.getElementById('webhookUrl').value.trim(),
        WEBHOOK_METHOD: document.getElementById('webhookMethod').value,
        WEBHOOK_HEADERS: document.getElementById('webhookHeaders').value.trim(),
        WEBHOOK_TEMPLATE: document.getElementById('webhookTemplate').value.trim(),
        SHOW_LUNAR: document.getElementById('showLunarGlobal').checked,
        WECHATBOT_WEBHOOK: document.getElementById('wechatbotWebhook').value.trim(),
        WECHATBOT_MSG_TYPE: document.getElementById('wechatbotMsgType').value,
        WECHATBOT_AT_MOBILES: document.getElementById('wechatbotAtMobiles').value.trim(),
        WECHATBOT_AT_ALL: document.getElementById('wechatbotAtAll').checked.toString(),
        RESEND_API_KEY: document.getElementById('resendApiKey').value.trim(),
        EMAIL_FROM: document.getElementById('emailFrom').value.trim(),
        EMAIL_FROM_NAME: document.getElementById('emailFromName').value.trim(),
        EMAIL_TO: document.getElementById('emailTo').value.trim(),
        ENABLED_NOTIFIERS: enabledNotifiers
      };

      const passwordField = document.getElementById('adminPassword');
      if (passwordField.value.trim()) {
        config.ADMIN_PASSWORD = passwordField.value.trim();
      }

      const submitButton = e.target.querySelector('button[type="submit"]');
      const originalContent = submitButton.innerHTML;
      submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>儲存中...';
      submitButton.disabled = true;

      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });

        const result = await response.json();

        if (result.success) {
          showToast('設定儲存成功', 'success');
          passwordField.value = '';
        } else {
          showToast('設定儲存失敗: ' + (result.message || '未知錯誤'), 'error');
        }
      } catch (error) {
        console.error('儲存設定失敗:', error);
        showToast('儲存設定失敗，請稍後再試', 'error');
      } finally {
        submitButton.innerHTML = originalContent;
        submitButton.disabled = false;
      }
    });
    
    async function testNotification(type) {
      const buttonId = type === 'telegram' ? 'testTelegramBtn' :
                      type === 'notifyx' ? 'testNotifyXBtn' :
                      type === 'wechatbot' ? 'testWechatBotBtn' :
                      type === 'email' ? 'testEmailBtn' : 'testWebhookBtn';
      const button = document.getElementById(buttonId);
      const originalContent = button.innerHTML;
      const serviceName = type === 'telegram' ? 'Telegram' :
                          type === 'notifyx' ? 'NotifyX' :
                          type === 'wechatbot' ? '企業微信機器人' :
                          type === 'email' ? '郵件通知' : '企業微信應用程式通知';

      button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>測試中...';
      button.disabled = true;

      const config = {};
      if (type === 'telegram') {
        config.TG_BOT_TOKEN = document.getElementById('tgBotToken').value.trim();
        config.TG_CHAT_ID = document.getElementById('tgChatId').value.trim();

        if (!config.TG_BOT_TOKEN || !config.TG_CHAT_ID) {
          showToast('請先填寫 Telegram Bot Token 和 Chat ID', 'warning');
          button.innerHTML = originalContent;
          button.disabled = false;
          return;
        }
      } else if (type === 'notifyx') {
        config.NOTIFYX_API_KEY = document.getElementById('notifyxApiKey').value.trim();

        if (!config.NOTIFYX_API_KEY) {
          showToast('請先填寫 NotifyX API Key', 'warning');
          button.innerHTML = originalContent;
          button.disabled = false;
          return;
        }
      } else if (type === 'webhook') {
        config.WEBHOOK_URL = document.getElementById('webhookUrl').value.trim();
        config.WEBHOOK_METHOD = document.getElementById('webhookMethod').value;
        config.WEBHOOK_HEADERS = document.getElementById('webhookHeaders').value.trim();
        config.WEBHOOK_TEMPLATE = document.getElementById('webhookTemplate').value.trim();

        if (!config.WEBHOOK_URL) {
          showToast('請先填寫 企業微信應用程式通知 URL', 'warning');
          button.innerHTML = originalContent;
          button.disabled = false;
          return;
        }
      } else if (type === 'wechatbot') {
        config.WECHATBOT_WEBHOOK = document.getElementById('wechatbotWebhook').value.trim();
        config.WECHATBOT_MSG_TYPE = document.getElementById('wechatbotMsgType').value;
        config.WECHATBOT_AT_MOBILES = document.getElementById('wechatbotAtMobiles').value.trim();
        config.WECHATBOT_AT_ALL = document.getElementById('wechatbotAtAll').checked.toString();

        if (!config.WECHATBOT_WEBHOOK) {
          showToast('請先填寫企業微信機器人 Webhook URL', 'warning');
          button.innerHTML = originalContent;
          button.disabled = false;
          return;
        }
      } else if (type === 'email') {
        config.RESEND_API_KEY = document.getElementById('resendApiKey').value.trim();
        config.EMAIL_FROM = document.getElementById('emailFrom').value.trim();
        config.EMAIL_FROM_NAME = document.getElementById('emailFromName').value.trim();
        config.EMAIL_TO = document.getElementById('emailTo').value.trim();

        if (!config.RESEND_API_KEY || !config.EMAIL_FROM || !config.EMAIL_TO) {
          showToast('請先填寫 Resend API Key、寄件人信箱和收件人信箱', 'warning');
          button.innerHTML = originalContent;
          button.disabled = false;
          return;
        }
      }

      try {
        const response = await fetch('/api/test-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: type, ...config })
        });

        const result = await response.json();

        if (result.success) {
          showToast(serviceName + ' 通知測試成功！', 'success');
        } else {
          showToast(serviceName + ' 通知測試失敗: ' + (result.message || '未知錯誤'), 'error');
        }
      } catch (error) {
        console.error('測試通知失敗:', error);
        showToast('測試失敗，請稍後再試', 'error');
      } finally {
        button.innerHTML = originalContent;
        button.disabled = false;
      }
    }
    
    document.getElementById('testTelegramBtn').addEventListener('click', () => {
      testNotification('telegram');
    });
    
    document.getElementById('testNotifyXBtn').addEventListener('click', () => {
      testNotification('notifyx');
    });

    document.getElementById('testWebhookBtn').addEventListener('click', () => {
      testNotification('webhook');
    });

    document.getElementById('testWechatBotBtn').addEventListener('click', () => {
      testNotification('wechatbot');
    });

    document.getElementById('testEmailBtn').addEventListener('click', () => {
      testNotification('email');
    });

    window.addEventListener('load', loadConfig);
  </script>
</body>
</html>
`;

// 管理頁面
const admin = {
  async handleRequest(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      console.log('[管理頁面] 存取路徑:', pathname);

      const token = getCookieValue(request.headers.get('Cookie'), 'token');
      console.log('[管理頁面] Token存在:', !!token);

      const config = await getConfig(env);
      const user = token ? await verifyJWT(token, config.JWT_SECRET) : null;

      console.log('[管理頁面] 使用者驗證結果:', !!user);

      if (!user) {
        console.log('[管理頁面] 使用者未登入，重定向到登入頁面');
        return new Response('', {
          status: 302,
          headers: { 'Location': '/' }
        });
      }

      if (pathname === '/admin/config') {
        return new Response(configPage, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      return new Response(adminPage, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    } catch (error) {
      console.error('[管理頁面] 處理請求時出錯:', error);
      return new Response('伺服器內部錯誤', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
};

// 處理API請求
const api = {
  async handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.slice(4);
    const method = request.method;

    const config = await getConfig(env);

    if (path === '/login' && method === 'POST') {
      const body = await request.json();

      if (body.username === config.ADMIN_USERNAME && body.password === config.ADMIN_PASSWORD) {
        const token = await generateJWT(body.username, config.JWT_SECRET);

        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': 'token=' + token + '; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400'
            }
          }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, message: '使用者名稱或密碼錯誤' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (path === '/logout' && (method === 'GET' || method === 'POST')) {
      return new Response('', {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': 'token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
        }
      });
    }

    const token = getCookieValue(request.headers.get('Cookie'), 'token');
    const user = token ? await verifyJWT(token, config.JWT_SECRET) : null;

    if (!user && path !== '/login') {
      return new Response(
        JSON.stringify({ success: false, message: '未授權存取' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (path === '/config') {
      if (method === 'GET') {
        const { JWT_SECRET, ADMIN_PASSWORD, ...safeConfig } = config;
        return new Response(
          JSON.stringify(safeConfig),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'POST') {
        try {
          const newConfig = await request.json();

          const updatedConfig = {
            ...config,
            ADMIN_USERNAME: newConfig.ADMIN_USERNAME || config.ADMIN_USERNAME,
            TG_BOT_TOKEN: newConfig.TG_BOT_TOKEN || '',
            TG_CHAT_ID: newConfig.TG_CHAT_ID || '',
            NOTIFYX_API_KEY: newConfig.NOTIFYX_API_KEY || '',
            WEBHOOK_URL: newConfig.WEBHOOK_URL || '',
            WEBHOOK_METHOD: newConfig.WEBHOOK_METHOD || 'POST',
            WEBHOOK_HEADERS: newConfig.WEBHOOK_HEADERS || '',
            WEBHOOK_TEMPLATE: newConfig.WEBHOOK_TEMPLATE || '',
            SHOW_LUNAR: newConfig.SHOW_LUNAR === true,
            WECHATBOT_WEBHOOK: newConfig.WECHATBOT_WEBHOOK || '',
            WECHATBOT_MSG_TYPE: newConfig.WECHATBOT_MSG_TYPE || 'text',
            WECHATBOT_AT_MOBILES: newConfig.WECHATBOT_AT_MOBILES || '',
            WECHATBOT_AT_ALL: newConfig.WECHATBOT_AT_ALL || 'false',
            RESEND_API_KEY: newConfig.RESEND_API_KEY || '',
            EMAIL_FROM: newConfig.EMAIL_FROM || '',
            EMAIL_FROM_NAME: newConfig.EMAIL_FROM_NAME || '',
            EMAIL_TO: newConfig.EMAIL_TO || '',
            ENABLED_NOTIFIERS: newConfig.ENABLED_NOTIFIERS || ['notifyx']
          };

          if (newConfig.ADMIN_PASSWORD) {
            updatedConfig.ADMIN_PASSWORD = newConfig.ADMIN_PASSWORD;
          }

          // 確保JWT_SECRET存在且安全
          if (!updatedConfig.JWT_SECRET || updatedConfig.JWT_SECRET === 'your-secret-key') {
            updatedConfig.JWT_SECRET = generateRandomSecret();
            console.log('[安全] 產生新的JWT金鑰');
          }

          await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig));

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('設定儲存錯誤:', error);
          return new Response(
            JSON.stringify({ success: false, message: '更新設定失敗: ' + error.message }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (path === '/test-notification' && method === 'POST') {
      try {
        const body = await request.json();
        let success = false;
        let message = '';

        if (body.type === 'telegram') {
          const testConfig = {
            ...config,
            TG_BOT_TOKEN: body.TG_BOT_TOKEN,
            TG_CHAT_ID: body.TG_CHAT_ID
          };

          const content = '*測試通知*\n\n這是一條測試通知，用於驗證Telegram通知功能是否正常運作。\n\n傳送時間: ' + formatTaipeiTime();
          success = await sendTelegramNotification(content, testConfig);
          message = success ? 'Telegram通知傳送成功' : 'Telegram通知傳送失敗，請檢查設定';
        } else if (body.type === 'notifyx') {
          const testConfig = {
            ...config,
            NOTIFYX_API_KEY: body.NOTIFYX_API_KEY
          };

          const title = '測試通知';
          const content = '## 這是一條測試通知\n\n用於驗證NotifyX通知功能是否正常運作。\n\n傳送時間: ' + formatTaipeiTime();
          const description = '測試NotifyX通知功能';

          success = await sendNotifyXNotification(title, content, description, testConfig);
          message = success ? 'NotifyX通知傳送成功' : 'NotifyX通知傳送失敗，請檢查設定';
        } else if (body.type === 'webhook') {
          const testConfig = {
            ...config,
            WEBHOOK_URL: body.WEBHOOK_URL,
            WEBHOOK_METHOD: body.WEBHOOK_METHOD,
            WEBHOOK_HEADERS: body.WEBHOOK_HEADERS,
            WEBHOOK_TEMPLATE: body.WEBHOOK_TEMPLATE
          };

          const title = '測試通知';
          const content = '這是一條測試通知，用於驗證企業微信應用程式通知功能是否正常運作。\n\n傳送時間: ' + formatTaipeiTime();

          success = await sendWebhookNotification(title, content, testConfig);
          message = success ? '企業微信應用程式通知傳送成功' : '企業微信應用程式通知傳送失敗，請檢查設定';
         } else if (body.type === 'wechatbot') {
          const testConfig = {
            ...config,
            WECHATBOT_WEBHOOK: body.WECHATBOT_WEBHOOK,
            WECHATBOT_MSG_TYPE: body.WECHATBOT_MSG_TYPE,
            WECHATBOT_AT_MOBILES: body.WECHATBOT_AT_MOBILES,
            WECHATBOT_AT_ALL: body.WECHATBOT_AT_ALL
          };

          const title = '測試通知';
          const content = '這是一條測試通知，用於驗證企業微信機器人功能是否正常運作。\n\n傳送時間: ' + formatTaipeiTime();

          success = await sendWechatBotNotification(title, content, testConfig);
          message = success ? '企業微信機器人通知傳送成功' : '企業微信機器人通知傳送失敗，請檢查設定';
        } else if (body.type === 'email') {
          const testConfig = {
            ...config,
            RESEND_API_KEY: body.RESEND_API_KEY,
            EMAIL_FROM: body.EMAIL_FROM,
            EMAIL_FROM_NAME: body.EMAIL_FROM_NAME,
            EMAIL_TO: body.EMAIL_TO
          };

          const title = '測試通知';
          const content = '這是一條測試通知，用於驗證郵件通知功能是否正常運作。\n\n傳送時間: ' + formatTaipeiTime();

          success = await sendEmailNotification(title, content, testConfig);
          message = success ? '郵件通知傳送成功' : '郵件通知傳送失敗，請檢查設定';
        }

        return new Response(
          JSON.stringify({ success, message }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('測試通知失敗:', error);
        return new Response(
          JSON.stringify({ success: false, message: '測試通知失敗: ' + error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (path === '/subscriptions') {
      if (method === 'GET') {
        const subscriptions = await getAllSubscriptions(env);
        return new Response(
          JSON.stringify(subscriptions),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'POST') {
        const subscription = await request.json();
        const result = await createSubscription(subscription, env);

        return new Response(
          JSON.stringify(result),
          {
            status: result.success ? 201 : 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (path.startsWith('/subscriptions/')) {
      const parts = path.split('/');
      const id = parts[2];

      if (parts[3] === 'toggle-status' && method === 'POST') {
        const body = await request.json();
        const result = await toggleSubscriptionStatus(id, body.isActive, env);

        return new Response(
          JSON.stringify(result),
          {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (parts[3] === 'test-notify' && method === 'POST') {
        const result = await testSingleSubscriptionNotification(id, env);
        return new Response(JSON.stringify(result), { status: result.success ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'GET') {
        const subscription = await getSubscription(id, env);

        return new Response(
          JSON.stringify(subscription),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'PUT') {
        const subscription = await request.json();
        const result = await updateSubscription(id, subscription, env);

        return new Response(
          JSON.stringify(result),
          {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (method === 'DELETE') {
        const result = await deleteSubscription(id, env);

        return new Response(
          JSON.stringify(result),
          {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // 處理第三方通知API
    if (path.startsWith('/notify/')) {
      const code = path.split('/')[2];
      if (method === 'POST') {
        try {
          const body = await request.json();
          const title = body.title || '第三方通知';
          const content = body.content || '';

          if (!content) {
            return new Response(
              JSON.stringify({ message: '缺少必填參數 content' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const config = await getConfig(env);

          // 使用多頻道傳送通知
          await sendNotificationToAllChannels(title, content, config, '[第三方API]');

          return new Response(
            JSON.stringify({
              message: '傳送成功',
              response: {
                errcode: 0,
                errmsg: 'ok',
                msgid: 'MSGID' + Date.now()
              }
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('[第三方API] 傳送通知失敗:', error);
          return new Response(
            JSON.stringify({
              message: '傳送失敗',
              response: {
                errcode: 1,
                errmsg: error.message
              }
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: '未找到請求的資源' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 工具函數
function generateRandomSecret() {
  // 產生一個64字元的隨機金鑰
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getConfig(env) {
  try {
    if (!env.SUBSCRIPTIONS_KV) {
      console.error('[設定] KV儲存未綁定');
      throw new Error('KV儲存未綁定');
    }

    const data = await env.SUBSCRIPTIONS_KV.get('config');
    console.log('[設定] 從KV讀取設定:', data ? '成功' : '空設定');

    const config = data ? JSON.parse(data) : {};

    // 確保JWT_SECRET的一致性
    let jwtSecret = config.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'your-secret-key') {
      jwtSecret = generateRandomSecret();
      console.log('[設定] 產生新的JWT金鑰');

      // 儲存新的JWT金鑰
      const updatedConfig = { ...config, JWT_SECRET: jwtSecret };
      await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig));
    }

    const finalConfig = {
      ADMIN_USERNAME: config.ADMIN_USERNAME || 'admin',
      ADMIN_PASSWORD: config.ADMIN_PASSWORD || 'password',
      JWT_SECRET: jwtSecret,
      TG_BOT_TOKEN: config.TG_BOT_TOKEN || '',
      TG_CHAT_ID: config.TG_CHAT_ID || '',
      NOTIFYX_API_KEY: config.NOTIFYX_API_KEY || '',
      WEBHOOK_URL: config.WEBHOOK_URL || '',
      WEBHOOK_METHOD: config.WEBHOOK_METHOD || 'POST',
      WEBHOOK_HEADERS: config.WEBHOOK_HEADERS || '',
      WEBHOOK_TEMPLATE: config.WEBHOOK_TEMPLATE || '',
      SHOW_LUNAR: config.SHOW_LUNAR === true,
      WECHATBOT_WEBHOOK: config.WECHATBOT_WEBHOOK || '',
      WECHATBOT_MSG_TYPE: config.WECHATBOT_MSG_TYPE || 'text',
      WECHATBOT_AT_MOBILES: config.WECHATBOT_AT_MOBILES || '',
      WECHATBOT_AT_ALL: config.WECHATBOT_AT_ALL || 'false',
      RESEND_API_KEY: config.RESEND_API_KEY || '',
      EMAIL_FROM: config.EMAIL_FROM || '',
      EMAIL_FROM_NAME: config.EMAIL_FROM_NAME || '',
      EMAIL_TO: config.EMAIL_TO || '',
      ENABLED_NOTIFIERS: config.ENABLED_NOTIFIERS || ['notifyx']
    };

    console.log('[設定] 最終設定使用者名稱:', finalConfig.ADMIN_USERNAME);
    return finalConfig;
  } catch (error) {
    console.error('[設定] 獲取設定失敗:', error);
    const defaultJwtSecret = generateRandomSecret();

    return {
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'password',
      JWT_SECRET: defaultJwtSecret,
      TG_BOT_TOKEN: '',
      TG_CHAT_ID: '',
      NOTIFYX_API_KEY: '',
      WEBHOOK_URL: '',
      WEBHOOK_METHOD: 'POST',
      WEBHOOK_HEADERS: '',
      WEBHOOK_TEMPLATE: '',
      SHOW_LUNAR: true,
      WECHATBOT_WEBHOOK: '',
      WECHATBOT_MSG_TYPE: 'text',
      WECHATBOT_AT_MOBILES: '',
      WECHATBOT_AT_ALL: 'false',
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
      EMAIL_FROM_NAME: '',
      EMAIL_TO: '',
      ENABLED_NOTIFIERS: ['notifyx']
    };
  }
}

async function generateJWT(username, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { username, iat: Math.floor(Date.now() / 1000) };

  const headerBase64 = btoa(JSON.stringify(header));
  const payloadBase64 = btoa(JSON.stringify(payload));

  const signatureInput = headerBase64 + '.' + payloadBase64;
  const signature = await CryptoJS.HmacSHA256(signatureInput, secret);

  return headerBase64 + '.' + payloadBase64 + '.' + signature;
}

async function verifyJWT(token, secret) {
  try {
    if (!token || !secret) {
      console.log('[JWT] Token或Secret為空');
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[JWT] Token格式錯誤，部分數量:', parts.length);
      return null;
    }

    const [headerBase64, payloadBase64, signature] = parts;
    const signatureInput = headerBase64 + '.' + payloadBase64;
    const expectedSignature = await CryptoJS.HmacSHA256(signatureInput, secret);

    if (signature !== expectedSignature) {
      console.log('[JWT] 簽章驗證失敗');
      return null;
    }

    const payload = JSON.parse(atob(payloadBase64));
    console.log('[JWT] 驗證成功，使用者:', payload.username);
    return payload;
  } catch (error) {
    console.error('[JWT] 驗證過程出錯:', error);
    return null;
  }
}

async function getAllSubscriptions(env) {
  try {
    const data = await env.SUBSCRIPTIONS_KV.get('subscriptions');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
}

async function getSubscription(id, env) {
  const subscriptions = await getAllSubscriptions(env);
  return subscriptions.find(s => s.id === id);
}

async function createSubscription(subscription, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);

    if (!subscription.name || !subscription.expiryDate) {
      return { success: false, message: '缺少必填欄位' };
    }

    let expiryDate = new Date(subscription.expiryDate);
    const now = new Date();

    if (expiryDate < now && subscription.periodValue && subscription.periodUnit) {
      while (expiryDate < now) {
        if (subscription.periodUnit === 'day') {
          expiryDate.setDate(expiryDate.getDate() + subscription.periodValue);
        } else if (subscription.periodUnit === 'month') {
          expiryDate.setMonth(expiryDate.getMonth() + subscription.periodValue);
        } else if (subscription.periodUnit === 'year') {
          expiryDate.setFullYear(expiryDate.getFullYear() + subscription.periodValue);
        }
      }
      subscription.expiryDate = expiryDate.toISOString();
    }

    const newSubscription = {
      id: Date.now().toString(),
      name: subscription.name,
      customType: subscription.customType || '',
      startDate: subscription.startDate || null,
      expiryDate: subscription.expiryDate,
      periodValue: subscription.periodValue || 1,
      periodUnit: subscription.periodUnit || 'month',
      reminderDays: subscription.reminderDays !== undefined ? subscription.reminderDays : 7,
      notes: subscription.notes || '',
      isActive: subscription.isActive !== false,
      autoRenew: subscription.autoRenew !== false,
      createdAt: new Date().toISOString()
    };

    subscriptions.push(newSubscription);

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: newSubscription };
  } catch (error) {
    return { success: false, message: '建立訂閱失敗' };
  }
}

async function updateSubscription(id, subscription, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const index = subscriptions.findIndex(s => s.id === id);

    if (index === -1) {
      return { success: false, message: '訂閱不存在' };
    }

    if (!subscription.name || !subscription.expiryDate) {
      return { success: false, message: '缺少必填欄位' };
    }

    let expiryDate = new Date(subscription.expiryDate);
    const now = new Date();

    if (expiryDate < now && subscription.periodValue && subscription.periodUnit) {
      while (expiryDate < now) {
        if (subscription.periodUnit === 'day') {
          expiryDate.setDate(expiryDate.getDate() + subscription.periodValue);
        } else if (subscription.periodUnit === 'month') {
          expiryDate.setMonth(expiryDate.getMonth() + subscription.periodValue);
        } else if (subscription.periodUnit === 'year') {
          expiryDate.setFullYear(expiryDate.getFullYear() + subscription.periodValue);
        }
      }
      subscription.expiryDate = expiryDate.toISOString();
    }

    subscriptions[index] = {
      ...subscriptions[index],
      name: subscription.name,
      customType: subscription.customType || subscriptions[index].customType || '',
      startDate: subscription.startDate || subscriptions[index].startDate,
      expiryDate: subscription.expiryDate,
      periodValue: subscription.periodValue || subscriptions[index].periodValue || 1,
      periodUnit: subscription.periodUnit || subscriptions[index].periodUnit || 'month',
      reminderDays: subscription.reminderDays !== undefined ? subscription.reminderDays : (subscriptions[index].reminderDays !== undefined ? subscriptions[index].reminderDays : 7),
      notes: subscription.notes || '',
      isActive: subscription.isActive !== undefined ? subscription.isActive : subscriptions[index].isActive,
      autoRenew: subscription.autoRenew !== undefined ? subscription.autoRenew : (subscriptions[index].autoRenew !== undefined ? subscriptions[index].autoRenew : true),
      updatedAt: new Date().toISOString()
    };

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: subscriptions[index] };
  } catch (error) {
    return { success: false, message: '更新訂閱失敗' };
  }
}

async function deleteSubscription(id, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const filteredSubscriptions = subscriptions.filter(s => s.id !== id);

    if (filteredSubscriptions.length === subscriptions.length) {
      return { success: false, message: '訂閱不存在' };
    }

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(filteredSubscriptions));

    return { success: true };
  } catch (error) {
    return { success: false, message: '刪除訂閱失敗' };
  }
}

async function toggleSubscriptionStatus(id, isActive, env) {
  try {
    const subscriptions = await getAllSubscriptions(env);
    const index = subscriptions.findIndex(s => s.id === id);

    if (index === -1) {
      return { success: false, message: '訂閱不存在' };
    }

    subscriptions[index] = {
      ...subscriptions[index],
      isActive: isActive,
      updatedAt: new Date().toISOString()
    };

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions));

    return { success: true, subscription: subscriptions[index] };
  } catch (error) {
    return { success: false, message: '更新訂閱狀態失敗' };
  }
}

async function testSingleSubscriptionNotification(id, env) {
  try {
    const subscription = await getSubscription(id, env);
    if (!subscription) {
      return { success: false, message: '未找到該訂閱' };
    }
    const config = await getConfig(env);

    const title = `手動測試通知: ${subscription.name}`;

    // 檢查是否顯示農曆（從設定中獲取，預設不顯示）
    const showLunar = config.SHOW_LUNAR === true;
    let lunarExpiryText = '';

    if (showLunar) {
      // 計算農曆日期
      const expiryDateObj = new Date(subscription.expiryDate);
      const lunarExpiry = lunarCalendar.solar2lunar(expiryDateObj.getFullYear(), expiryDateObj.getMonth() + 1, expiryDateObj.getDate());
      lunarExpiryText = lunarExpiry ? ` (農曆: ${lunarExpiry.fullStr})` : '';
    }

    const commonContent = `**訂閱詳情**:\n- **類型**: ${subscription.customType || '其他'}\n- **到期日**: ${formatTaipeiTime(new Date(subscription.expiryDate), 'date')}${lunarExpiryText}\n- **備註**: ${subscription.notes || '無'}`;

    // 使用多頻道傳送
    await sendNotificationToAllChannels(title, commonContent, config, '[手動測試]');

    return { success: true, message: '測試通知已傳送到所有啟用的頻道' };

  } catch (error) {
    console.error('[手動測試] 傳送失敗:', error);
    return { success: false, message: '傳送時發生錯誤: ' + error.message };
  }
}

async function sendWebhookNotification(title, content, config) {
  try {
    if (!config.WEBHOOK_URL) {
      console.error('[企業微信應用程式通知] 通知未設定，缺少URL');
      return false;
    }

    console.log('[企業微信應用程式通知] 開始傳送通知到: ' + config.WEBHOOK_URL);

    const timestamp = formatTaipeiTime(new Date(), 'datetime');
    let requestBody;
    let headers = { 'Content-Type': 'application/json' };

    // 處理自訂請求頭
    if (config.WEBHOOK_HEADERS) {
      try {
        const customHeaders = JSON.parse(config.WEBHOOK_HEADERS);
        headers = { ...headers, ...customHeaders };
      } catch (error) {
        console.warn('[企業微信應用程式通知] 自訂請求頭格式錯誤，使用預設請求頭');
      }
    }

    // 處理訊息範本
    if (config.WEBHOOK_TEMPLATE) {
      try {
        const template = JSON.parse(config.WEBHOOK_TEMPLATE);
        requestBody = JSON.stringify(template)
          .replace(/\{\{title\}\}/g, title)
          .replace(/\{\{content\}\}/g, content)
          .replace(/\{\{timestamp\}\}/g, timestamp);
        requestBody = JSON.parse(requestBody);
      } catch (error) {
        console.warn('[企業微信應用程式通知] 訊息範本格式錯誤，使用預設格式');
        requestBody = { title, content, timestamp };
      }
    } else {
      requestBody = { title, content, timestamp };
    }

    const response = await fetch(config.WEBHOOK_URL, {
      method: config.WEBHOOK_METHOD || 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    const result = await response.text();
    console.log('[企業微信應用程式通知] 傳送結果:', response.status, result);
    return response.ok;
  } catch (error) {
    console.error('[企業微信應用程式通知] 傳送通知失敗:', error);
    return false;
  }
}

async function sendWeComNotification(message, config) {
    // This is a placeholder. In a real scenario, you would implement the WeCom notification logic here.
    console.log("[企業微信] 通知功能未實作");
    return { success: false, message: "企業微信通知功能未實作" };
}

async function sendWechatBotNotification(title, content, config) {
  try {
    if (!config.WECHATBOT_WEBHOOK) {
      console.error('[企業微信機器人] 通知未設定，缺少Webhook URL');
      return false;
    }

    console.log('[企業微信機器人] 開始傳送通知到: ' + config.WECHATBOT_WEBHOOK);

    // 建構訊息內容
    let messageData;
    const msgType = config.WECHATBOT_MSG_TYPE || 'text';

    if (msgType === 'markdown') {
      // Markdown 訊息格式
      const markdownContent = `# ${title}\n\n${content}`;
      messageData = {
        msgtype: 'markdown',
        markdown: {
          content: markdownContent
        }
      };
    } else {
      // 文字訊息格式
      const textContent = `${title}\n\n${content}`;
      messageData = {
        msgtype: 'text',
        text: {
          content: textContent
        }
      };
    }

    // 處理@功能
    if (config.WECHATBOT_AT_ALL === 'true') {
      // @所有人
      if (msgType === 'text') {
        messageData.text.mentioned_list = ['@all'];
      }
    } else if (config.WECHATBOT_AT_MOBILES) {
      // @指定手機號碼
      const mobiles = config.WECHATBOT_AT_MOBILES.split(',').map(m => m.trim()).filter(m => m);
      if (mobiles.length > 0) {
        if (msgType === 'text') {
          messageData.text.mentioned_mobile_list = mobiles;
        }
      }
    }

    console.log('[企業微信機器人] 傳送訊息資料:', JSON.stringify(messageData, null, 2));

    const response = await fetch(config.WECHATBOT_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });

    const responseText = await response.text();
    console.log('[企業微信機器人] 響應狀態:', response.status);
    console.log('[企業微信機器人] 響應內容:', responseText);

    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        if (result.errcode === 0) {
          console.log('[企業微信機器人] 通知傳送成功');
          return true;
        } else {
          console.error('[企業微信機器人] 傳送失敗，錯誤碼:', result.errcode, '錯誤訊息:', result.errmsg);
          return false;
        }
      } catch (parseError) {
        console.error('[企業微信機器人] 解析響應失敗:', parseError);
        return false;
      }
    } else {
      console.error('[企業微信機器人] HTTP請求失敗，狀態碼:', response.status);
      return false;
    }
  } catch (error) {
    console.error('[企業微信機器人] 傳送通知失敗:', error);
    return false;
  }
}

async function sendNotificationToAllChannels(title, commonContent, config, logPrefix = '[定時任務]') {
    if (!config.ENABLED_NOTIFIERS || config.ENABLED_NOTIFIERS.length === 0) {
        console.log(`${logPrefix} 未啟用任何通知頻道。`);
        return;
    }

    if (config.ENABLED_NOTIFIERS.includes('notifyx')) {
        const notifyxContent = `## ${title}\n\n${commonContent}`;
        const success = await sendNotifyXNotification(title, notifyxContent, `訂閱提醒`, config);
        console.log(`${logPrefix} 傳送NotifyX通知 ${success ? '成功' : '失敗'}`);
    }
    if (config.ENABLED_NOTIFIERS.includes('telegram')) {
        const telegramContent = `*${title}*\n\n${commonContent.replace(/(\s)/g, ' ')}`;
        const success = await sendTelegramNotification(telegramContent, config);
        console.log(`${logPrefix} 傳送Telegram通知 ${success ? '成功' : '失敗'}`);
    }
    if (config.ENABLED_NOTIFIERS.includes('webhook')) {
        const webhookContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
        const success = await sendWebhookNotification(title, webhookContent, config);
        console.log(`${logPrefix} 傳送企業微信應用程式通知 ${success ? '成功' : '失敗'}`);
    }
    if (config.ENABLED_NOTIFIERS.includes('wechatbot')) {
        const wechatbotContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
        const success = await sendWechatBotNotification(title, wechatbotContent, config);
        console.log(`${logPrefix} 傳送企業微信機器人通知 ${success ? '成功' : '失敗'}`);
    }
    if (config.ENABLED_NOTIFIERS.includes('weixin')) {
        const weixinContent = `【${title}】\n\n${commonContent.replace(/(\**|\*|##|#|`)/g, '')}`;
        const result = await sendWeComNotification(weixinContent, config);
        console.log(`${logPrefix} 傳送企業微信通知 ${result.success ? '成功' : '失敗'}. ${result.message}`);
    }
    if (config.ENABLED_NOTIFIERS.includes('email')) {
        const emailContent = commonContent.replace(/(\**|\*|##|#|`)/g, '');
        const success = await sendEmailNotification(title, emailContent, config);
        console.log(`${logPrefix} 傳送郵件通知 ${success ? '成功' : '失敗'}`);
    }
}

async function sendTelegramNotification(message, config) {
  try {
    if (!config.TG_BOT_TOKEN || !config.TG_CHAT_ID) {
      console.error('[Telegram] 通知未設定，缺少Bot Token或Chat ID');
      return false;
    }

    console.log('[Telegram] 開始傳送通知到 Chat ID: ' + config.TG_CHAT_ID);

    const url = 'https://api.telegram.org/bot' + config.TG_BOT_TOKEN + '/sendMessage';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.TG_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    console.log('[Telegram] 傳送結果:', result);
    return result.ok;
  } catch (error) {
    console.error('[Telegram] 傳送通知失敗:', error);
    return false;
  }
}

async function sendNotifyXNotification(title, content, description, config) {
  try {
    if (!config.NOTIFYX_API_KEY) {
      console.error('[NotifyX] 通知未設定，缺少API Key');
      return false;
    }

    console.log('[NotifyX] 開始傳送通知: ' + title);

    const url = 'https://www.notifyx.cn/api/v1/send/' + config.NOTIFYX_API_KEY;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        content: content,
        description: description || ''
      })
    });

    const result = await response.json();
    console.log('[NotifyX] 傳送結果:', result);
    return result.status === 'queued';
  } catch (error) {
    console.error('[NotifyX] 傳送通知失敗:', error);
    return false;
  }
}

async function sendEmailNotification(title, content, config) {
  try {
    if (!config.RESEND_API_KEY || !config.EMAIL_FROM || !config.EMAIL_TO) {
      console.error('[郵件通知] 通知未設定，缺少必要參數');
      return false;
    }

    console.log('[郵件通知] 開始傳送郵件到: ' + config.EMAIL_TO);

    // 產生HTML郵件內容
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px 20px; }
        .content h2 { color: #333; margin-top: 0; }
        .content p { color: #666; line-height: 1.6; margin: 16px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .highlight { background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 ${title}</h1>
        </div>
        <div class="content">
            <div class="highlight">
                ${content.replace(/\n/g, '<br>')}
            </div>
            <p>此郵件由訂閱管理系統自動傳送，請及時處理相關訂閱事務。</p>
        </div>
        <div class="footer">
            <p>訂閱管理系統 | 傳送時間: ${formatTaipeiTime()}</p>
        </div>
    </div>
</body>
</html>`;

    const fromEmail = config.EMAIL_FROM_NAME ?
      `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM}>` :
      config.EMAIL_FROM;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: config.EMAIL_TO,
        subject: title,
        html: htmlContent,
        text: content // 純文字備用
      })
    });

    const result = await response.json();
    console.log('[郵件通知] 傳送結果:', response.status, result);

    if (response.ok && result.id) {
      console.log('[郵件通知] 郵件傳送成功，ID:', result.id);
      return true;
    } else {
      console.error('[郵件通知] 郵件傳送失敗:', result);
      return false;
    }
  } catch (error) {
    console.error('[郵件通知] 傳送郵件失敗:', error);
    return false;
  }
}

async function sendNotification(title, content, description, config) {
  if (config.NOTIFICATION_TYPE === 'notifyx') {
    return await sendNotifyXNotification(title, content, description, config);
  } else {
    return await sendTelegramNotification(content, config);
  }
}

// 定時檢查即將到期的訂閱 - 完全優化版
async function checkExpiringSubscriptions(env) {
  try {
    const now = new Date();
    const taipeiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    console.log('[定時任務] 開始檢查即將到期的訂閱 UTC: ' + now.toISOString() + ', 台北時間: ' + taipeiTime.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'}));

    const subscriptions = await getAllSubscriptions(env);
    console.log('[定時任務] 共找到 ' + subscriptions.length + ' 個訂閱');

    const config = await getConfig(env);
    const expiringSubscriptions = [];
    const updatedSubscriptions = [];
    let hasUpdates = false;

    for (const subscription of subscriptions) {
      if (subscription.isActive === false) {
        console.log('[定時任務] 訂閱 "' + subscription.name + '" 已停用，跳過');
        continue;
      }

      const expiryDate = new Date(subscription.expiryDate);
      const daysDiff = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      console.log('[定時任務] 訂閱 "' + subscription.name + '" 到期日期: ' + expiryDate.toISOString() + ', 剩餘天數: ' + daysDiff);

      // 修復提前提醒天數邏輯
      const reminderDays = subscription.reminderDays !== undefined ? subscription.reminderDays : 7;
      let shouldRemind = false;

      if (reminderDays === 0) {
        // 當提前提醒天數為0時，只在到期日當天提醒
        shouldRemind = daysDiff === 0;
      } else {
        // 當提前提醒天數大於0時，在指定範圍內提醒
        shouldRemind = daysDiff >= 0 && daysDiff <= reminderDays;
      }

      // 如果已過期，且設定了週期和自動續訂，則自動更新到下一個週期
      if (daysDiff < 0 && subscription.periodValue && subscription.periodUnit && subscription.autoRenew !== false) {
        console.log('[定時任務] 訂閱 "' + subscription.name + '" 已過期且啟用自動續訂，正在更新到下一個週期');

        const newExpiryDate = new Date(expiryDate);

        if (subscription.periodUnit === 'day') {
          newExpiryDate.setDate(expiryDate.getDate() + subscription.periodValue);
        } else if (subscription.periodUnit === 'month') {
          newExpiryDate.setMonth(expiryDate.getMonth() + subscription.periodValue);
        } else if (subscription.periodUnit === 'year') {
          newExpiryDate.setFullYear(expiryDate.getFullYear() + subscription.periodValue);
        }

        while (newExpiryDate < now) {
          console.log('[定時任務] 新計算的到期日期 ' + newExpiryDate.toISOString() + ' 仍然過期，繼續計算下一個週期');

          if (subscription.periodUnit === 'day') {
            newExpiryDate.setDate(newExpiryDate.getDate() + subscription.periodValue);
          } else if (subscription.periodUnit === 'month') {
            newExpiryDate.setMonth(newExpiryDate.getMonth() + subscription.periodValue);
          } else if (subscription.periodUnit === 'year') {
            newExpiryDate.setFullYear(newExpiryDate.getFullYear() + subscription.periodValue);
          }
        }

        console.log('[定時任務] 訂閱 "' + subscription.name + '" 更新到期日期: ' + newExpiryDate.toISOString());

        const updatedSubscription = { ...subscription, expiryDate: newExpiryDate.toISOString() };
        updatedSubscriptions.push(updatedSubscription);
        hasUpdates = true;

        const newDaysDiff = Math.ceil((newExpiryDate - now) / (1000 * 60 * 60 * 24));

        let shouldRemindAfterRenewal = false;
        if (reminderDays === 0) {
          shouldRemindAfterRenewal = newDaysDiff === 0;
        } else {
          shouldRemindAfterRenewal = newDaysDiff >= 0 && newDaysDiff <= reminderDays;
        }

        if (shouldRemindAfterRenewal) {
          console.log('[定時任務] 訂閱 "' + subscription.name + '" 在提醒範圍內，將傳送通知');
          expiringSubscriptions.push({
            ...updatedSubscription,
            daysRemaining: newDaysDiff
          });
        }
      } else if (daysDiff < 0 && subscription.autoRenew === false) {
        console.log('[定時任務] 訂閱 "' + subscription.name + '" 已過期且未啟用自動續訂，將傳送過期通知');
        expiringSubscriptions.push({
          ...subscription,
          daysRemaining: daysDiff
        });
      } else if (shouldRemind) {
        console.log('[定時任務] 訂閱 "' + subscription.name + '" 在提醒範圍內，將傳送通知');
        expiringSubscriptions.push({
          ...subscription,
          daysRemaining: daysDiff
        });
      }
    }

    if (hasUpdates) {
      console.log('[定時任務] 有 ' + updatedSubscriptions.length + ' 個訂閱需要更新到下一個週期');

      const mergedSubscriptions = subscriptions.map(sub => {
        const updated = updatedSubscriptions.find(u => u.id === sub.id);
        return updated || sub;
      });

      await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(mergedSubscriptions));
      console.log('[定時任務] 已更新訂閱列表');
    }

    if (expiringSubscriptions.length > 0) {
      console.log('[定時任務] 有 ' + expiringSubscriptions.length + ' 個訂閱需要傳送通知');

      let commonContent = '';
      expiringSubscriptions.sort((a, b) => a.daysRemaining - b.daysRemaining);

      // 檢查是否顯示農曆（從設定中獲取，預設不顯示）
      const showLunar = config.SHOW_LUNAR === true;

      for (const sub of expiringSubscriptions) {
        const typeText = sub.customType || '其他';
        const periodText = (sub.periodValue && sub.periodUnit) ? `(週期: ${sub.periodValue} ${ { day: '天', month: '月', year: '年' }[sub.periodUnit] || sub.periodUnit})` : '';

        let lunarExpiryText = '';
        if (showLunar) {
          // 計算農曆日期
          const expiryDateObj = new Date(sub.expiryDate);
          const lunarExpiry = lunarCalendar.solar2lunar(expiryDateObj.getFullYear(), expiryDateObj.getMonth() + 1, expiryDateObj.getDate());
          lunarExpiryText = lunarExpiry ? ` (農曆: ${lunarExpiry.fullStr})` : '';
        }

        let statusText;
        if (sub.daysRemaining === 0) statusText = `⚠️ **${sub.name}** (${typeText}) ${periodText} 今天到期！${lunarExpiryText}`;
        else if (sub.daysRemaining < 0) statusText = `🚨 **${sub.name}** (${typeText}) ${periodText} 已過期 ${Math.abs(sub.daysRemaining)} 天${lunarExpiryText}`;
        else statusText = `📅 **${sub.name}** (${typeText}) ${periodText} 將在 ${sub.daysRemaining} 天後到期${lunarExpiryText}`;

        if (sub.notes) statusText += `\n   備註: ${sub.notes}`;
        commonContent += statusText + '\n\n';
      }

      const title = '訂閱到期提醒';
      await sendNotificationToAllChannels(title, commonContent, config, '[定時任務]');

    } else {
      console.log('[定時任務] 沒有需要提醒的訂閱');
    }

    console.log('[定時任務] 檢查完成');
  } catch (error) {
    console.error('[定時任務] 檢查即將到期的訂閱失敗:', error);
  }
}

function getCookieValue(cookieString, key) {
  if (!cookieString) return null;

  const match = cookieString.match(new RegExp('(^| )' + key + '=([^;]+)'));
  return match ? match[2] : null;
}

async function handleRequest(request, env, ctx) {
  return new Response(loginPage, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

const CryptoJS = {
  HmacSHA256: function(message, key) {
    const keyData = new TextEncoder().encode(key);
    const messageData = new TextEncoder().encode(message);

    return Promise.resolve().then(() => {
      return crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: {name: "SHA-256"} },
        false,
        ["sign"]
      );
    }).then(cryptoKey => {
      return crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        messageData
      );
    }).then(buffer => {
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
  }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 新增偵錯頁面
    if (url.pathname === '/debug') {
      try {
        const config = await getConfig(env);
        const debugInfo = {
          timestamp: new Date().toISOString(),
          pathname: url.pathname,
          kvBinding: !!env.SUBSCRIPTIONS_KV,
          configExists: !!config,
          adminUsername: config.ADMIN_USERNAME,
          hasJwtSecret: !!config.JWT_SECRET,
          jwtSecretLength: config.JWT_SECRET ? config.JWT_SECRET.length : 0
        };

        return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>偵錯資訊</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #f5f5f5; }
    .info { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .success { color: green; }
    .error { color: red; }
  </style>
</head>
<body>
  <h1>系統偵錯資訊</h1>
  <div class="info">
    <h3>基本資訊</h3>
    <p>時間: ${debugInfo.timestamp}</p>
    <p>路徑: ${debugInfo.pathname}</p>
    <p class="${debugInfo.kvBinding ? 'success' : 'error'}">KV綁定: ${debugInfo.kvBinding ? '✓' : '✗'}</p>
  </div>

  <div class="info">
    <h3>設定資訊</h3>
    <p class="${debugInfo.configExists ? 'success' : 'error'}">設定存在: ${debugInfo.configExists ? '✓' : '✗'}</p>
    <p>管理員使用者名稱: ${debugInfo.adminUsername}</p>
    <p class="${debugInfo.hasJwtSecret ? 'success' : 'error'}">JWT金鑰: ${debugInfo.hasJwtSecret ? '✓' : '✗'} (長度: ${debugInfo.jwtSecretLength})</p>
  </div>

  <div class="info">
    <h3>解決方案</h3>
    <p>1. 確保KV命名空間已正確綁定為 SUBSCRIPTIONS_KV</p>
    <p>2. 嘗試存取 <a href="/">/</a> 進行登入</p>
    <p>3. 如果仍有問題，請檢查Cloudflare Workers日誌</p>
  </div>
</body>
</html>`, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } catch (error) {
        return new Response(`偵錯頁面錯誤: ${error.message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    }

    if (url.pathname.startsWith('/api')) {
      return api.handleRequest(request, env, ctx);
    } else if (url.pathname.startsWith('/admin')) {
      return admin.handleRequest(request, env, ctx);
    } else {
      return handleRequest(request, env, ctx);
    }
  },

  async scheduled(event, env, ctx) {
    const now = new Date();
    const taipeiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    console.log('[Workers] 定時任務觸發 UTC:', now.toISOString(), '台北時間:', taipeiTime.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'}));
    await checkExpiringSubscriptions(env);
  }
};
