document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. INICIALIZAR LENIS (Smooth Scroll Premium)
    // ==========================================
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Easing súper suave
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    // Conectar Lenis con el loop de animación del navegador
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // ==========================================
    // 2. INICIALIZAR GSAP SCROLLTRIGGER
    // ==========================================
    gsap.registerPlugin(ScrollTrigger);

    // Animación inicial del Hero (Aparece en cascada)
    const heroTl = gsap.timeline();
    heroTl.from(".hero-content h1", { y: 50, opacity: 0, duration: 1, ease: "power3.out" })
          .from(".hero-content p", { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.6")
          .from(".hero-actions", { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.6")
          .from(".hero-dashboard", { y: 100, opacity: 0, rotationX: 25, duration: 1.5, ease: "power4.out" }, "-=0.8");

    // Animación de aparición para elementos en scroll
    gsap.utils.toArray('.gsap-fade-up, .feature-card, .step').forEach(elem => {
        gsap.from(elem, {
            scrollTrigger: {
                trigger: elem,
                start: "top 85%", // Se activa cuando el elemento está al 85% de la pantalla
                toggleActions: "play none none reverse"
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out"
        });
    });

    // Efecto Parallax sutil en el Dashboard al hacer scroll
    gsap.to(".hero-dashboard", {
        scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: true
        },
        y: 150,
        ease: "none"
    });

    // ==========================================
    // 3. EFECTOS INTERACTIVOS PREMIUM (Mouse Tracking)
    // ==========================================
    const mouseGlow = document.querySelector('.mouse-glow');
    const heroImage = document.querySelector('.hero-dashboard img');

    window.addEventListener('mousemove', (e) => {
        // Hace que el fondo brillante siga el cursor
        if (mouseGlow) {
            mouseGlow.style.setProperty('--mouse-x', `${e.clientX}px`);
            mouseGlow.style.setProperty('--mouse-y', `${e.clientY}px`);
        }

        // Parallax 3D interactivo para la imagen del Hero
        if (heroImage) {
            // Calculamos la posición del ratón respecto al centro de la pantalla
            const xAxis = (window.innerWidth / 2 - e.clientX) / 40; 
            const yAxis = (window.innerHeight / 2 - e.clientY) / 40; 

            // Movimiento fluido con GSAP
            gsap.to(heroImage, {
                rotationY: xAxis,
                rotationX: yAxis,
                duration: 1.5,
                ease: "power2.out"
            });
        }
    });

    // Reiniciar la imagen a su posición original cuando el ratón sale de la ventana
    window.addEventListener('mouseleave', () => {
        if (heroImage) {
            gsap.to(heroImage, {
                rotationY: 0,
                rotationX: 0,
                duration: 1.5,
                ease: "power2.out"
            });
        }
    });

    // ==========================================
    // 4. LÓGICA DE INTERFAZ ORIGINAL 
    // ==========================================

    // Lógica del Menú Móvil
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            
            // Detener el smooth scroll cuando el menú está abierto para evitar bugs visuales
            if(mobileMenu.classList.contains('active')) {
                lenis.stop();
            } else {
                lenis.start();
            }
        });

        // Cierra el menú al hacer clic en un enlace
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
                lenis.start();
            });
        });
    }

    // Lógica del Acordeón de FAQ
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');

        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Cerrar todos los demás items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                    otherItem.querySelector('.faq-answer').style.maxHeight = null;
                }
            });

            // Abrir o cerrar el item actual
            if (isActive) {
                item.classList.remove('active');
                answer.style.maxHeight = null;
            } else {
                item.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + "px";
            }
        });
    });
});