// assets/js/paises-precios.js

// 1. Diccionario de precios por país
const preciosPorPais = {
  "PE": "S/ 30",       // Perú (Soles)
  "ES": "10€",         // España (Euros)
  "CO": "$ 40.000",    // Colombia (Pesos colombianos)
  "MX": "$ 200",       // México (Pesos mexicanos)
  "CL": "$ 10.000",    // Chile (Pesos chilenos)
  "AR": "$ 10.000",    // Argentina (Pesos argentinos)
  "US": "$ 10"         // Estados Unidos (Dólares)
};

// 2. Función para detectar país y cambiar el texto
async function adaptarPrecioLocal() {
  try {
    // Usamos una API gratuita para detectar el país por la IP
    const respuesta = await fetch('https://ipapi.co/json/');
    const datos = await respuesta.json();
    
    const codigoPais = datos.country_code; // Devuelve "PE", "ES", etc.
    
    // Buscamos si tenemos un precio para ese país. Si no, usamos 10€ como predeterminado
    const precioBase = preciosPorPais[codigoPais] || "10€";
    
    // Cambiamos los textos que llevan "/mes" (Ej: "10€/mes" -> "S/ 30/mes")
    const elementosMes = document.querySelectorAll('.precio-local-mes');
    elementosMes.forEach(el => {
      el.innerText = precioBase + '/mes';
    });

    // Cambiamos los textos que son solo el precio (Ej: "10€" -> "S/ 30")
    const elementosSolo = document.querySelectorAll('.precio-local-solo');
    elementosSolo.forEach(el => {
      el.innerText = precioBase;
    });
    
  } catch (error) {
    console.log("No se pudo detectar el país, se mantiene el precio por defecto.", error);
  }
}

// 3. Ejecutar la función apenas cargue la página
document.addEventListener('DOMContentLoaded', adaptarPrecioLocal);