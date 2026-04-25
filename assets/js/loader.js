'use strict';

/**
 * Carga un componente HTML dinámicamente y lo inyecta en el DOM.
 * @param {string} url La ruta al archivo HTML (ej. 'frontend/components/modals.html')
 * @param {string} targetId El ID del contenedor donde se inyectará. Si no existe, se crea.
 * @param {boolean} append Si es true, añade al contenedor en vez de reemplazar.
 */
async function loadComponent(url, targetId, append = false) {
  try {
    const response = await fetch(url + '?v=' + Date.now()); // Evitar caché estricto
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();
    
    let container = document.getElementById(targetId);
    if (!container) {
       container = document.createElement('div');
       container.id = targetId;
       document.body.appendChild(container);
    }
    
    if (append) {
      container.insertAdjacentHTML('beforeend', html);
    } else {
      container.innerHTML = html;
    }
  } catch (err) {
    console.error("Error cargando el componente: " + url, err);
  }
}

/**
 * Carga todos los componentes principales antes de iniciar la app.
 */
async function bootComponents() {
  const componentsToLoad = [
    { url: 'frontend/views/admin.html', id: 's-admin', class: 'scr' },
    { url: 'frontend/views/barber-portal.html', id: 's-barber-portal', class: 'scr' },
    { url: 'frontend/views/biz.html', id: 's-biz', class: 'scr' },
    { url: 'frontend/views/worker.html', id: 's-worker', class: 'scr' },
    { url: 'frontend/views/client.html', id: 's-client', class: 'scr' },
    { url: 'frontend/components/modals.html', id: 'modals-container' },
  ];

  // Pre-crear contenedores para mantener el orden del CSS
  componentsToLoad.forEach(c => {
    if (!document.getElementById(c.id)) {
      let div = document.createElement('div');
      div.id = c.id;
      if (c.class) div.className = c.class;
      document.body.appendChild(div);
    }
  });

  // Descargar e inyectar en paralelo
  await Promise.all(componentsToLoad.map(c => loadComponent(c.url, c.id)));
}

window.bootComponents = bootComponents;
