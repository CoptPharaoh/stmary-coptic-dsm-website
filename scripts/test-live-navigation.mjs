// Real local pages and real anonymous public reads. No forms, account changes or writes.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const origin='http://127.0.0.1:4176';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2],'playwright/index.mjs')));
let script;
let audited=0;
for(const file of (await readdir(root)).filter(n=>n.endsWith('.html'))){
 const disk=await readFile(resolve(root,file),'utf8');
 const r=await fetch(origin+'/'+file,{cache:'no-store'});
 assert.equal(r.status,200);assert.equal(await r.text(),disk);
 if(disk.includes('data-site-header')){
  const refs=[...disk.matchAll(/src="(js\/main\.js[^\"]*)"/g)];
  assert.equal(refs.length,1,file);
  script ||= refs[0][1];assert.equal(refs[0][1],script,file);
 }
 audited++;
}
console.log('PASS served bytes and one consistent shared script across',audited,'public HTML pages');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext();
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const parish=()=>page.locator('.has-dropdown').filter({has:page.locator('.nav-parent',{hasText:'Parish Life'})});
 async function checkMenu(){
  assert.equal(await parish().count(),1);
  assert.equal(await page.locator('.nav-link').filter({hasText:/^Events$/}).count(),0);
  assert.deepEqual(await parish().locator('.dropdown-menu a').allTextContents(),['Parish Announcements','Upcoming Events','Parish Calendar']);
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.goto(origin+'/index.html');await checkMenu();
  for(const [label,suffix] of [['Parish Announcements','announcements.html'],['Upcoming Events','events.html#upcoming-events'],['Parish Calendar','events.html#parish-calendar']]){
   if(width<1241){
    if(await page.locator('#menuToggle').getAttribute('aria-expanded')==='false')await page.locator('#menuToggle').click();
    await parish().getByRole('button',{name:'Parish Life',exact:true}).click();
   } else await parish().locator('.nav-parent').hover();
   await parish().getByRole('link',{name:label,exact:true}).click();
   assert.ok(page.url().endsWith(suffix));await checkMenu();
   assert.ok((await parish().getAttribute('class')).includes('active'));
   assert.deepEqual(await parish().locator('.dropdown-menu a.active').allTextContents(),[label]);
   if(width<1241)assert.equal(await parish().locator('.mobile-submenu-toggle').evaluate(el=>getComputedStyle(el).color),'rgb(240, 202, 122)');
   if(label==='Parish Announcements'){
    await page.locator('[data-state="success"], [data-state="empty"]').waitFor({timeout:35000});
    assert.equal(await page.locator('#announcement-retry').isVisible(),false);
   }else{
    await page.locator('[data-parish-month-events] .event-item').first().waitFor({timeout:35000});
   }
  }
  await page.screenshot({path:`/tmp/parish-navigation-${width}.png`});
  for(const file of ['about.html','our-pope.html','liturgical-calendar.html','resources.html','youth.html']){
   await page.goto(origin+'/'+file);await checkMenu();
  }
  console.log('PASS real desktop/mobile link navigation, active states, announcements and calendar',width);
 }
 // There are no nested public pages in the repo; exercise the actual shared code in a nested document.
 await page.route('**/__nav-test__/nested.html',r=>r.fulfill({contentType:'text/html',body:`<div data-site-header></div><div data-site-footer></div><script src="/${script}"></script>`}));
 await page.goto(origin+'/__nav-test__/nested.html');await checkMenu();
 for(const link of await parish().locator('.dropdown-menu a').all()){
  assert.ok((await link.getAttribute('href')).startsWith('/'));
  assert.equal((await fetch(new URL(await link.getAttribute('href'),origin))).status,200);
 }
 assert.equal(await page.locator('.brand img').getAttribute('src'),'/assets/images/logo-main.png');
 assert.equal(await page.locator('.footer a').filter({hasText:'Parish Calendar'}).getAttribute('href'),'/events.html#parish-calendar');
 assert.deepEqual(errors,[]);
 console.log('PASS nested shared-header/footer links and logo; no JavaScript page errors');
} finally {await browser.close();}
