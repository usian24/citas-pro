(function() {
  'use strict';

  var searchInput   = document.getElementById('portal-search-input');
  var searchResults = document.getElementById('portal-search-results');
  var searchSpinner = document.getElementById('portal-search-spinner');
  var searchTimer   = null;

  if (!searchInput) return;

  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimer);
    var q = searchInput.value.trim();

    if (!q || q.length < 2) {
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      searchSpinner.style.display = 'none';
      return;
    }
    searchTimer = setTimeout(function() { doSearch(q); }, 250);
  });

  function sanitizeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function doSearch(q) {
    searchSpinner.style.display = 'block';
    var businesses = (typeof DB !== 'undefined' && DB.businesses) ? DB.businesses : [];
    var ql = q.toLowerCase();

    var results = businesses.filter(function(biz) {
      if (!biz || !biz.name) return false;
      return biz.name.toLowerCase().indexOf(ql) >= 0 || (biz.city && biz.city.toLowerCase().indexOf(ql) >= 0);
    }).slice(0, 6);

    searchSpinner.style.display = 'none';
    renderResults(results, q);
  }

  function renderResults(results, q) {
    searchResults.style.display = 'block';
    searchResults.innerHTML = '';

    if (!results.length) {
      searchResults.innerHTML = '<div class="portal-search-empty">Barbería no encontrada</div>';
      return;
    }

    results.forEach(function(biz) {
      var item = document.createElement('div');
      item.className = 'portal-search-result-item';

      var avatarHtml;
      if (biz.logo) {
        avatarHtml = '<img src="' + sanitizeHtml(biz.logo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px" alt="Logo"/>';
      } else {
        avatarHtml = '<span style="font-size:20px;font-weight:900;color:#fff">' + sanitizeHtml((biz.name || '?').charAt(0).toUpperCase()) + '</span>';
      }

      var meta = [biz.type, biz.city].filter(Boolean).join(' · ');

      item.innerHTML =
        '<div class="portal-search-avatar">' + avatarHtml + '</div>'
        + '<div style="flex:1;min-width:0">'
        +   '<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + sanitizeHtml(biz.name) + '</div>'
        +   '<div style="font-size:12px;color:var(--t2);margin-top:2px">' + sanitizeHtml(meta) + '</div>'
        + '</div>'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"></polyline></svg>';

      item.addEventListener('click', function() {
        searchResults.style.display = 'none';
        searchInput.value = '';
        // Búsqueda estricta por ID
        loadBarberPortal(String(biz.id));
      });

      searchResults.appendChild(item);
    });
  }

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.portal-search-wrap')) {
      searchResults.style.display = 'none';
    }
  });

  window.loadBarberPortal = function(bizId) {
    var biz = null;
    
    // Búsqueda estricta para asegurar que carga la barbería correcta
    if (typeof DB !== 'undefined' && DB.businesses) {
      biz = DB.businesses.find(function(b) { return String(b.id) === String(bizId); });
    }
    if (!biz && typeof getBizById === 'function') {
      biz = getBizById(bizId);
    }
    
    if (!biz) return;

    var cover = document.getElementById('bp-cover');
    if (biz.cover) {
      cover.style.backgroundImage = 'url(' + sanitizeHtml(biz.cover) + ')';
    } else {
      cover.style.backgroundImage = 'none'; 
      cover.style.backgroundColor = 'var(--bg3)';
    }

    var logo = document.getElementById('bp-logo');
    if (biz.logo) logo.innerHTML = '<img src="' + sanitizeHtml(biz.logo) + '" style="width:100%;height:100%;object-fit:cover;" alt="Logo"/>';
    else logo.textContent = (biz.name || '?').charAt(0).toUpperCase();

    document.getElementById('bp-name').textContent = biz.name || 'Barbería';
    document.getElementById('bp-desc').textContent = (biz.addr || '') + (biz.city ? ', ' + biz.city : '');
    document.getElementById('bs-name').textContent = biz.name || 'Barbería';

    var socialsContainer = document.getElementById('bp-socials');
    var socialsHtml = '';
    
    if (biz.insta) {
      var cleanInsta = biz.insta.replace(/^(https?:\/\/)?(www\.)?instagram\.com\/?/i, '').replace(/[@/]/g, '').trim();
      var igUrl = 'https://www.instagram.com/' + cleanInsta;
      
      socialsHtml += '<a href="' + sanitizeHtml(igUrl) + '" target="_blank" style="color:var(--text); transition:opacity 0.2s" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></a>';
    }
    
    if (biz.facebook) {
      var cleanFb = biz.facebook.replace(/^(https?:\/\/)?(www\.)?facebook\.com\/?/i, '').replace(/^\//, '').trim();
      var fbUrl = 'https://www.facebook.com/' + cleanFb;
      
      socialsHtml += '<a href="' + sanitizeHtml(fbUrl) + '" target="_blank" style="color:var(--text); transition:opacity 0.2s" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>';
    }
    
    if (biz.x_url) {
      var cleanX = biz.x_url.replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i, '').replace(/[@/]/g, '').trim();
      var xUrl = 'https://x.com/' + cleanX;
      
      socialsHtml += '<a href="' + sanitizeHtml(xUrl) + '" target="_blank" style="color:var(--text); transition:opacity 0.2s" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></svg></a>';
    }
    
    socialsContainer.innerHTML = socialsHtml;

    document.getElementById('bp-btn-book').onclick = function() {
      if (typeof loadBizDirect === 'function') loadBizDirect(bizId);
    };
    
    document.getElementById('bp-btn-shop').onclick = function() {
      if (typeof goTo === 'function') goTo('s-barber-shop');
    };

    if (typeof goTo === 'function') goTo('s-barber-portal');
  };

  // -----------------------------------------
  // LÓGICA DEL AGENTE FELIZ EVA (WHATSAPP Y TEXTOS)
  // -----------------------------------------
  var bubble = document.getElementById('robot-bubble');
  
  if (bubble) {
    var mensajes = [
      "¡Hola! Bienvenido a Citas Pro Barber",
      "¿En qué podemos ayudarte? ",
      "Busca tu negocio favorito arriba 👆",
      "Contáctate con nosotros por WhatsApp 💬"
    ];
    
    var msgIndex = 0;

    bubble.style.opacity = '1';
    bubble.style.transform = 'translateY(0)';

    setInterval(function() {
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(10px)';
      
      setTimeout(function() {
        msgIndex = (msgIndex + 1) % mensajes.length;
        bubble.textContent = mensajes[msgIndex];
        
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(0)';
      }, 7000);
      
    }, 5000); 
  }

})();