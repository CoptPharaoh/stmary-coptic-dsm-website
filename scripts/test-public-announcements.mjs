// Headless Chrome with anonymous contexts and mocked RPCs; never sends hosted requests.
// TEST_ORIGIN=http://127.0.0.1:4176 tests the actual development server instead.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(resolve(process.argv[2], 'playwright/index.mjs')));
const root = resolve(import.meta.dirname, '..');
await import('../js/parish-schedule.js');
const calendar = globalThis.parishSchedule;
const output = '/tmp/stmary-parish-life-review';
await mkdir(output, {recursive:true});
const server = createServer(async (req, res) => {
  try {
    const file = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + '/')) throw Error('Invalid path');
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.PNG': 'image/png', '.jpeg':'image/jpeg', '.jpg':'image/jpeg' };
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const origin = process.env.TEST_ORIGIN || `http://127.0.0.1:${server.address().port}`;
  let response = 'success', delay = 100;
  let title = 'Gather with our parish family';
  const fixtures = () => Array.from({length:4}, (_, i) => ({id:`fixture-${i}`, title:i ? ['','Serving together','A season of prayer','Parish news'][i] : title,
    summary:'Join our church community for prayer, fellowship, and opportunities to serve one another.',
    body:'We invite our parish family to gather in prayer and fellowship. Everyone is welcome, including those visiting St. Mary for the first time.\n\nPlease contact the parish office for details about upcoming gatherings and opportunities to serve.',
    title_ar:'أخبار عائلة الكنيسة', body_ar:'ندعو عائلة الكنيسة للاجتماع معًا للصلاة والشركة. نرحب بالجميع، بما في ذلك من يزور كنيسة القديسة مريم للمرة الأولى.\n\nيرجى التواصل مع مكتب الكنيسة للمزيد من المعلومات.',
    publish_at:`2026-11-${26-i}T12:00:00Z`, ministry_id:null, placement:'homepage'}));
  const errors = [];
  let unversionedRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  // Model a cache retaining the original asset URLs. Updated HTML must never ask for them.
  for (const asset of ['css/style.css','js/main.js','js/public-content.js']) {
    await page.route('**/'+asset, route => { unversionedRequests++; return route.abort(); });
  }
  await page.route('**/js/supabase-client.js', route => route.fulfill({contentType:'text/javascript', body:`export const withTimeout=p=>p; export async function getSupabase(){return {rpc:async name=>{const r=await fetch('/mock/'+name);if(!r.ok)throw Error('Network error');return {data:await r.json(),error:null};}};}`}));
  await page.route('**/mock/**', async route => {
    if (route.request().url().endsWith('published_announcements')) {
      const mode = response;
      await new Promise(resolve => setTimeout(resolve, delay));
      return route.fulfill({status:mode==='error'?503:200,contentType:'application/json',body:JSON.stringify(mode==='empty'?[]:fixtures())});
    }
    return route.fulfill({contentType:'application/json',body:JSON.stringify(calendar)});
  });
  await page.route('https://**/*', route => route.abort());
  const ready = () => page.locator('[data-state="success"]').waitFor();
  const bounds = selector => page.locator(selector).boundingBox();
  async function hiddenRetry() {
    assert.equal(await page.locator('#announcement-retry').isVisible(),false);
    assert.equal(await page.locator('#announcement-retry').evaluate(el=>getComputedStyle(el).display),'none');
  }
  for (const width of [1440,1024,768,390]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(origin+'/index.html'); await ready();
    await page.locator('[data-parish-upcoming] .event-item').first().waitFor();
    assert.equal(await page.locator('[data-parish-upcoming] .event-date').count(),5);
    assert.equal(await page.locator('.announcement-preview').count(),3);
    await hiddenRetry();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.locator('.nav-parent').filter({hasText:'Parish Life'}).count(),1);
    assert.equal(await page.locator('.nav-link').filter({hasText:/^Events$/}).count(),0);
    const resources = page.locator('.has-dropdown').filter({has:page.locator('.nav-parent',{hasText:'Resources'})});
    assert.equal(await resources.getByRole('link',{name:'Parish Announcements',exact:true}).count(),0);
    const welcome=await bounds('.welcome-card'), mission=await bounds('.mission-card');
    const news=await bounds('[data-announcements]'), events=await bounds('#events'), strip=await bounds('.info-strip');
    const icon=await bounds('.announcement-icon');
    assert.ok(icon.width<=32 && icon.height<=32);
    assert.ok(welcome.y>=strip.y+strip.height);
    assert.ok(welcome.height<mission.height,'Welcome must not stretch to match Mission');
    const gap = width>900 ? 28 : 24;
    assert.ok(Math.abs(mission.y-welcome.y-welcome.height-gap)<2,'Mission follows Welcome without row whitespace');
    assert.ok(Math.abs(events.y-news.y-news.height-gap)<2,'Events follow announcements without row whitespace');
    assert.deepEqual(await page.locator('.home-card-column').evaluateAll(cols=>cols.map(c=>getComputedStyle(c).flexDirection)),['column','column']);
    if(width>900){
      assert.ok(Math.abs(welcome.y-news.y)<2);
      assert.ok(news.x-(welcome.x+welcome.width)>=24);
      assert.ok(Math.abs(welcome.width-news.width)<2);
      const grid=await bounds('.home-dashboard');
      assert.ok(Math.abs(news.x+news.width-grid.x-grid.width)<2,'No empty third column');
      const eventY=events.y + await page.evaluate(()=>scrollY);
      await page.locator('.mission-accordion details').nth(1).locator('summary').click();
      assert.ok(Math.abs((await bounds('#events')).y + await page.evaluate(()=>scrollY) - eventY)<2,'Columns remain independent when Mission expands');
      await page.locator('.mission-accordion details').nth(1).locator('summary').click();
      await page.evaluate(()=>window.scrollTo(0,0));
    } else { assert.ok(news.y>=mission.y+mission.height+20,'Mobile order: Welcome, Mission, Announcements, Events'); }
    console.log('COMPUTED', width, await page.evaluate(()=>({
      gridA:getComputedStyle(document.querySelector('.home-dashboard')).gridTemplateColumns,
      columnDirection:getComputedStyle(document.querySelector('.home-parish-column')).flexDirection,
      icon:[getComputedStyle(document.querySelector('.announcement-icon')).width,getComputedStyle(document.querySelector('.announcement-icon')).height],
      retry:getComputedStyle(document.querySelector('#announcement-retry')).display
    })));
    assert.ok(await page.locator('#home-announcement-title').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<=26));
    const heading = await bounds('#home-announcement-title');
    assert.ok(heading.x>=news.x && heading.x+heading.width<=news.x+news.width);
    await page.waitForTimeout(250); // Allow navigation opacity transitions to settle before capture.
    if(width===1440) assert.ok(await page.locator('.dropdown-menu').evaluateAll(items=>items.every(el=>getComputedStyle(el).visibility==='hidden')));
    await page.screenshot({path:`${output}/home-${width}.png`});
    if(width===1440||width===390) await page.screenshot({path:`${output}/home-full-${width}.png`,fullPage:true,style:'.dropdown-menu { transition: none !important; }'});
    if(width===1440||width===390){
      await page.locator('.home-dashboard').screenshot({path:`${output}/welcome-mission-${width}.png`});
      await page.locator('.home-parish-column').screenshot({path:`${output}/parish-life-${width}.png`});
    }
    await page.locator('.announcement-preview a').first().click(); await ready();
    assert.ok(page.url().endsWith('#announcement-fixture-0'));
    assert.equal(await page.locator('.announcement-card').count(),4);
    assert.equal(await page.locator('.announcement-arabic[lang="ar"][dir="rtl"]').count(),4);
    const feed=await bounds('.announcement-feed'), card=await bounds('.announcement-card:first-child');
    assert.ok(feed.width>=Math.min(width-80,940),'Feed must not shrink to its content width');
    assert.ok(Math.abs(feed.x-(width-feed.width)/2)<2,'Feed centered');
    assert.ok(Math.abs(card.width-feed.width)<2);
    const ar=await bounds('.announcement-card:first-child .announcement-arabic');
    assert.ok(ar.x>card.x && ar.x+ar.width<card.x+card.width);
    assert.ok(await page.locator('.announcement-card').first().evaluate(el=>getComputedStyle(el).borderTopWidth==='3px'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await hiddenRetry();
    await page.goto(origin+'/announcements.html'); await ready();
    await page.waitForTimeout(250);
    await page.screenshot({path:`${output}/announcements-${width}.png`});
    if(width===1440||width===390) await page.screenshot({path:`${output}/announcements-full-${width}.png`,fullPage:true,style:'.dropdown-menu { transition: none !important; }'});
    if(width===1440||width===390) await page.locator('.announcement-card').first().screenshot({path:`${output}/full-announcement-${width}.png`});
    console.log('PASS actual layout, nav labels, no overflow, computed retry, anchors, Arabic, centered cards',width);
  }
  // Inspect each loading/error transition on BOTH public surfaces.
  for(const file of ['index.html','announcements.html']){
    response='success'; delay=1200; await page.goto(origin+'/'+file);
    await page.locator('[data-state="loading"]').waitFor(); await hiddenRetry(); await ready();
    response='error'; await page.reload();
    await page.locator('[data-state="error"]').waitFor();
    assert.equal(await page.locator('#announcement-retry').isVisible(),true);
    response='success'; await page.locator('#announcement-retry').click();
    await page.locator('[data-state="loading"]').waitFor(); await hiddenRetry(); await ready(); await hiddenRetry();
    assert.equal(await page.locator('#announcement-status').textContent(),'');
    response='empty'; await page.reload(); await page.locator('[data-state="empty"]').waitFor(); await hiddenRetry();
    assert.equal(await page.locator('[data-announcements]').isVisible(),true);
    response='success'; title='Updated without redeployment'; await page.reload(); await ready();
    assert.ok((await page.locator('#announcement-list').innerText()).includes(title));
    console.log('PASS loading/success/error/successful retry/empty/reload states',file);
  }
  delay=100; title='<img src=x onerror=alert(1)> Parish update'; await page.reload(); await ready();
  assert.equal(await page.locator('.announcement-card img').count(),0);
  assert.equal(await page.locator('.announcement-card h3').first().textContent(),title);
  await page.setViewportSize({width:1440,height:1000});
  const parish=page.locator('.has-dropdown').filter({has:page.locator('.nav-parent',{hasText:'Parish Life'})});
  await parish.locator('.nav-parent').hover();
  await parish.getByRole('link',{name:'Parish Calendar',exact:true}).waitFor({state:'visible'});
  await parish.locator('.nav-parent').focus();
  await parish.getByRole('link',{name:'Upcoming Events',exact:true}).click();
  await page.locator('[data-parish-month-events] article').first().waitFor();
  const before=await page.locator('#parish-month-title').textContent();
  await page.locator('[data-month-action="1"]').click();
  assert.notEqual(await page.locator('#parish-month-title').textContent(),before);
  await page.setViewportSize({width:390,height:1000});
  await page.locator('#menuToggle').click();
  await page.getByRole('button',{name:'Parish Life',exact:true}).click();
  await page.locator('.dropdown-menu').getByRole('link',{name:'Parish Announcements',exact:true}).click(); await ready();
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('menu-open')),false);
  assert.ok(await page.locator('.has-dropdown.active').filter({hasText:'Parish Life'}).count());
  await page.goto(origin+'/index.html'); await ready();
  await page.getByRole('link',{name:'View All Announcements',exact:true}).click(); await ready();
  assert.ok(page.url().endsWith('announcements.html'));
  for(const file of ['about.html','our-pope.html']){
    await page.goto(origin+'/'+file);
    assert.equal(await page.locator('.nav-parent').filter({hasText:'Parish Life'}).count(),1);
  }
  assert.deepEqual(errors,[]);
  assert.equal(unversionedRequests,0,'No requests for stale unversioned public assets');
  console.log('PASS XSS-safe rendering, desktop hover/keyboard, mobile accordion, View All, shared interior navigation, live calendar controls');
  console.log('Screenshots:',output);
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
