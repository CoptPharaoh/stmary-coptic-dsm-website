
(function(){
  function initMobileMenu(){
    var header = document.querySelector('.header');
    if(!header || header.dataset.mobileReady === '1') return;
    header.dataset.mobileReady = '1';

    var inner = header.querySelector('.header-inner') || header;
    var nav = header.querySelector('.nav');
    var actions = header.querySelector('.header-actions');

    var btn = document.createElement('button');
    btn.className = 'mobile-menu-button';
    btn.type = 'button';
    btn.setAttribute('aria-label','Open menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    inner.appendChild(btn);

    var drawer = document.createElement('div');
    drawer.className = 'mobile-drawer';

    if(nav){
      nav.querySelectorAll('a').forEach(function(a){
        var copy = a.cloneNode(true);
        drawer.appendChild(copy);
      });
    }

    var live = actions ? actions.querySelector('.live') : null;
    if(live){
      var liveCopy = live.cloneNode(true);
      liveCopy.classList.add('mobile-live');
      drawer.appendChild(liveCopy);
    }

    var socials = actions ? actions.querySelector('.socials') : null;
    var socialWrap = document.createElement('div');
    socialWrap.className = 'mobile-socials';

    if(socials){
      socials.querySelectorAll('a,span').forEach(function(item, index){
        var a = document.createElement('a');
        a.href = item.getAttribute && item.getAttribute('href') ? item.getAttribute('href') : '#';
        a.textContent = index === 0 ? 'f' : '◎';
        socialWrap.appendChild(a);
      });
      drawer.appendChild(socialWrap);
    }

    document.body.appendChild(drawer);

    btn.addEventListener('click', function(){
      document.body.classList.toggle('menu-open');
    });

    drawer.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        document.body.classList.remove('menu-open');
      });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  }else{
    initMobileMenu();
  }
})();



(function(){
  function initMobileMenu(){
    document.querySelectorAll('.mobile-menu-btn-site,.mobile-menu-panel-site,.mobile-menu-backdrop-site').forEach(function(el){el.remove();});
    document.body.classList.remove('site-menu-open');
    var header=document.querySelector('.header');
    if(!header) return;
    var inner=header.querySelector('.header-inner')||header;
    var nav=header.querySelector('.nav');
    var actions=header.querySelector('.header-actions');
    var btn=document.createElement('button');
    btn.className='mobile-menu-btn-site';
    btn.type='button';
    btn.setAttribute('aria-label','Open menu');
    btn.setAttribute('aria-expanded','false');
    btn.innerHTML='<span></span><span></span><span></span>';
    inner.appendChild(btn);
    var backdrop=document.createElement('div');
    backdrop.className='mobile-menu-backdrop-site';
    var panel=document.createElement('nav');
    panel.className='mobile-menu-panel-site';
    panel.setAttribute('aria-label','Mobile menu');
    if(nav && nav.querySelectorAll('a').length){
      nav.querySelectorAll('a').forEach(function(a){panel.appendChild(a.cloneNode(true));});
    }else{
      [['Home','index.html'],['About','about.html'],["I'm New Here",'#'],['Services','#'],['Schedule','#'],['Events','#'],['Book Appointment','#'],['Contact','#']].forEach(function(x){var a=document.createElement('a');a.textContent=x[0];a.href=x[1];panel.appendChild(a);});
    }
    var live=actions?actions.querySelector('a.live,a[href*=live],a'):null;
    var liveA=document.createElement('a');
    liveA.className='mobile-live-site';
    liveA.textContent=live?(live.textContent||'Live Stream').trim():'Live Stream';
    liveA.href=live?(live.getAttribute('href')||'#'):'#';
    panel.appendChild(liveA);
    var social=document.createElement('div');
    social.className='mobile-social-row-site';
    var fb=document.createElement('a');fb.href='#';fb.textContent='f';fb.setAttribute('aria-label','Facebook');
    var ig=document.createElement('a');ig.href='#';ig.textContent='◎';ig.setAttribute('aria-label','Instagram');
    social.appendChild(fb);social.appendChild(ig);panel.appendChild(social);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    function close(){document.body.classList.remove('site-menu-open');btn.setAttribute('aria-expanded','false');}
    function toggle(){var open=document.body.classList.toggle('site-menu-open');btn.setAttribute('aria-expanded',open?'true':'false');}
    btn.addEventListener('click',toggle);
    backdrop.addEventListener('click',close);
    panel.querySelectorAll('a').forEach(function(a){a.addEventListener('click',close);});
    window.addEventListener('resize',function(){if(window.innerWidth>820)close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMobileMenu);else initMobileMenu();
})();



(function(){
  function init(){
    document.body.classList.remove('mobile-menu-open-real');
    var btn=document.querySelector('.mobile-nav-toggle-real');
    var panel=document.querySelector('.mobile-menu-panel-real');
    var backdrop=document.querySelector('.mobile-menu-backdrop-real');
    if(!btn||!panel||!backdrop) return;
    function close(){document.body.classList.remove('mobile-menu-open-real');btn.setAttribute('aria-expanded','false');}
    function toggle(){var open=document.body.classList.toggle('mobile-menu-open-real');btn.setAttribute('aria-expanded',open?'true':'false');}
    btn.onclick=toggle;
    backdrop.onclick=close;
    panel.querySelectorAll('a').forEach(function(a){a.addEventListener('click',close);});
    window.addEventListener('resize',function(){if(window.innerWidth>820) close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape') close();});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
