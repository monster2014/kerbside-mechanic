document.getElementById('year').textContent=new Date().getFullYear();
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#main-nav');
menu.addEventListener('click',()=>{const opened=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(opened));menu.textContent=opened?'✕':'☰';});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰';}));
const tabs=document.querySelectorAll('[data-tab]'),forms=document.querySelectorAll('form[data-kind]');
function showTab(kind){tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===kind));forms.forEach(f=>f.classList.toggle('hidden',f.dataset.kind!==kind));}
tabs.forEach(t=>t.addEventListener('click',()=>showTab(t.dataset.tab)));
document.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',()=>{showTab('booking');document.querySelector('form[data-kind="booking"] select[name="service"]').value=b.dataset.service;document.getElementById('booking').scrollIntoView({behavior:'smooth'});}));
document.querySelectorAll('a[href="#quote"]').forEach(a=>a.addEventListener('click',()=>showTab('quote')));
document.querySelectorAll('a[href="#booking"]').forEach(a=>a.addEventListener('click',()=>showTab('booking')));
if(location.hash==='#quote')showTab('quote');
const dateField=document.querySelector('input[name="preferred_date"]');dateField.min=new Date().toLocaleDateString('en-CA');
for(const form of forms)form.addEventListener('submit',async e=>{e.preventDefault();const status=form.querySelector('.status'),button=form.querySelector('button[type="submit"]');button.disabled=true;status.textContent='Sending your request...';const payload=Object.fromEntries(new FormData(form));payload.kind=form.dataset.kind;try{const r=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await r.json();if(!r.ok)throw new Error(result.error||'Request failed');status.textContent='✓ Thanks! We have received your request and will be in touch to discuss it.';form.reset()}catch(err){status.textContent=err.message||'Unable to send. Please try again.'}finally{button.disabled=false}});
