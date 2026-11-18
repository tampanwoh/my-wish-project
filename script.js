/* ===== ISI NILAI INI ===== */
var CHECKOUT_URL = "https://my-wish-project.myscalev.com/p/ebook-wish-come-true";
var WA_NUMBER    = "";                         // contoh: 6281234567890 (tanpa +)
var LAUNCH_END   = "2026-11-30T23:59:59+07:00"; // akhir harga peluncuran (harus benar-benar Anda terapkan)
var API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.apiBaseUrl : "";
/* ========================= */

document.querySelectorAll('[data-checkout]').forEach(function(a){
  a.href = CHECKOUT_URL;
});
if (WA_NUMBER) document.getElementById('contact').innerHTML = 'WhatsApp admin: <a class="contact-link" href="https://wa.me/' + WA_NUMBER + '">+' + WA_NUMBER + '</a>';

/* countdown */
(function(){
  var end = new Date(LAUNCH_END).getTime();
  var wrap = document.getElementById('cdwrap'), raise = document.getElementById('raise');
  function pad(n){ return (n<10?'0':'') + n; }
  function tick(){
    var diff = end - Date.now();
    if (isNaN(end) || diff <= 0){ wrap.style.display='none'; raise.style.display='none'; return false; }
    var s = Math.floor(diff/1000);
    document.getElementById('cd-d').textContent = pad(Math.floor(s/86400));
    document.getElementById('cd-h').textContent = pad(Math.floor(s%86400/3600));
    document.getElementById('cd-m').textContent = pad(Math.floor(s%3600/60));
    document.getElementById('cd-s').textContent = pad(s%60);
    return true;
  }
  if (tick()) var t = setInterval(function(){ if(!tick()) clearInterval(t); }, 1000);
})();

/* reveal on scroll */
var io = new IntersectionObserver(function(es){
  es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{threshold:.12});
document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });

/* sticky bar appears after hero */
var bar = document.getElementById('bar');
function onScroll(){ bar.classList.toggle('show', window.scrollY > 520); }
window.addEventListener('scroll', onScroll, {passive:true}); onScroll();
