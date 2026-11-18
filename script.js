/* ===== ISI NILAI INI ===== */
var CHECKOUT_URL = "";                         // contoh: https://lynk.id/mywishproject/xxxx
var WA_NUMBER    = "";                         // contoh: 6281234567890 (tanpa +)
var LAUNCH_END   = "2026-11-30T23:59:59+07:00"; // akhir harga peluncuran (harus benar-benar Anda terapkan)
var API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.apiBaseUrl : "";
/* ========================= */

/* Rekening untuk transfer manual. Kosongkan array ([]) jika tidak dipakai. */
var BANKS = [
  // { bank: "Bank Rakyat Indonesia (BRI)", icon: "🏦", name: "Nama Pemilik", no: "1234567890" },
  // { bank: "Bank Syariah Indonesia (BSI)", icon: "🏦", name: "Nama Pemilik", no: "1234567890" }
];

document.querySelectorAll('[data-checkout]').forEach(function(a){ a.href = "#pesan"; });

/* ---------- Form pemesanan ---------- */
(function(){
  var METHODS = [
    {id:'qris', title:'QRIS', icon:'▦', desc:'Scan pakai e-wallet / m-banking apa saja', fast:true, gateway:true},
    {id:'ewallet', title:'E-Wallet & Virtual Account', icon:'👛', desc:'GoPay, OVO, DANA, ShopeePay, VA bank, dll.', gateway:true}
  ];
  BANKS.forEach(function(b,i){ METHODS.push({id:'bank'+i, title:b.bank, icon:b.icon||'🏦', desc:'Transfer manual a.n. '+b.name, bank:b}); });

  var sel = METHODS[0];
  var box = document.getElementById('methods');
  var btn = document.getElementById('payBtn');
  var sumM = document.getElementById('sum-method');
  var status = document.getElementById('status');
  var bankbox = document.getElementById('bankbox');

  function label(m){ return m.bank ? 'Lihat Rekening & Konfirmasi →' : 'Bayar dengan ' + (m.id==='qris'?'QRIS':'E-Wallet / VA') + ' →'; }
  function render(){
    box.innerHTML = '';
    METHODS.forEach(function(m){
      var l = document.createElement('label');
      l.className = 'pm' + (m===sel?' sel':'');
      l.innerHTML = '<input type="radio" name="pm"><span class="dot"></span><span class="logo2">'+m.icon+'</span>'+
        '<span class="t"><b>'+m.title+'</b><span>'+m.desc+'</span></span>'+(m.fast?'<span class="fast">Tercepat</span>':'');
      l.addEventListener('click', function(e){ e.preventDefault(); sel = m; render(); hide(); });
      box.appendChild(l);
    });
    btn.textContent = label(sel);
    sumM.textContent = sel.bank ? 'Transfer ' + sel.title : sel.title;
  }
  function hide(){ status.className='status'; bankbox.className='bankbox'; }
  function setErr(id,bad){ document.getElementById(id).classList.toggle('err',bad); return !bad; }
  function normWA(v){ v = v.replace(/[^0-9]/g,''); if(v.indexOf('0')===0) v='62'+v.slice(1); else if(v.indexOf('8')===0) v='62'+v; return v; }
  function msg(cls,t){ status.className='status show '+cls; status.textContent=t; }
  async function saveOrder(order){
    var response = await fetch(API_BASE_URL.replace(/\/$/,'') + '/api/orders', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(order)
    });
    var data = await response.json();
    if(!response.ok) throw new Error(data.error || 'Order gagal disimpan.');
    return data;
  }

  document.getElementById('orderForm').addEventListener('submit', async function(e){
    e.preventDefault(); hide();
    var name = document.getElementById('name').value.trim();
    var wa = normWA(document.getElementById('wa').value);
    var email = document.getElementById('email').value.trim();
    var ok = true;
    ok = setErr('f-name', name.length < 2) && ok;
    ok = setErr('f-wa', !/^62[0-9]{8,13}$/.test(wa)) && ok;
    ok = setErr('f-email', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) && ok;
    if(!ok) return;

    if(!API_BASE_URL){ msg('warn','Pemesanan belum aktif: backend order belum dikonfigurasi.'); return; }
    btn.disabled = true;
    try {
      var order = await saveOrder({name:name, phone:wa, email:email, payment_method:sel.id});
      if(sel.gateway){
        if(!CHECKOUT_URL){
          msg('ok','Order #' + order.id + ' tercatat dengan status menunggu pembayaran. Link pembayaran belum dipasang.');
          return;
        }
        var u = CHECKOUT_URL + (CHECKOUT_URL.indexOf('?')>-1?'&':'?') +
          new URLSearchParams({name:name, phone:wa, email:email, method:sel.id, order_id:order.id}).toString();
        msg('ok','Order tercatat. Mengarahkan ke halaman pembayaran…');
        var a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
      } else {
        var b = sel.bank;
        var text = 'Halo admin My Wish Project, saya ' + name + ' (' + wa + ', ' + email + ') sudah transfer Rp49.999 ke ' + b.bank + ' untuk order ' + order.id + ' ebook Wish Come True. Berikut bukti transfernya.';
        var waLink = WA_NUMBER ? 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text) : '';
        bankbox.innerHTML = '<b>Order #' + order.id + '</b><br><b>Transfer Rp49.999 ke:</b><br>' + b.bank + '<br><span class="no" id="bno">' + b.no + '</span><button type="button" class="cp" id="cpbtn">Salin</button><br>a.n. ' + b.name +
          '<br><br>Setelah transfer, kirim bukti ke admin supaya akses ebook diproses.' +
          (waLink ? '<br><br><a class="btn block confirm-btn" target="_blank" rel="noopener" href="' + waLink + '">Konfirmasi via WhatsApp</a>' : '<br><br><i>Nomor WhatsApp admin belum diisi.</i>');
        bankbox.className = 'bankbox show';
        var c = document.getElementById('cpbtn');
        c.onclick = function(){
          try {
            navigator.clipboard.writeText(b.no).then(function(){ c.textContent='Tersalin'; }).catch(function(){ c.textContent='Salin manual'; });
          } catch(error) {
            c.textContent='Salin manual';
          }
        };
      }
    } catch(error) {
      console.error('Order gagal disimpan:', error);
      msg('warn',error.message || 'Order gagal disimpan. Coba lagi.');
    } finally {
      btn.disabled = false;
    }
  });
  render();
})();
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
