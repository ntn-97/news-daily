// Đặt class dark trước khi vẽ để chế độ tối không nháy trắng; khoá phải khớp src/lib/theme.ts.
// Để file riêng (không viết thẳng trong index.html) vì trang của extension Chrome cấm script nội tuyến.
try {
  var t = localStorage.getItem('ban-tin-sang/theme')
  if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark')
} catch {}
