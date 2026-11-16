// 把 archery-quiz.html 打包成單一檔案（three.js + GLTFLoader + Ranger GLB 全部內嵌）
const fs = require('fs');
const dir = 'C:\\Users\\kth\\Documents\\Website\\Archer_study';
const rd = f => fs.readFileSync(dir + '\\' + f, 'utf8');

let html = rd('archery-quiz.html');
const three = rd('three.min.js');
const loader = rd('lib\\GLTFLoader.js');
const glb = rd('ranger_glb.js');

// 內嵌進 <script> 前，確認沒有會提早關閉標籤的字串
for (const [name, src] of [['three', three], ['loader', loader], ['glb', glb]]) {
  if (/<\/script/i.test(src)) throw new Error(name + ' 含 </script，需要額外轉義');
  if (/<!--/.test(src)) console.warn('警告：' + name + ' 含 <!--');
}

const before = html.length;

// 1) 移除 unpkg 後備載入整個 script 區塊
html = html.replace(/<script>(?:(?!<\/script>)[\s\S])*unpkg[\s\S]*?<\/script>\s*/i, '');

// 2) 內嵌三個外部檔案
html = html.split('<script src="three.min.js"></script>').join('<script>\n' + three + '\n</script>');
html = html.split('<script src="lib/GLTFLoader.js"></script>').join('<script>\n' + loader + '\n</script>');
html = html.split('<script src="ranger_glb.js"></script>').join('<script>\n' + glb + '\n</script>');

// 3) 標題與開發版保持一致（不再加「單檔版」註記）

// 4) 單檔版首屏：1.3MB 解析期間先畫一個載入畫面（不然前 5-10 秒是全白）
//    pointer-events:none 係保險：就算刪唔走都唔可以食掉點擊（iPhone/iPad 會出現「按唔到」）
html = html.replace(/(<body[^>]*>)/i,
  '$1' +
  '<div id="boot0" style="position:fixed;inset:0;z-index:999;pointer-events:none;display:grid;place-items:center;' +
  'background:radial-gradient(circle at 50% 42%,#fff8e6,#f4e5c4 58%,#e7d1a6);' +
  'font:700 22px/1.6 system-ui,-apple-system,\'PingFang HK\',\'Microsoft JhengHei\',sans-serif;color:#7a5a1e">' +
  '射箭答題 · 正在載入…</div>') ;
html = html.replace(/<\/body>/i,
  '<script>var b0=document.getElementById("boot0");if(b0&&b0.parentNode)b0.parentNode.removeChild(b0);<\/script></body>');

if (/src="[^"]*\.js"/.test(html)) throw new Error('仍有外部 script 引用未內嵌');

fs.writeFileSync(dir + '\\archery-single.html', html);
console.log('OK ' + (html.length / 1048576).toFixed(2) + ' MB（原 ' + (before / 1024).toFixed(0) + ' KB）');
