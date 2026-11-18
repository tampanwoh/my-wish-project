(function(){
  var apiBaseUrl = window.APP_CONFIG ? window.APP_CONFIG.apiBaseUrl.replace(/\/$/,'') : '';
  var token = sessionStorage.getItem('wishAdminToken') || '';
  var orders = [];
  var loginPanel = document.getElementById('loginPanel');
  var dashboardPanel = document.getElementById('dashboardPanel');
  var loginForm = document.getElementById('loginForm');
  var loginButton = document.getElementById('loginButton');
  var loginMessage = document.getElementById('loginMessage');
  var dashboardMessage = document.getElementById('dashboardMessage');
  var ordersBody = document.getElementById('ordersBody');
  var searchInput = document.getElementById('searchInput');

  function setMessage(element, text, success){
    element.textContent = text || '';
    element.className = 'message' + (success ? ' success' : '');
  }

  async function api(path, options){
    if(!apiBaseUrl) throw new Error('Backend belum dikonfigurasi.');
    options = options || {};
    options.headers = Object.assign({'Content-Type':'application/json'}, options.headers || {});
    if(token) options.headers.Authorization = 'Bearer ' + token;
    var response = await fetch(apiBaseUrl + path, options);
    var data;
    try {
      data = await response.json();
    } catch(error) {
      throw new Error('Respons backend tidak valid.');
    }
    if(!response.ok) {
      if(response.status === 401) clearSession();
      throw new Error(data.error || 'Permintaan gagal.');
    }
    return data;
  }

  function showLogin(){
    loginPanel.classList.remove('hidden');
    dashboardPanel.classList.add('hidden');
  }

  function showDashboard(){
    loginPanel.classList.add('hidden');
    dashboardPanel.classList.remove('hidden');
  }

  function clearSession(){
    token = '';
    sessionStorage.removeItem('wishAdminToken');
    showLogin();
  }

  function textCell(text){
    var cell = document.createElement('td');
    cell.textContent = text;
    return cell;
  }

  function renderOrders(){
    var query = searchInput.value.trim().toLowerCase();
    var visible = orders.filter(function(order){
      return [order.name, order.phone, order.email].some(function(value){
        return String(value || '').toLowerCase().includes(query);
      });
    });
    ordersBody.replaceChildren();
    if(!visible.length){
      var empty = document.createElement('tr');
      var cell = document.createElement('td');
      cell.className = 'empty';
      cell.colSpan = 7;
      cell.textContent = orders.length ? 'Tidak ada order yang cocok.' : 'Belum ada order.';
      empty.appendChild(cell);
      ordersBody.appendChild(empty);
      return;
    }

    visible.forEach(function(order){
      var row = document.createElement('tr');
      var date = new Date(order.created_at);
      row.appendChild(textCell(isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID')));

      var customer = document.createElement('td');
      var name = document.createElement('strong');
      name.textContent = order.name;
      var id = document.createElement('small');
      id.textContent = '#' + order.id;
      customer.append(name, id);
      row.appendChild(customer);

      var contact = document.createElement('td');
      var phone = document.createElement('a');
      phone.href = 'https://wa.me/' + encodeURIComponent(order.phone);
      phone.target = '_blank';
      phone.rel = 'noopener noreferrer';
      phone.textContent = order.phone;
      var email = document.createElement('small');
      email.textContent = order.email;
      contact.append(phone, email);
      row.appendChild(contact);

      var methodNames = {qris:'QRIS', ewallet:'E-Wallet / VA', scalev:'Scalev'};
      row.appendChild(textCell(methodNames[order.payment_method] || order.payment_method));
      row.appendChild(textCell('Rp' + Number(order.amount).toLocaleString('id-ID')));

      var statusCell = document.createElement('td');
      var select = document.createElement('select');
      select.className = 'status-select';
      [['pending','Menunggu'],['paid','Lunas'],['cancelled','Dibatalkan']].forEach(function(optionData){
        var option = document.createElement('option');
        option.value = optionData[0];
        option.textContent = optionData[1];
        option.selected = order.status === optionData[0];
        select.appendChild(option);
      });
      statusCell.appendChild(select);
      row.appendChild(statusCell);

      var actionCell = document.createElement('td');
      var saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'save-status';
      saveButton.textContent = 'Simpan';
      saveButton.addEventListener('click', function(){ updateStatus(order.id, select.value, saveButton); });
      actionCell.appendChild(saveButton);
      row.appendChild(actionCell);
      ordersBody.appendChild(row);
    });
  }

  async function loadOrders(){
    setMessage(dashboardMessage, 'Memuat order…');
    try {
      var result = await api('/api/admin/orders', {method:'GET'});
      orders = result.orders;
      document.getElementById('totalCount').textContent = orders.length;
      document.getElementById('pendingCount').textContent = orders.filter(function(order){ return order.status === 'pending'; }).length;
      document.getElementById('paidCount').textContent = orders.filter(function(order){ return order.status === 'paid'; }).length;
      renderOrders();
      setMessage(dashboardMessage, '', true);
    } catch(error) {
      setMessage(dashboardMessage, error.message);
    }
  }

  async function updateStatus(id, status, button){
    button.disabled = true;
    try {
      await api('/api/admin/orders/' + encodeURIComponent(id), {
        method:'PATCH',
        body:JSON.stringify({status:status})
      });
      setMessage(dashboardMessage, 'Status order berhasil diperbarui.', true);
      await loadOrders();
    } catch(error) {
      setMessage(dashboardMessage, error.message);
    } finally {
      button.disabled = false;
    }
  }

  loginForm.addEventListener('submit', async function(event){
    event.preventDefault();
    setMessage(loginMessage, '');
    loginButton.disabled = true;
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;
    try {
      var result = await api('/api/admin/login', {
        method:'POST',
        body:JSON.stringify({username:username, password:password})
      });
      token = result.token;
      sessionStorage.setItem('wishAdminToken', token);
      document.getElementById('password').value = '';
      showDashboard();
      await loadOrders();
    } catch(error) {
      setMessage(loginMessage, error.message);
    } finally {
      loginButton.disabled = false;
    }
  });

  document.getElementById('refreshButton').addEventListener('click', loadOrders);
  document.getElementById('logoutButton').addEventListener('click', async function(){
    try {
      await api('/api/admin/logout', {method:'POST'});
    } catch(error) {
      console.error('Sesi admin tidak dapat dihapus di server:', error);
    } finally {
      clearSession();
    }
  });
  searchInput.addEventListener('input', renderOrders);

  if(token){
    showDashboard();
    loadOrders();
  } else {
    showLogin();
  }
})();
