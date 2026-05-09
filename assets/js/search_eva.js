(function () {
  'use strict';

  var searchInput = document.getElementById('portal-search-input');
  var searchResults = document.getElementById('portal-search-results');
  var searchSpinner = document.getElementById('portal-search-spinner');
  var searchTimer = null;

  if (!searchInput) return;

  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    var q = searchInput.value.trim();

    if (!q || q.length < 2) {
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      searchSpinner.style.display = 'none';
      return;
    }
    searchTimer = setTimeout(function () { doSearch(q); }, 250);
  });

  function sanitizeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function doSearch(q) {
    searchSpinner.style.display = 'block';
    var businesses = (typeof DB !== 'undefined' && DB.businesses) ? DB.businesses : [];
    var ql = q.toLowerCase();

    var results = businesses.filter(function (biz) {
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

    results.forEach(function (biz) {
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
        + '<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + sanitizeHtml(biz.name) + '</div>'
        + '<div style="font-size:12px;color:var(--t2);margin-top:2px">' + sanitizeHtml(meta) + '</div>'
        + '</div>'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"></polyline></svg>';

      item.addEventListener('click', async function () {
        searchResults.style.display = 'none';
        searchInput.value = '';
        searchSpinner.style.display = 'block';
        if (typeof fetchBizFromCloud === 'function' && typeof syncBizToLocal === 'function') {
          var bizData = await fetchBizFromCloud(String(biz.id));
          if (bizData) syncBizToLocal(bizData);
        }
        searchSpinner.style.display = 'none';
        // Búsqueda estricta por ID
        loadBarberPortal(String(biz.id));
      });

      searchResults.appendChild(item);
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.portal-search-wrap')) {
      searchResults.style.display = 'none';
    }
  });

  window.loadBarberPortal = function (bizId) {
    if (typeof loadBizDirect === 'function') {
      loadBizDirect(bizId);
    } else {
      console.error("Falta loadBizDirect de client-portal.js");
    }
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

    setInterval(function () {
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(10px)';

      setTimeout(function () {
        msgIndex = (msgIndex + 1) % mensajes.length;
        bubble.textContent = mensajes[msgIndex];

        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(0)';
      }, 7000);

    }, 5000);
  }

})();