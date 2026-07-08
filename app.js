// ===== 简化版 - 直接调用第三方 API，无需后端 =====

const API_URL = 'https://api.wxshares.com/api/qsy/plus';
const API_KEY = 'puM4bNPd7nBIFcRXBUgvfutGzE';

// ===== Platform detection =====
const PLATFORMS = [
  { name: '抖音',     patterns: [/douyin\.com/, /v\.douyin/, /iesdouyin/] },
  { name: '小红书', patterns: [/xiaohongshu\.com/, /xhslink\.com/, /xhs\.link/] },
  { name: '微博',     patterns: [/weibo\.com/, /weibo\.cn/, /t\.cn/] },
  { name: '哔哩哔哩', patterns: [/bilibili\.com/, /b23\.tv/] },
  { name: '快手',     patterns: [/kuaishou\.com/, /gifshow\.com/, /v\.kuaishou/] },
  { name: 'TikTok',           patterns: [/tiktok\.com/] },
  { name: 'Instagram',        patterns: [/instagram\.com/, /instagr\.am/] },
  { name: 'Facebook',         patterns: [/facebook\.com/, /fb\.watch/] },
  { name: '微信视频号', patterns: [/channels\.weixin/, /视频号/] },
];

function detectPlatform(url) {
  for (const p of PLATFORMS) {
    if (p.patterns.some(r => r.test(url))) return p.name;
  }
  return null;
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s\u4e00-\u9fa5\uff0c\u3002\uff01\uff1f\u3001]+/g);
  return m ? m[0] : null;
}

// ===== DOM refs =====
const linkInput  = document.getElementById('linkInput');
const extractBtn = document.getElementById('extractBtn');
const btnText    = document.getElementById('btnText');
const btnArrow   = document.getElementById('btnArrow');
const btnLoader  = document.getElementById('btnLoader');
const resultCard = document.getElementById('resultCard');
const errorCard  = document.getElementById('errorCard');
const errorMsg   = document.getElementById('errorMsg');
const resultPlatform = document.getElementById('resultPlatform');
const resultMedia    = document.getElementById('resultMedia');
const resultInfo     = document.getElementById('resultInfo');
const dlVideoBtn = document.getElementById('dlVideoBtn');
const dlImgBtn   = document.getElementById('dlImgBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const pasteBtn   = document.getElementById('pasteBtn');

// Paste button
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    linkInput.value = text;
    linkInput.focus();
    showToast('已粘贴');
  } catch { linkInput.focus(); }
});

linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') extractBtn.click(); });

// Extract
extractBtn.addEventListener('click', async () => {
  const raw = linkInput.value.trim();
  if (!raw) { showError('请先粘贴分享链接'); return; }
  const url = extractUrl(raw) || raw;
  const platform = detectPlatform(url);
  if (!platform) { showError('暂不支持该链接，请粘贴抖音、小红书、微博、B站等平台的分享链接'); return; }
  setLoading(true);
  hideAll();
  await callApi(url, platform);
});

async function callApi(url, platform) {
  try {
    const body = new URLSearchParams({ key: API_KEY, url });
    const res  = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset:utf-8;' },
      body
    });
    
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    setLoading(false);

    if (json.code !== 200) {
      showError(json.msg || '解析失败，请检查链接是否正确');
      return;
    }
    renderResult(platform, json.data, url);
  } catch (err) {
    setLoading(false);
    showError('请求失败: ' + (err.message || '网络异常'));
  }
}

function renderResult(platform, data, originalUrl) {
  resultPlatform.textContent = platform;
  const hasPics  = data.pics && data.pics.length > 0;
  const hasVideo = !!data.url;

  if (hasVideo) {
    resultMedia.innerHTML = '<video controls playsinline preload="auto" poster="' + (data.photo || '') + '" style="width:100%;max-height:420px;border-radius:12px;background:#000;display:block"><source src="' + data.url + '" type="video/mp4"/></video>';
    dlVideoBtn.style.display = 'inline-flex';
    dlVideoBtn._href = data.url;
    dlVideoBtn._filename = 'video_' + Date.now() + '.mp4';
    dlImgBtn.style.display = 'none';
  } else if (hasPics) {
    const imgs = data.pics.map((src, i) =>
      '<div style="flex:0 0 auto;width:' + (data.pics.length === 1 ? '100%' : '48%') + '"><img src="' + src + '" alt="' + (i+1) + '" style="width:100%;border-radius:10px;display:block;cursor:pointer" onclick="window.open(\'' + src + '\')"/></div>'
    ).join('');
    resultMedia.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;width:100%">' + imgs + '</div>';
    dlImgBtn.style.display = 'inline-flex';
    dlImgBtn._pics = data.pics;
    dlVideoBtn.style.display = 'none';
  } else if (data.photo) {
    resultMedia.innerHTML = '<img src="' + data.photo + '" style="width:100%;max-height:420px;object-fit:contain;border-radius:12px;display:block"/>';
    dlImgBtn.style.display = 'inline-flex';
    dlImgBtn._pics = [data.photo];
    dlVideoBtn.style.display = 'none';
  } else {
    resultMedia.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">暂无预览</div>';
  }

  const title    = data.title ? '<div style="margin-bottom:6px;color:var(--text);font-weight:500">' + escHtml(data.title) + '</div>' : '';
  const musicLine = data.music ? '<a href="' + data.music + '" target="_blank" style="color:var(--primary);font-size:0.8rem">🎵 背景音乐</a> &nbsp;·&nbsp; ' : '';
  resultInfo.innerHTML = title + '<span style="color:var(--success);font-weight:600">✓ 水印已去除</span> &nbsp;·&nbsp; ' + musicLine + '来源：' + platform;

  copyLinkBtn._cleanUrl = data.url || (data.pics && data.pics[0]) || '';
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('✅ 提取成功，水印已去除');
}

// Copy clean link
copyLinkBtn.addEventListener('click', async () => {
  const url = copyLinkBtn._cleanUrl || linkInput.value.trim();
  try { await navigator.clipboard.writeText(url); showToast('无水印链接已复制'); }
  catch { showToast('复制失败'); }
});

// Download video
dlVideoBtn.addEventListener('click', () => {
  const url = dlVideoBtn._href;
  if (!url) return;
  const a = document.createElement('a');
  a.href = url; a.download = dlVideoBtn._filename || ('video_' + Date.now() + '.mp4');
  a.target = '_blank';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast('开始下载视频');
});

// Download images
dlImgBtn.addEventListener('click', () => {
  const pics = dlImgBtn._pics;
  if (!pics || !pics.length) return;
  pics.forEach((src, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = src; a.download = 'image_' + (i+1) + '_' + Date.now() + '.jpg';
      a.target = '_blank'; a.click();
    }, i * 300);
  });
  showToast('开始下载 ' + pics.length + ' 张图片');
});

// ===== Helpers =====
function setLoading(on) {
  extractBtn.disabled = on;
  btnText.style.display  = on ? 'none' : 'inline';
  btnArrow.style.display = on ? 'none' : 'inline';
  btnLoader.style.display = on ? 'flex' : 'none';
}
function showError(msg) {
  hideAll();
  errorMsg.innerHTML = msg;
  errorCard.style.display = 'flex';
}
function hideAll() {
  resultCard.style.display = 'none';
  errorCard.style.display  = 'none';
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== Toast =====
function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'28px', left:'50%', transform:'translateX(-50%)',
    background:'rgba(20,20,35,0.95)', backdropFilter:'blur(12px)',
    border:'1px solid rgba(167,139,250,0.25)', color:'#f1f0ff',
    padding:'12px 24px', borderRadius:'50px', fontSize:'0.88rem', fontWeight:'500',
    boxShadow:'0 8px 32px rgba(0,0,0,0.4)', zIndex:'9999', whiteSpace:'nowrap',
    animation:'slideUp 0.3s ease',
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ===== FAQ =====
function toggleFaq(btn) {
  const ans = btn.nextElementSibling;
  const isOpen = btn.classList.contains('open');
  document.querySelectorAll('.faq-q').forEach(q => {
    q.classList.remove('open');
    q.nextElementSibling.classList.remove('open');
  });
  if (!isOpen) { btn.classList.add('open'); ans.classList.add('open'); }
}

// ===== Scroll animation =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.style.opacity='1'; e.target.style.transform='translateY(0)'; }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.platform-card, .step-card, .faq-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(18px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});
