import {firebaseConfig,storeDefaults,team,doctor} from './firebase-config.js';
import {T,CATS,GROUPS,GOVS} from './i18n.js';
const CFG=!firebaseConfig.apiKey.startsWith('YOUR');
let fb={},auth=null,db=null,fn=null,user=null,PRODUCTS=[],store={...storeDefaults};
const MAXC=4;let authReady=!CFG;
let lang=localStorage.getItem('tz_lang')||'ar';
const $=s=>document.querySelector(s),t=k=>T[lang][k]||k,L=(o,k)=>o[k+'_'+lang]||o[k+'_en'];
const ls=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},sv=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const money=n=>Number(n).toLocaleString(lang==='ar'?'ar-EG':'en-US')+' '+t('egp');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cart=ls('tz_cart',{}),wish=ls('tz_wish',[]),cmp=ls('tz_cmp',[]),recent=ls('tz_recent',[]);
function toast(m,bad){const e=$('#toast');e.textContent=m;e.className='show'+(bad?' bad':'');clearTimeout(toast.t);toast.t=setTimeout(()=>e.className='',2500)}
const P=id=>PRODUCTS.find(p=>p.id===id);
const catName=c=>t(c);
// ---------- Firebase (loaded only when configured)
async function initFB(){
  if(!CFG)return;
  const B='https://www.gstatic.com/firebasejs/10.12.2/';
  const [a,f,fu]=await Promise.all([import(B+'firebase-app.js'),import(B+'firebase-firestore.js'),import(B+'firebase-auth.js')]);
  const fa=await import(B+'firebase-functions.js');
  const app=a.initializeApp(firebaseConfig);db=f.getFirestore(app);auth=fu.getAuth(app);fn=fa.getFunctions(app,'europe-west1');
  fb={...f,...fu,...fa};
  fb.onAuthStateChanged(auth,async u=>{const was=user;user=u;authReady=true;if(u){await syncLists(u);try{const s=await fb.getDoc(fb.doc(db,'carts',u.uid));if(s.exists()){const r=s.data().items||{};for(const k in r)cart[k]=Math.max(cart[k]||0,r[k]);sv('tz_cart',cart)}}catch{}}else if(was){cmp=[];wish=[];prof=null;addrs=null;sv('tz_cmp',cmp);sv('tz_wish',wish)}renderChrome();route()});
}
async function loadProducts(){
  try{
    if(CFG){const s=await fb.getDocs(fb.collection(db,'products'));PRODUCTS=s.docs.map(d=>({...d.data(),id:d.id}))}
    if(!PRODUCTS.length){const r=await fetch('js/catalog.json');PRODUCTS=await r.json()} // demo/fallback until you import the catalog from admin
  }catch(e){const r=await fetch('js/catalog.json');PRODUCTS=await r.json()}
  try{if(CFG){const s=await fb.getDoc(fb.doc(db,'settings','store'));if(s.exists())store={...store,...s.data()}}}catch{}
}
// ---------- cart
const cartCount=()=>Object.values(cart).reduce((a,b)=>a+b,0);
async function saveCart(){sv('tz_cart',cart);if(user&&db)try{await fb.setDoc(fb.doc(db,'carts',user.uid),{items:cart,updatedAt:Date.now()})}catch{}renderChrome()}
function addCart(id,q=1,quiet){const p=P(id);if(!p||p.stock<1)return toast(t('out'),1);cart[id]=Math.min((cart[id]||0)+q,p.stock);saveCart();if(!quiet)toast('✓ '+t('added'))}
function totals(coupon){
  let sub=0,old=0;for(const id in cart){const p=P(id);if(p){sub+=p.price*cart[id]}}
  let disc=0;if(coupon){disc=coupon.type==='percent'?Math.round(sub*coupon.value/100):coupon.value;disc=Math.min(disc,sub)}
  const ship=sub===0?0:(sub-disc>=store.freeShippingOver?0:store.shippingFee);
  return {sub,disc,ship,total:sub-disc+ship}}
// ---------- chrome
function renderChrome(){
  document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  $('#topbar').innerHTML=`<div class="wrap"><span>${t('welcome')} · ${t('shipTop')}</span><span>📞 <a href="tel:${esc(store.phone)}">${esc(store.phone)}</a> · ✉ ${esc(store.email)}</span></div>`;
  const dm=['laptops','cpu','gpu','motherboards','ram','storage','cases','cooling','psu'].map(c=>`<a href="#/cat/${c}">${t(c)}</a>`).join('');
  const am=['keyboards','mice','headsets'].map(c=>`<a href="#/cat/${c}">${t(c)}</a>`).join('');
  $('#header').innerHTML=`<div class="wrap"><div class="hrow"><a class="logo" href="#/">TECH ZONE</a>
  <div class="sbox"><input id="q" type="search" placeholder="${t('search')}" autocomplete="off" aria-label="search"><div id="sug" class="sug" hidden></div></div>
  <button class="ibtn" id="lg" aria-label="language">${lang==='ar'?'🇬🇧 EN':'🇪🇬 ع'}</button>
  ${userMenu()}<a class="ibtn" href="#/wishlist" title="${t('wishlist')}">❤<span class="badge">${wish.length}</span></a>
  <a class="ibtn" href="#/compare" title="${t('compare')}">⚖<span class="badge">${cmp.length}</span></a>
  <a class="ibtn" href="#/cart" title="${t('cart')}">🛒<span class="badge">${cartCount()}</span></a></div></div>
  <nav class="menu"><div class="wrap"><a href="#/">${t('home')}</a><a href="#/products?cat=laptops">${t('laptops')}</a>
  <div class="dd"><a href="#/products">${t('pcc')} ▾</a><div class="dm">${dm}</div></div>
  <div class="dd"><a href="#/cat/accessories">${t('accessories')} ▾</a><div class="dm">${am}</div></div>
  <a href="#/cat/monitors">${t('monitors')}</a><a href="#/products?deals=1">${t('deals')}</a><a href="#/products?sort=new">${t('newest')}</a><a href="#/contact">${t('contact')}</a></div></nav>`;
  $('#lg').onclick=()=>{lang=lang==='ar'?'en':'ar';localStorage.setItem('tz_lang',lang);renderChrome();route()};
  const q=$('#q'),sg=$('#sug');
  q.oninput=()=>{const v=q.value.trim().toLowerCase();if(v.length<2){sg.hidden=true;return}
    const r=search(v).slice(0,6);sg.hidden=!r.length;sg.innerHTML=r.map(p=>`<a href="#/product/${p.id}"><img src="${p.images[0]}" alt=""><span>${esc(L(p,'name'))}</span></a>`).join('')};
  q.onkeydown=e=>{if(e.key==='Enter'){location.hash='#/products?q='+encodeURIComponent(q.value);sg.hidden=true}};
  q.onblur=()=>setTimeout(()=>sg.hidden=true,200);
  $('#footer').innerHTML=`<div class="wrap"><div><b class="logo">TECH ZONE</b><p>GEAR UP YOUR GAME.</p></div><div><b>${t('contactUs')}</b><br>${contactLines()}</div><div><b>${t('follow')}</b><br>${socialLinks()}</div><div><a href="#/faq">${t('faq')}</a><br><a href="#/privacy">${t('privacy')}</a><br><a href="#/terms">${t('terms')}</a><br><a href="#/track">${t('track')}</a></div>
  <form id="nl" style="max-width:300px"><b>${t('news')}</b><div style="display:flex;gap:6px;margin-top:6px"><input type="email" required placeholder="${t('email')}" name="e"><button class="btn">${t('send')}</button></div></form></div>`;
  $('#nl').onsubmit=async e=>{e.preventDefault();try{if(!CFG)throw 0;await fb.addDoc(fb.collection(db,'newsletter'),{email:e.target.e.value,createdAt:Date.now()});toast('✓');e.target.reset()}catch{toast(t('demo'),1)}};
  $('#bottomnav').innerHTML=`<a href="#/"><b>🏠</b>${t('home')}</a><a href="#/products"><b>🔍</b>${t('products')}</a><a href="#/cart"><b>🛒</b>${t("cart")}</a><a href="#/wishlist"><b>❤</b>${t('wishlist')}</a><a href="#/compare"><b>⚖</b>${t('compare')}</a><a href="#/account"><b>👤</b>${t('account')}</a>`;
  $('#wa').href='https://wa.me/'+store.whatsapp;bindMenu();cbar();
}
function search(v){v=v.toLowerCase();return PRODUCTS.filter(p=>[p.name_en,p.name_ar,p.brand,p.model,p.sku,t(p.categoryId),p.categoryId].join(' ').toLowerCase().includes(v))}
// ---------- compare / wishlist / auth helpers
async function saveList(col,arr){if(user&&db)try{await fb.setDoc(fb.doc(db,col,user.uid),{items:arr,updatedAt:Date.now()})}catch{}}
function saveCmp(){sv('tz_cmp',cmp);saveList('comparisons',cmp);renderChrome()}
function saveWish(){sv('tz_wish',wish);saveList('wishlists',wish);renderChrome()}
async function syncLists(u){try{for(const [col,k] of [['comparisons','cmp'],['wishlists','wish']]){
  const s=await fb.getDoc(fb.doc(db,col,u.uid)),rem=s.exists()?(s.data().items||[]):[];
  const m=[...new Set([...rem,...(k==='cmp'?cmp:wish)])].filter(id=>!PRODUCTS.length||P(id)).slice(0,k==='cmp'?MAXC:200);
  if(k==='cmp')cmp=m;else wish=m;sv('tz_'+k,m);await fb.setDoc(fb.doc(db,col,u.uid),{items:m,updatedAt:Date.now()})}}catch(e){console.error(e)}}
function addCmp(id){if(cmp.includes(id))return toast('⚖ '+t('cmpDup'),1);if(cmp.length>=MAXC)return toast(t('cmpMax'),1);cmp=[...cmp,id];saveCmp();toast('✓ '+t('cmpAdd')+` (${cmp.length}/${MAXC})`)}
function syncCmp(){document.querySelectorAll('[data-c]').forEach(b=>{const on=cmp.includes(b.dataset.c);b.classList.toggle('on',on);b.textContent=on?'✓ '+t('inCompare'):'⚖ '+t('compare')})}
const cmpBtn=(id,c='')=>`<button type="button" class="${c} cmpb${cmp.includes(id)?' on':''}" data-c="${id}">${cmp.includes(id)?'✓ '+t('inCompare'):'⚖ '+t('compare')}</button>`;
function cbar(){let b=$('#cbar');if(!b){b=document.createElement('div');b.id='cbar';document.body.appendChild(b)}
 const hide=!cmp.length||location.hash.startsWith('#/compare');b.hidden=hide;if(hide)return;
 b.innerHTML=`<span>⚖ ${cmp.length}/${MAXC}</span><button class="btn" id="cbg">${t('cmpGo')}</button><button class="btn btn2" id="cbc">${t('clearAll')}</button>`;
 $('#cbg').onclick=()=>cmp.length<2?toast(t('cmpMin'),1):(location.hash='#/compare');$('#cbc').onclick=()=>{cmp=[];saveCmp();syncCmp();cbar()}}
const avatar=(src,name,s=30)=>src?`<img class="av" style="width:${s}px;height:${s}px" src="${esc(src)}" alt="" referrerpolicy="no-referrer">`:`<span class="av" style="width:${s}px;height:${s}px;font-size:${Math.round(s*.45)}px">${esc((name||'?')[0].toUpperCase())}</span>`;
function userMenu(){
 if(!CFG||!user)return `<a class="ibtn hide-m" href="#/login">${t('login')}</a><a class="ibtn show-m" href="#/login" title="${t('account')}" aria-label="${t('account')}">👤</a>`;
 return `<div class="um"><button class="ibtn" id="umb" aria-haspopup="true" aria-expanded="false" aria-label="${t('account')}">${avatar(user.photoURL,user.displayName||user.email)}</button><div class="umm" id="umm" hidden><div class="uh">${esc(user.displayName||'')}<br>${esc(user.email||'')}</div><a href="#/account">👤 ${t('tab_profile')}</a><a href="#/account/orders">📦 ${t('tab_orders')}</a><a href="#/wishlist">❤ ${t('wishlist')}</a><a href="#/compare">⚖ ${t('compare')}</a><button id="umo">🚪 ${t('logout')}</button></div></div>`}
let menuBound=false;
function bindMenu(){const b=$('#umb'),m=$('#umm');if(b){b.onclick=e=>{e.stopPropagation();m.hidden=!m.hidden;b.setAttribute('aria-expanded',String(!m.hidden))};m.onclick=e=>{if(e.target.closest('a'))m.hidden=true};$('#umo').onclick=logout}
 if(!menuBound){menuBound=true;document.addEventListener('click',()=>{const m=$('#umm');if(m)m.hidden=true})}}
async function logout(){try{await fb.signOut(auth);toast('✓ '+t('loggedOut'));location.hash='#/'}catch{toast(t('err'),1)}}
function contactLines(){return `📞 <a href="tel:${esc(store.phone)}" dir="ltr">${esc(store.phone)}</a><br>💬 <a href="https://wa.me/${esc(store.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a><br>✉ <a href="mailto:${esc(store.email)}">${esc(store.email)}</a>${store.cashNumber?`<br>💳 ${t('vcash')}: <b dir="ltr">${esc(store.cashNumber)}</b>`:''}`}
function socialLinks(){const s=store.social||{};return [['tiktok','TikTok','🎵'],['instagram','Instagram','📸'],['facebook','Facebook','👍']].filter(x=>s[x[0]]).map(x=>`<a href="${esc(s[x[0]])}" target="_blank" rel="noopener noreferrer">${x[2]} ${x[1]}</a>`).join('<br>')}
const vEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),vPhone=p=>/^01[0-9]{9}$/.test(p||''),vPass=p=>(p||'').length>=8&&/[A-Za-z]/.test(p)&&/\d/.test(p);
const aerr=x=>T[lang]['e_'+String(x?.code||'').replace('auth/','').replace(/-/g,'_')]||t('err');
const pw=(n,l,ac,c='')=>`<label class="${c}">${l}<span class="pw"><input type="password" name="${n}" required autocomplete="${ac}"><button type="button" class="eye" data-eye aria-label="${t('showPass')}">👁</button></span></label>`;
const bindEye=r=>r.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{const i=b.previousElementSibling;i.type=i.type==='password'?'text':'password'});
async function google(fe){if(!CFG)return fe(t('demo'));try{const c=await fb.signInWithPopup(auth,new fb.GoogleAuthProvider()),r=fb.doc(db,'users',c.user.uid);
 if(!(await fb.getDoc(r)).exists())await fb.setDoc(r,{name:c.user.displayName||'',email:c.user.email||'',phone:'',photoURL:c.user.photoURL||'',createdAt:Date.now()})}catch(x){fe(aerr(x))}}
// ---------- components
const stars=r=>'★'.repeat(Math.round(r))+'☆'.repeat(5-Math.round(r));
function card(p){const w=wish.includes(p.id);return `<article class="pc">${p.discount?`<span class="dsc">-${p.discount}%</span>`:''}<button class="wl" data-w="${p.id}" aria-label="wishlist">${w?'❤':'🤍'}</button>
<a class="im" href="#/product/${p.id}"><img loading="lazy" src="${p.images[0]}" alt="${esc(L(p,'name'))}"></a><div class="bd"><span class="br">${esc(p.brand)}</span>
<h3><a href="#/product/${p.id}">${esc(L(p,'name'))}</a></h3><p class="sd" dir="auto">${esc(L(p,'description'))}</p><div class="stars">${stars(p.rating)} <small>(${p.reviewCount})</small></div>
<div><span class="pr">${money(p.price)}</span>${p.oldPrice?`<span class="old">${money(p.oldPrice)}</span>`:''}</div>
<span class="${p.stock>0?'ok':'no'}">${p.stock>0?'● '+t('inStock')+(p.stock<=3?` (${p.stock} ${t('left')})`:''):t('out')}</span>
<div class="acts"><button class="btn" style="flex:1" data-a="${p.id}" ${p.stock<1?'disabled':''}>${t('add')}</button><a class="btn btn2" href="#/product/${p.id}">${t('view')}</a></div>${cmpBtn(p.id)}</div></article>`}
function bind(root){root.querySelectorAll('[data-a]').forEach(b=>b.onclick=e=>{e.preventDefault();addCart(b.dataset.a)});
  root.querySelectorAll('[data-w]').forEach(b=>b.onclick=e=>{e.preventDefault();const i=b.dataset.w;wish=wish.includes(i)?wish.filter(x=>x!==i):[...wish,i];saveWish();b.textContent=wish.includes(i)?'❤':'🤍';if(/^#\/(wishlist|account\/wishlist)/.test(location.hash))route()});
  root.querySelectorAll('[data-c]').forEach(b=>b.onclick=e=>{e.preventDefault();addCmp(b.dataset.c);syncCmp()})}
const catImg=c=>(PRODUCTS.find(p=>(GROUPS[c]||[c]).includes(p.categoryId))||{images:['']}).images[0];
// ---------- pages
const R={};
R.home=()=>{const f=PRODUCTS.filter(p=>p.featured||p.discount>=8).slice(0,8),n=[...PRODUCTS].sort((a,b)=>b.createdAt-a.createdAt).slice(0,8);
 return `<div class="wrap">${CFG?'':`<div class="demo">⚠ ${t('demo')}</div>`}
<a class="hero" href="#/products" aria-label="${t('shop')}"><picture><source media="(max-width:700px)" srcset="images/hero-mobile.jpg"><img src="images/hero.jpg" alt="THE ULTIMATE GAMING GEAR – TECH ZONE" fetchpriority="high"></picture></a>
<div style="text-align:center"><a class="btn" href="#/products" style="font-size:1.05rem;padding:12px 40px;margin-top:4px">${t('shop')} ›</a></div>
<div class="srv"><div>🛡️ ${t('s1')}</div><div>🏅 ${t('s2')}</div><div>🚚 ${t('s3')}</div><div>🔒 ${t('s4')}</div><div>🎧 ${t('s5')}</div></div>
<h2 class="t">${t('cats')}</h2><div class="cats">${CATS.map(([c,i])=>`<a class="cat" href="#/cat/${c}"><img loading="lazy" src="${catImg(c)}" alt=""><b>${i} ${t(c)}</b></a>`).join('')}</div>
<h2 class="t">${t('featured')}</h2><div class="grid">${f.map(card).join('')}</div>
<h2 class="t">${t('latest')}</h2><div class="grid">${n.map(card).join('')}</div>
<!-- ============ TEAM SECTION: edit names/photos in js/firebase-config.js ============ -->
<h2 class="t">${t('team')}</h2><div class="team">${team.map(m=>mem(m)).join('')}</div>
<div class="team dr" style="margin-top:22px"><div class="mem"><small style="color:var(--tx2)">${t('doctor')}</small>${mem(doctor,1)}</div></div>
<!-- ============ FEEDBACK ============ -->
<h2 class="t">${t('feedback')}</h2><div class="grid" id="fbk"></div></div>`};
const mem=(m,d)=>`<div class="mem">${`<img src="${m.img}" alt="${esc(L(m,'name'))}" loading="lazy" onerror="this.outerHTML='<div class=ph>👤</div>'">`}<b>${esc(L(m,'name'))}</b></div>`;
R.cat=a=>go('products?cat='+a[0]);
function qs(){const h=location.hash.split('?')[1]||'';return Object.fromEntries(new URLSearchParams(h))}
let page=1;
R.products=()=>{const o=qs();const brands=[...new Set(PRODUCTS.map(p=>p.brand))].sort();
 return `<div class="wrap"><h2 class="t">${o.cat?t(o.cat):o.q?`“${esc(o.q)}”`:t('products')}</h2><div class="lay"><aside class="side">
 <select id="fs"><option value="new">${t('nw')}</option><option value="pl">${t('pLow')}</option><option value="ph">${t('pHigh')}</option><option value="best">${t('best')}</option><option value="rate">${t('rated')}</option></select>
 <select id="fb"><option value="">${t('allB')}</option>${brands.map(b=>`<option>${esc(b)}</option>`).join('')}</select>
 <select id="fc"><option value="">${t('cats')}</option>${CATS.map(([c])=>`<option value="${c}">${t(c)}</option>`).join('')}</select>
 <label>${t('maxP')}: <b id="pv"></b><input id="fp" type="range" min="500" max="200000" step="500" value="200000"></label>
 <label><input type="checkbox" id="fst" style="width:auto"> ${t('onlyStock')}</label><label><input type="checkbox" id="fd" style="width:auto"> ${t('onlyDeal')}</label>
 <select id="fr"><option value="0">★ 0+</option><option value="4">★ 4+</option><option value="4.5">★ 4.5+</option></select></aside><div><div class="grid" id="pl"></div><div class="pg" id="pg"></div></div></div></div>`};
R.products.after=()=>{const o=qs();$('#fc').value=o.cat||'';$('#fs').value=o.sort==='new'?'new':'new';$('#fd').checked=!!o.deals;
 const run=()=>{let r=PRODUCTS.slice();const c=$('#fc').value,b=$('#fb').value,mx=+$('#fp').value;$('#pv').textContent=money(mx);
  if(c)r=r.filter(p=>(GROUPS[c]||[c]).includes(p.categoryId));if(b)r=r.filter(p=>p.brand===b);r=r.filter(p=>p.price<=mx&&p.rating>=+$('#fr').value);
  if($('#fst').checked)r=r.filter(p=>p.stock>0);if($('#fd').checked)r=r.filter(p=>p.discount>0);if(o.q)r=search(o.q).filter(p=>r.includes(p));
  const s=$('#fs').value;r.sort({new:(a,b)=>b.createdAt-a.createdAt,pl:(a,b)=>a.price-b.price,ph:(a,b)=>b.price-a.price,best:(a,b)=>b.bestSeller-a.bestSeller,rate:(a,b)=>b.rating-a.rating}[s]);
  const per=12,pages=Math.ceil(r.length/per);page=Math.min(page,pages||1);
  $('#pl').innerHTML=r.length?r.slice((page-1)*per,page*per).map(card).join(''):`<p>${t('empty')}</p>`;bind($('#pl'));
  $('#pg').innerHTML=Array.from({length:pages},(_,i)=>`<button class="${i+1===page?'on':''}" data-p="${i+1}">${i+1}</button>`).join('');
  $('#pg').querySelectorAll('button').forEach(x=>x.onclick=()=>{page=+x.dataset.p;run();scrollTo({top:0,behavior:'smooth'})})};
 document.querySelectorAll('.side select,.side input').forEach(e=>e.oninput=()=>{page=1;run()});run()};
R.product=a=>{const p=P(a[0]);if(!p)return `<div class="wrap"><p>${t('empty')}</p></div>`;recent=[p.id,...recent.filter(x=>x!==p.id)].slice(0,8);sv('tz_recent',recent);
 document.title=L(p,'name')+' | TECH ZONE';
 const sp=L(p,'specifications'),rel=PRODUCTS.filter(x=>x.categoryId===p.categoryId&&x.id!==p.id).slice(0,4),rc=recent.filter(x=>x!==p.id).map(P).filter(Boolean).slice(0,4);
 const fbt=PRODUCTS.filter(x=>x.categoryId!==p.categoryId&&['mice','keyboards','headsets','ram','storage'].includes(x.categoryId)).slice(0,2);
 return `<div class="wrap"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',name:p.name_en,sku:p.sku,brand:{'@type':'Brand',name:p.brand},image:p.images,offers:{'@type':'Offer',priceCurrency:'EGP',price:p.price,availability:p.stock>0?'https://schema.org/InStock':'https://schema.org/OutOfStock'}})}</script>
 <div class="det"><div><div class="main-img" id="mi"><img id="mimg" src="${p.images[0]}" alt="${esc(L(p,'name'))}"></div><div class="thumbs">${p.images.map((x,i)=>`<img src="${x}" class="${i?'':'on'}" alt="">`).join('')}</div></div>
 <div class="box"><span class="br">${esc(p.brand)}</span><h1 style="font-size:1.5rem">${esc(L(p,'name'))}</h1><div class="stars">${stars(p.rating)} (${p.reviewCount} ${t('reviews')})</div>
 <p><span class="pr" style="font-size:1.8rem">${money(p.price)}</span>${p.oldPrice?`<span class="old">${money(p.oldPrice)}</span> <span class="dsc" style="position:static">-${p.discount}%</span>`:''}</p>
 <p class="${p.stock>0?'ok':'no'}">${p.stock>0?'● '+t('inStock')+` (${p.stock})`:t('out')}</p>
 <table><tr><td>${t('brand')}</td><td>${esc(p.brand)}</td></tr><tr><td>${t('model')}</td><td>${esc(p.model)}</td></tr><tr><td>${t('sku')}</td><td>${p.sku}</td></tr><tr><td>${t('warranty')}</td><td>${esc(L(p,'warranty'))}</td></tr><tr><td>🚚</td><td>${t('delivery')}</td></tr></table>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center"><div class="qty"><button id="qm">−</button><span id="qv">1</span><button id="qp">+</button></div>
 <button class="btn" id="ac" ${p.stock<1?'disabled':''}>${t('add')}</button><button class="btn btn2" id="bn" ${p.stock<1?'disabled':''}>${t('buyNow')}</button><button class="btn btn2" data-w="${p.id}">${wish.includes(p.id)?'❤':'🤍'}</button>${cmpBtn(p.id,'btn btn2')}</div></div></div>
 <h2 class="t">${t('desc')}</h2><div class="box">${esc(L(p,'description'))}</div>
 <h2 class="t">${t('specs')}</h2><div class="box"><table>${sp.map(s=>`<tr><td>${esc(s.label)}</td><td dir="auto">${esc(s.value)}</td></tr>`).join('')}</table></div>
 ${fbt.length?`<h2 class="t">${t('fbt')}</h2><div class="grid">${[p,...fbt].map(card).join('')}</div>`:''}
 <h2 class="t">${t('related')}</h2><div class="grid">${rel.map(card).join('')}</div>${rc.length?`<h2 class="t">${t('recent')}</h2><div class="grid">${rc.map(card).join('')}</div>`:''}</div>`};
R.product.after=a=>{const p=P(a[0]);if(!p)return;let q=1;const set=()=>$('#qv').textContent=q;
 $('#qm').onclick=()=>{q=Math.max(1,q-1);set()};$('#qp').onclick=()=>{q=Math.min(p.stock,q+1);set()};
 $('#ac').onclick=()=>addCart(p.id,q);$('#bn').onclick=()=>{addCart(p.id,q,1);location.hash='#/checkout'};
 document.querySelectorAll('.thumbs img').forEach(i=>i.onclick=()=>{$('#mimg').src=i.src;document.querySelectorAll('.thumbs img').forEach(x=>x.classList.remove('on'));i.classList.add('on')});
 $('#mi').onclick=()=>{const l=$('#lightbox');l.innerHTML=`<img src="${$('#mimg').src}" alt="">`;l.hidden=false;l.onclick=()=>l.hidden=true};bind(document)};
let coupon=null;
R.cart=()=>{const ids=Object.keys(cart).filter(P);if(!ids.length)return `<div class="wrap"><h2 class="t">${t('cart')}</h2><div class="box">${t('cartEmpty')}<br><br><a class="btn" href="#/products">${t('cont')}</a></div></div>`;
 const tt=totals(coupon);return `<div class="wrap"><h2 class="t">${t('cart')}</h2><div class="box">${ids.map(id=>{const p=P(id);return `<div class="crow"><img src="${p.images[0]}" alt=""><div><a href="#/product/${id}"><b>${esc(L(p,'name'))}</b></a><br>${money(p.price)}<br><span class="no">${cart[id]>=p.stock?t('left')+': '+p.stock:''}</span></div>
 <div><div class="qty"><button data-q="${id}" data-d="-1">−</button><span>${cart[id]}</span><button data-q="${id}" data-d="1">+</button></div><br><a href="#" data-r="${id}" class="no">${t('remove')}</a></div></div>`}).join('')}</div>
 <div class="box"><div style="display:flex;gap:6px"><input id="cc" placeholder="${t('coupon')}"><button class="btn" id="ca">${t('apply')}</button></div><br>${summary(tt)}<br><a class="btn" href="#/checkout" style="width:100%">${t('checkout')}</a><br><br><a class="btn btn2" href="#/products" style="width:100%">${t('cont')}</a></div></div>`};
const summary=tt=>`<table><tr><td>${t('subtotal')}</td><td>${money(tt.sub)}</td></tr>${tt.disc?`<tr><td>${t('discount')}</td><td>-${money(tt.disc)}</td></tr>`:''}<tr><td>${t('shipping')}</td><td>${tt.ship?money(tt.ship):'🎁 0'}</td></tr><tr><td><b>${t('total')}</b></td><td><b>${money(tt.total)}</b></td></tr></table>`;
async function checkCoupon(code){ // coupon display only; the server re-validates it
  if(!CFG)return toast(t('demo'),1);try{const s=await fb.getDoc(fb.doc(db,'coupons',code.trim().toUpperCase()));if(s.exists()&&s.data().active){coupon=s.data();toast('✓ '+code)}else{coupon=null;toast('✗',1)}}catch{toast(t('err'),1)}route()}
R.cart.after=()=>{document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const id=b.dataset.q,n=cart[id]+ +b.dataset.d;if(n<1)delete cart[id];else cart[id]=Math.min(n,P(id).stock);saveCart();route()});
 document.querySelectorAll('[data-r]').forEach(b=>b.onclick=e=>{e.preventDefault();delete cart[b.dataset.r];saveCart();route()});const ca=$('#ca');if(ca)ca.onclick=()=>checkCoupon($('#cc').value)};
R.checkout=()=>{if(!cartCount())return go('cart');const tt=totals(coupon);
 return `<div class="wrap"><h2 class="t">${t('checkout')}</h2>${CFG?'':`<div class="demo">⚠ ${t('demo')}</div>`}<div class="lay" style="grid-template-columns:1fr 340px"><form id="co" class="box form">
 <input class="f" name="name" required placeholder="${t('name')}" value="${esc(user?.displayName||'')}"><input name="phone" required pattern="01[0-9]{9}" placeholder="${t('phone')} (01xxxxxxxxx)"><input type="email" name="email" required placeholder="${t('email')}" value="${esc(user?.email||'')}">
 <select name="gov" required><option value="">${t('gov')}</option>${GOVS.map(g=>`<option>${g}</option>`).join('')}</select><input name="city" required placeholder="${t('city')}"><input class="f" name="address" required minlength="8" placeholder="${t('addr')}"><textarea class="f" name="notes" placeholder="${t('notes')}"></textarea>
 <div class="f"><b>${t('pay')}</b><br><label><input type="radio" name="pm" value="cod" checked style="width:auto"> ${t('cod')}</label><br><label><input type="radio" name="pm" value="online" style="width:auto"> ${t('online')}</label><br><label><input type="radio" name="pm" value="vcash" style="width:auto"> ${t('vcash')}</label>
 <div id="vbox" class="vbox" hidden><p>${t('vcashNote')} <b dir="ltr">${esc(store.cashNumber||'')}</b> <button type="button" class="btn btn2" id="cpy">${t('copy')}</button></p><input name="vs" maxlength="11" inputmode="tel" placeholder="${t('vcashSender')}"></div></div>
 <button class="btn f" id="po">${t('place')}</button></form><div class="box">${Object.keys(cart).filter(P).map(i=>`<p>${cart[i]}× ${esc(L(P(i),'name'))}</p>`).join('')}<br>${summary(tt)}</div></div></div>`};
R.checkout.after=()=>{document.querySelectorAll('[name=pm]').forEach(r=>r.onchange=()=>{$('#vbox').hidden=$('[name=pm]:checked').value!=='vcash'});const cpy=$('#cpy');if(cpy)cpy.onclick=()=>{navigator.clipboard?.writeText(store.cashNumber||'');toast('✓ '+t('copied'))};$('#co').onsubmit=async e=>{e.preventDefault();if(!CFG)return toast(t('demo'),1);const f=Object.fromEntries(new FormData(e.target));if(f.pm==='vcash'&&!/^01[0-9]{9}$/.test(f.vs||''))return toast(t('v_phone'),1);$('#po').disabled=true;
 try{const r=await fb.httpsCallable(fn,'createOrder')({items:Object.entries(cart).map(([id,qty])=>({id,qty})),customer:{name:f.name,phone:f.phone,email:f.email,gov:f.gov,city:f.city,address:f.address,notes:f.notes},payment:f.pm,vcashSender:f.vs||'',coupon:coupon?coupon.code:null,lang});
  const d=r.data;if(f.pm==='online'&&d.paymentUrl){location.href=d.paymentUrl;return} // order stays "pending/unpaid" until Paymob webhook confirms
  sessionStorage.setItem('tz_vc',f.pm==='vcash'?'1':'');cart={};coupon=null;await saveCart();location.hash='#/confirm/'+d.orderNumber}catch(x){toast(x.message||t('err'),1);$('#po').disabled=false}}};
R.confirm=a=>`<div class="wrap"><div class="box" style="text-align:center"><h2>✅ ${t('confirmTitle')}</h2><p style="font-size:1.4rem;margin:12px">${t('orderNo')}: <b>${esc(a[0])}</b></p>${sessionStorage.getItem('tz_vc')?`<p>${t('vcashAfter')} <b dir="ltr">${esc(store.cashNumber||'')}</b></p>`:''}<a class="btn" href="#/track">${t('track')}</a></div></div>`;
const STEPS=['pending','confirmed','processing','shipped','out_for_delivery','delivered'];
const orderBox=o=>`<div class="box"><b>${t('orderNo')}: ${esc(o.orderNumber)}</b> · ${new Date(o.createdAt).toLocaleDateString()}<div class="steps" style="margin:8px 0">${o.status==='cancelled'?`<span class="st on" style="background:var(--disc)">${t('cancelled')}</span>`:STEPS.map((s,i)=>`<span class="st ${i<=STEPS.indexOf(o.status)?'on':''}">${t(s)}</span>`).join('')}</div>
 ${o.items.map(i=>`<p>${i.qty}× ${esc(lang==='ar'?i.name_ar:i.name_en)} — ${money(i.price)}</p>`).join('')}<p>${t('total')}: <b>${money(o.total)}</b> · ${({cod:t('cod'),online:t('online'),vcash:t('vcash')})[o.payment]||o.payment} (${o.paid?'✓':'—'})</p><p>📍 ${esc(o.customer.gov)}, ${esc(o.customer.city)}, ${esc(o.customer.address)}</p></div>`;
R.track=()=>`<div class="wrap"><h2 class="t">${t('track')}</h2><div id="ol">${user?t('loading'):''}</div><form id="tf" class="box form"><b class="f">${t('trackBy')}</b><input name="n" placeholder="${t('orderNo')}" required><input name="p" placeholder="${t('phone')}" required><button class="btn f">${t('track')}</button></form><div id="tr"></div></div>`;
R.track.after=async()=>{if(user&&db){const s=await fb.getDocs(fb.query(fb.collection(db,'orders'),fb.where('uid','==',user.uid)));const o=s.docs.map(d=>d.data()).sort((a,b)=>b.createdAt-a.createdAt);$('#ol').innerHTML=o.map(orderBox).join('')||t('empty')}
 $('#tf').onsubmit=async e=>{e.preventDefault();if(!CFG)return toast(t('demo'),1);const f=Object.fromEntries(new FormData(e.target));try{const r=await fb.httpsCallable(fn,'trackOrder')({orderNumber:f.n.trim(),phone:f.p.trim()});$('#tr').innerHTML=orderBox(r.data)}catch(x){toast(x.message||t('err'),1)}}};
R.wishlist=()=>`<div class="wrap"><h2 class="t">${t('wishlist')}</h2><div class="grid">${wish.map(P).filter(Boolean).map(card).join('')||t('empty')}</div></div>`;
R.compare=()=>{const ps=cmp.map(P).filter(Boolean);
 if(!ps.length)return `<div class="wrap"><h2 class="t">${t('compare')}</h2><div class="box empty-st"><div style="font-size:3rem">⚖</div><h3>${t('cmpEmptyTitle')}</h3><p>${t('compareEmpty')}</p><br><a class="btn" href="#/products">＋ ${t('addProduct')}</a></div></div>`;
 const labels=[...new Set(ps.flatMap(p=>L(p,'specifications').map(s=>s.label)))],sv_=(p,k)=>esc((L(p,'specifications').find(s=>s.label===k)||{}).value||'—');
 const row=(k,f)=>`<tr><th scope="row">${k}</th>${ps.map(p=>`<td dir="auto">${f(p)}</td>`).join('')}</tr>`;
 return `<div class="wrap"><div class="cmph"><h2 class="t" style="margin:30px 0 14px">${t('compare')} (${ps.length}/${MAXC})</h2><div class="cmpa"><a class="btn btn2" href="#/products">＋ ${t('addProduct')}</a><button class="btn btn2 dng" id="cclr">🗑 ${t('clearAll')}</button></div></div>
 ${ps.length<2?`<div class="demo">${t('cmpMin')}</div>`:''}<div class="cmpw"><table class="cmpt"><thead><tr><th></th>${ps.map(p=>`<th class="cmpp"><button class="x" data-rc="${p.id}" aria-label="${t('remove')}" title="${t('remove')}">✕</button><a href="#/product/${p.id}"><img src="${p.images[0]}" alt=""><b>${esc(L(p,'name'))}</b></a><br><button class="btn btn2 rm" data-rc="${p.id}">${t('remove')}</button></th>`).join('')}</tr></thead><tbody>
 ${row(t('brand'),p=>esc(p.brand))}${row(t('price'),p=>`<b>${money(p.price)}</b>`)}${row(t('cats'),p=>t(p.categoryId))}${labels.map(k=>row(esc(k),p=>sv_(p,k))).join('')}
 ${row(t('warranty'),p=>esc(L(p,'warranty')))}${row(t('availability'),p=>p.stock>0?`<span class="ok">● ${t('inStock')}</span>`:`<span class="no">${t('out')}</span>`)}${row(t('rating'),p=>p.reviewCount?`<span class="stars">${stars(p.rating)}</span> ${p.rating}`:'—')}
 ${row('',p=>`<button class="btn" data-a="${p.id}" ${p.stock<1?'disabled':''}>${t('add')}</button>`)}</tbody></table></div></div>`};
R.compare.after=()=>{document.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{cmp=cmp.filter(x=>x!==b.dataset.rc);saveCmp();toast('✓ '+t('cmpRemoved'));route()});
 const c=$('#cclr');if(c)c.onclick=()=>{if(confirm(t('cmpClearQ'))){cmp=[];saveCmp();route()}}};
R.login=()=>{if(CFG&&user)return go('account');
 return `<div class="wrap"><div class="authbox box"><h2>${t('login')}</h2>${CFG?'':`<div class="demo">⚠ ${t('demo')}</div>`}<form id="lf" novalidate><label>${t('email')}<input type="email" name="e" required autocomplete="email"></label>${pw('p',t('pass'),'current-password')}
 <div class="rowb"><label class="chk"><input type="checkbox" name="r" checked> ${t('remember')}</label><a href="#" id="fp">${t('forgot')}</a></div><div class="ferr" id="fe" role="alert"></div><button class="btn" id="lb" style="width:100%">${t('login')}</button></form>
 <div class="or"><span>${t('orWith')}</span></div><button class="btn btn2 gbtn" id="gg">G ${t('google')}</button><p class="sw">${t('noAcc')} <a href="#/register">${t('signup')}</a></p></div></div>`};
R.login.after=()=>{const f=$('#lf');if(!f)return;bindEye(f);const fe=m=>{const e=$('#fe');if(e)e.textContent=m||''};
 f.onsubmit=async e=>{e.preventDefault();fe();const d=Object.fromEntries(new FormData(f));if(!vEmail((d.e||'').trim()))return fe(t('v_email'));if(!d.p)return fe(t('req'));if(!CFG)return fe(t('demo'));
  $('#lb').disabled=true;try{await fb.setPersistence(auth,d.r?fb.browserLocalPersistence:fb.browserSessionPersistence);await fb.signInWithEmailAndPassword(auth,d.e.trim(),d.p)}catch(x){fe(aerr(x));const b=$('#lb');if(b)b.disabled=false}};
 $('#fp').onclick=async e=>{e.preventDefault();fe();const em=f.e.value.trim();if(!vEmail(em))return fe(t('v_email'));if(!CFG)return fe(t('demo'));try{await fb.sendPasswordResetEmail(auth,em);toast('✓ '+t('resetSent'))}catch(x){fe(aerr(x))}};
 $('#gg').onclick=()=>google(fe)};
R.register=()=>{if(CFG&&user)return go('account');
 return `<div class="wrap"><div class="authbox box"><h2>${t('signup')}</h2>${CFG?'':`<div class="demo">⚠ ${t('demo')}</div>`}<form id="rf" novalidate><label>${t('fullName')}<input name="n" required autocomplete="name"></label><label>${t('email')}<input type="email" name="e" required autocomplete="email"></label><label>${t('phone')}<input name="ph" inputmode="tel" placeholder="01xxxxxxxxx" required autocomplete="tel"></label>
 ${pw('p',t('pass'),'new-password')}${pw('c',t('confirmPass'),'new-password')}<small style="color:var(--tx2)">${t('passRule')}</small><label class="chk"><input type="checkbox" name="t"> <span>${t('agree')} <a href="#/terms" target="_blank" rel="noopener">${t('terms')}</a></span></label>
 <div class="ferr" id="fe" role="alert"></div><button class="btn" id="rb" style="width:100%">${t('signup')}</button></form><div class="or"><span>${t('orWith')}</span></div><button class="btn btn2 gbtn" id="gg">G ${t('google')}</button><p class="sw">${t('haveAcc')} <a href="#/login">${t('login')}</a></p></div></div>`};
R.register.after=()=>{const f=$('#rf');if(!f)return;bindEye(f);const fe=m=>{const e=$('#fe');if(e)e.textContent=m||''};
 f.onsubmit=async e=>{e.preventDefault();fe();const d=Object.fromEntries(new FormData(f));
  if((d.n||'').trim().length<3)return fe(t('v_name'));if(!vEmail((d.e||'').trim()))return fe(t('v_email'));if(!vPhone(d.ph))return fe(t('v_phone'));if(!vPass(d.p))return fe(t('v_pass'));if(d.p!==d.c)return fe(t('v_match'));if(!d.t)return fe(t('v_terms'));if(!CFG)return fe(t('demo'));
  $('#rb').disabled=true;try{const c=await fb.createUserWithEmailAndPassword(auth,d.e.trim(),d.p);await fb.updateProfile(c.user,{displayName:d.n.trim()});
   await fb.setDoc(fb.doc(db,'users',c.user.uid),{name:d.n.trim(),email:d.e.trim(),phone:d.ph,photoURL:'',createdAt:Date.now()});prof=null;renderChrome();route()}catch(x){fe(aerr(x));const b=$('#rb');if(b)b.disabled=false}};
 $('#gg').onclick=()=>google(fe)};
let prof=null,addrs=null;
const TABS=[['profile','👤'],['edit','✏️'],['password','🔑'],['addresses','📍'],['orders','📦'],['wishlist','❤'],['compare','⚖']];
R.account=a=>{if(!CFG)return `<div class="wrap"><div class="demo">⚠ ${t('demo')}</div></div>`;if(!authReady)return '<div class="spin"></div>';if(!user)return go('login');
 const tab=a[0]||'profile';
 return `<div class="wrap"><h2 class="t">${t('account')}</h2><div class="lay"><aside class="side dnav"><div style="text-align:center">${avatar(prof?.photoURL||user.photoURL,user.displayName||user.email,72)}<br><b>${esc(user.displayName||'')}</b></div>${TABS.map(([k,i])=>`<a href="#/account/${k}" class="${k===tab?'on':''}">${i} ${t('tab_'+k)}</a>`).join('')}<button class="btn btn2" id="lo">${t('logout')}</button></aside><section id="dc"><div class="spin"></div></section></div></div>`};
R.account.after=async a=>{if(!CFG||!user)return;$('#lo').onclick=logout;const tab=a[0]||'profile',uid=user.uid;
 const c=()=>$('#dc'),box=h=>`<div class="box">${h}</div>`,msg=(el,m,ok)=>{const e=el.querySelector('.ferr');if(e){e.textContent=m;e.style.color=ok?'var(--ok)':''}};
 if(!prof||prof.uid!==uid){try{const s=await fb.getDoc(fb.doc(db,'users',uid));prof={uid,...(s.exists()?s.data():{})}}catch{prof={uid}}}
 if(!c())return;const pf={name:prof.name||user.displayName||'',phone:prof.phone||'',photo:prof.photoURL||user.photoURL||''};
 if(tab==='profile')c().innerHTML=`<div class="box prof">${avatar(pf.photo,pf.name||user.email,96)}<div><h3>${esc(pf.name)}</h3><p>✉ ${esc(user.email)}</p><p>📞 ${esc(pf.phone||'—')}</p><br><a class="btn" href="#/account/edit">${t('editProfile')}</a></div></div><div class="srv"><a class="box" href="#/account/orders">📦 ${t('tab_orders')}</a><a class="box" href="#/account/wishlist">❤ ${t('wishlist')} (${wish.length})</a><a class="box" href="#/compare">⚖ ${t('compare')} (${cmp.length})</a><a class="box" href="#/account/addresses">📍 ${t('tab_addresses')}</a></div>`;
 else if(tab==='edit'){c().innerHTML=box(`<form id="ef" class="form" novalidate><div class="f" style="text-align:center">${avatar(pf.photo,pf.name,96)}</div><label class="f">${t('photo')}<input type="file" name="ph" accept="image/*"></label><label>${t('fullName')}<input name="n" value="${esc(pf.name)}" required></label><label>${t('phone')}<input name="p" value="${esc(pf.phone)}" inputmode="tel" required></label><div class="ferr f" role="alert"></div><button class="btn f">${t('save')}</button></form>`);
  const f=$('#ef');f.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f)),fl=f.ph.files[0];
   if(d.n.trim().length<3)return msg(f,t('v_name'));if(!vPhone(d.p))return msg(f,t('v_phone'));if(fl&&(!fl.type.startsWith('image/')||fl.size>2*1024*1024))return msg(f,t('v_photo'));
   const b=f.querySelector('button.btn');b.disabled=true;msg(f,t('loading'),1);
   try{let url=pf.photo;if(fl){const sm=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'),r=sm.ref(sm.getStorage(),'avatars/'+uid+'/avatar');await sm.uploadBytes(r,fl);url=await sm.getDownloadURL(r)}
    await fb.updateProfile(user,{displayName:d.n.trim(),photoURL:url||null});await fb.setDoc(fb.doc(db,'users',uid),{name:d.n.trim(),email:user.email,phone:d.p,photoURL:url||'',createdAt:prof.createdAt||Date.now()});
    prof={...prof,name:d.n.trim(),phone:d.p,photoURL:url||''};toast('✓ '+t('saved'));renderChrome();location.hash='#/account'}catch(x){msg(f,aerr(x));b.disabled=false}}}
 else if(tab==='password'){const hp=user.providerData.some(p=>p.providerId==='password');
  c().innerHTML=box(hp?`<form id="pf" class="form" novalidate>${pw('cp',t('curPass'),'current-password','f')}${pw('np',t('newPass'),'new-password')}${pw('cf',t('confirmPass'),'new-password')}<div class="ferr f" role="alert"></div><button class="btn f">${t('changePass')}</button></form>`:`<p>${t('pwGoogle')}</p>`);
  const f=$('#pf');if(f){bindEye(f);f.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));if(!vPass(d.np))return msg(f,t('v_pass'));if(d.np!==d.cf)return msg(f,t('v_match'));
   try{await fb.reauthenticateWithCredential(user,fb.EmailAuthProvider.credential(user.email,d.cp));await fb.updatePassword(user,d.np);f.reset();msg(f,'✓ '+t('passChanged'),1);toast('✓ '+t('passChanged'))}catch(x){msg(f,aerr(x))}}}}
 else if(tab==='addresses'){if(!addrs){try{const s=await fb.getDoc(fb.doc(db,'addresses',uid));addrs=s.exists()?(s.data().items||[]):[]}catch{addrs=[]}}
  const put=()=>fb.setDoc(fb.doc(db,'addresses',uid),{items:addrs,updatedAt:Date.now()}),draw=()=>{if(!c())return;
   c().innerHTML=`<div class="box"><h3>${t('tab_addresses')}</h3>${addrs.map(x=>`<div class="crow" style="grid-template-columns:1fr auto"><div><b>${esc(x.label)}</b><br>${esc(x.name)} · ${esc(x.phone)}<br>📍 ${esc(x.gov)}, ${esc(x.city)}, ${esc(x.address)}</div><button class="btn btn2 dng" data-da="${x.id}">${t('remove')}</button></div>`).join('')||`<p>${t('noAddr')}</p>`}</div><div class="box"><h3>${t('addAddr')}</h3><form id="af2" class="form" novalidate><input name="l" placeholder="${t('addrLabel')}"><input name="n" placeholder="${t('name')}"><input name="p" placeholder="${t('phone')} (01xxxxxxxxx)" inputmode="tel"><select name="g"><option value="">${t('gov')}</option>${GOVS.map(g=>`<option>${g}</option>`).join('')}</select><input name="c" placeholder="${t('city')}"><input class="f" name="a" placeholder="${t('addr')}"><div class="ferr f" role="alert"></div><button class="btn f">${t('save')}</button></form></div>`;
   c().querySelectorAll('[data-da]').forEach(b=>b.onclick=async()=>{const old=addrs;addrs=addrs.filter(x=>x.id!==b.dataset.da);try{await put();draw()}catch{addrs=old;toast(t('err'),1)}});
   const f=$('#af2');f.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));if(addrs.length>=10)return msg(f,t('addrMax'));
    if(!d.l.trim()||d.n.trim().length<3||d.c.trim().length<2||d.a.trim().length<8||!d.g)return msg(f,t('req'));if(!vPhone(d.p))return msg(f,t('v_phone'));
    const old=addrs;addrs=[...addrs,{id:'a'+Date.now(),label:d.l.trim(),name:d.n.trim(),phone:d.p,gov:d.g,city:d.c.trim(),address:d.a.trim()}];try{await put();toast('✓ '+t('saved'));draw()}catch{addrs=old;msg(f,t('err'))}}};
  draw()}
 else if(tab==='orders'){try{const s=await fb.getDocs(fb.query(fb.collection(db,'orders'),fb.where('uid','==',uid))),o=s.docs.map(d=>d.data()).sort((x,y)=>y.createdAt-x.createdAt);if(c())c().innerHTML=o.map(orderBox).join('')||box(`<p>${t('noOrders')}</p><a class="btn" href="#/products">${t('cont')}</a>`)}catch{if(c())c().innerHTML=box(t('err'))}}
 else if(tab==='wishlist'){const ps=wish.map(P).filter(Boolean);c().innerHTML=ps.length?`<div class="grid">${ps.map(card).join('')}</div>`:box(`<p>${t('wlEmpty')}</p><a class="btn" href="#/products">${t('cont')}</a>`);bind(c())}
 else if(tab==='compare'){const ps=cmp.map(P).filter(Boolean);c().innerHTML=box(ps.length?`${ps.map(p=>`<p>⚖ <a href="#/product/${p.id}">${esc(L(p,'name'))}</a></p>`).join('')}<br><a class="btn" href="#/compare">${t('cmpGo')}</a>`:`<p>${t('compareEmpty')}</p><a class="btn" href="#/products">${t('addProduct')}</a>`)}
 else go('account/profile')};
R.contact=()=>`<div class="wrap"><h2 class="t">${t('contact')}</h2><form id="cf" class="box form"><input name="name" required placeholder="${t('name')}"><input name="email" type="email" required placeholder="${t('email')}"><textarea class="f" name="message" required placeholder="${t('msg')}"></textarea><button class="btn f">${t('send')}</button></form><div class="box">${contactLines()}<br><br>${socialLinks().replace(/<br>/g,' · ')}</div></div>`;
R.contact.after=()=>$('#cf').onsubmit=async e=>{e.preventDefault();try{if(!CFG)throw 0;await fb.addDoc(fb.collection(db,'messages'),{...Object.fromEntries(new FormData(e.target)),createdAt:Date.now()});toast('✓');e.target.reset()}catch{toast(t('demo'),1)}};
R.faq=()=>`<div class="wrap"><h2 class="t">${t('faq')}</h2><div class="box">${t('faqText')}</div></div>`;
R.privacy=()=>`<div class="wrap"><h2 class="t">${t('privacy')}</h2><div class="box">${t('privText')}</div></div>`;
R.terms=()=>`<div class="wrap"><h2 class="t">${t('terms')}</h2><div class="box">${t('termsText')}</div></div>`;
// ---------- router
function go(h){location.hash='#/'+h;return ''}
function route(){const h=location.hash.replace(/^#\/?/,'').split('?')[0].split('/'),k=h[0]||'home',f=R[k]||R.home;
 document.title='TECH ZONE – GEAR UP YOUR GAME';$('#app').innerHTML=f(h.slice(1));f.after&&f.after(h.slice(1));bind($('#app'));
 if(k==='home')fbk();syncCmp();cbar();scrollTo(0,0)}
function fbk(){const e=$('#fbk');if(!e)return;e.innerHTML=[['أحمد','سرعة في التوصيل ومنتجات أصلية، تعامل ممتاز.','Fast delivery and genuine products.'],['محمد','سعر ممتاز وضمان حقيقي. أنصح بالتعامل.','Great price and real warranty.'],['Sara','Great support team, highly recommended!','دعم ممتاز، أنصح بالتعامل!']].map(r=>`<div class="box"><div class="stars">★★★★★</div><p>${lang==='ar'?r[1]:r[2]}</p><b>${r[0]}</b></div>`).join('')}
addEventListener('hashchange',route);
(async()=>{$('#app').innerHTML='<div class="spin"></div>';try{await initFB()}catch(e){console.error(e)}await loadProducts();cmp=cmp.filter(P).slice(0,MAXC);wish=wish.filter(P);renderChrome();route()})();
