const fs = require('node:fs');
const assert = require('node:assert/strict');
// Run with Playwright installed; CHROMIUM_PATH can point to a local Chromium binary.
// Optional: PLAYWRIGHT_MODULE, CONTENT_SCRIPT_PATH and TOOLBAR_TEST_SCREENSHOT.
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sourcePath = process.env.CONTENT_SCRIPT_PATH || path.resolve(__dirname, '../content.js');
const fixture = `<!doctype html><html><head><meta charset="utf-8"><title>Local toolbar regression</title><style>
html,body { margin:0; height:100%; font:20px/1.8 Arial; }
body { position:relative; overflow:hidden; }
main { height:100vh; overflow:auto; }
article { padding:200px 100px 1000px; }
#other { position:fixed; right:0; bottom:0; width:30px; height:30px; overflow:auto; }
#other div { height:100px; }
#native { position:fixed; left:100px; top:146px; height:42px; background:#eee; padding:0 18px; border:1px solid #ccc; border-radius:12px; }
#native button { font:inherit; border:0; background:none; }
</style></head><body><main><article><p id="selection">这是用于验证工具条显示、滚动和点击的本地测试文本。</p><p>第二段文本用于多行选择。</p></article></main><div id="native"><button>询问 ChatGPT</button><button>分享所选内容</button></div><div id="other"><div></div></div></body></html>`;

async function setup(page, source) {
  await page.route('**/*', route => route.fulfill({ contentType:'text/html', body:fixture }));
  await page.goto('https://toolbar-test.chatgpt.com/c/local-toolbar-regression');
  // Comet's startup may reload newly opened pages once. Inject after it settles.
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const data = {};
    window.__testData = data;
    const storage = {
      get(keys, cb) {
        const result = keys == null ? {...data} : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k,data[k]]));
        if (cb) queueMicrotask(() => cb(result));
        return Promise.resolve(result);
      },
      set(value, cb) { Object.assign(data,value); if(cb) queueMicrotask(cb); return Promise.resolve(); },
      remove(keys, cb) { for(const key of [].concat(keys)) delete data[key]; if(cb) queueMicrotask(cb); return Promise.resolve(); }
    };
    window.chrome = { storage:{ local:storage, sync:storage, onChanged:{addListener(){}} }, runtime:{ onMessage:{addListener(){}}, sendMessage(){return Promise.resolve();} } };
  });
  await page.addScriptTag({content:source});
  await page.waitForFunction(() => window.__highlightCatInitialized);
}
async function select(page) {
  await page.evaluate(() => {
    const range=document.createRange();
    range.selectNodeContents(document.querySelector('#selection'));
    const selection=getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.querySelector('#selection').dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  });
  await page.locator('#hl-cat-toolbar').waitFor({state:'visible'});
}
async function status(page) {
  return page.evaluate(() => {
    const bar=document.querySelector('#hl-cat-toolbar');
    if(!bar) return {exists:false, time:performance.now(), initialized:window.__highlightCatInitialized};
    const r=bar.getBoundingClientRect();
    const native=document.querySelector('#native').getBoundingClientRect();
    return {exists:true, time:performance.now(), visible:getComputedStyle(bar).visibility, x:r.x,y:r.y,width:r.width,height:r.height,
      inside:r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight,
      nativeGap:r.left-native.right,
      nativeCenterOffset:(r.top+r.bottom-native.top-native.bottom)/2,
      hit:!!document.elementFromPoint(r.left+20,r.top+20)?.closest('#hl-cat-toolbar'),
      overlap: r.left<native.right && r.right>native.left && r.top<native.bottom && r.bottom>native.top};
  });
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:800}});
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    const source=fs.readFileSync(sourcePath,'utf8');
    await setup(page,source);
    await select(page);
    const initial=await status(page);
    await page.evaluate(()=>document.querySelector('#other').scrollTop=20);
    await page.waitForTimeout(250);
    const unrelatedScroll=await status(page);
    await select(page);
    await page.waitForTimeout(1800);
    const after1800ms=await status(page);
    const report={initial,unrelatedScroll,after1800ms,errors};
    {
      assert.ok(initial.inside && initial.hit && !initial.overlap,'initial toolbar visible, clickable and separated');
      assert.ok(initial.nativeGap >= 8 && initial.nativeGap <= 16,'toolbar sits closely beside the native menu');
      assert.ok(Math.abs(initial.nativeCenterOffset) <= 2,'both toolbars align on the same row');
      assert.ok(unrelatedScroll.exists && unrelatedScroll.hit,'unrelated scroll must not remove toolbar');
      assert.ok(after1800ms.exists && after1800ms.hit,'toolbar must remain usable after 1.8 seconds');
      await page.locator('[data-color="yellow"]').click();
      await page.locator('span[data-hl-id]').first().waitFor();
      report.highlight=await page.locator('span[data-hl-id]').allTextContents();
      assert.ok(report.highlight.join('').includes('本地测试文本'),'real button click creates a highlight');
      await select(page);
      await page.evaluate(()=>document.querySelector('main').scrollTop=80);
      await page.waitForTimeout(200);
      report.selectionScroll=await status(page);
      assert.ok(report.selectionScroll.exists && report.selectionScroll.hit,'toolbar survives selection-container scroll');
      await page.setViewportSize({width:375,height:700});
      await page.waitForTimeout(200);
      report.narrow=await status(page);
      assert.ok(report.narrow.inside,'narrow viewport keeps toolbar inside');
      await page.setViewportSize({width:1100,height:800});
      await select(page);
      if (process.env.TOOLBAR_TEST_SCREENSHOT) {
        await page.screenshot({path:process.env.TOOLBAR_TEST_SCREENSHOT});
      }
      await page.mouse.move(10,10);
      await page.waitForTimeout(3200);
      report.after3200ms=await status(page);
      assert.equal(report.after3200ms.exists,false,'toolbar auto-hides after 3 seconds');
      assert.deepEqual(errors,[],'full content script must not throw');
    }
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
