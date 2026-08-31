document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 0. LÓGICA DE MODO CLARO / OSCURO GUARDADO
    // ==========================================
    const bodyEl = document.body;
    const themeToggles = document.querySelectorAll('.theme-toggle');
    const savedTheme = localStorage.getItem('citaspro-theme') || 'dark-mode';
    
    // Aplicamos el tema guardado en el navegador
    bodyEl.className = savedTheme;

    themeToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const currentTheme = bodyEl.className;
            const newTheme = currentTheme === 'dark-mode' ? 'light-mode' : 'dark-mode';
            bodyEl.className = newTheme;
            localStorage.setItem('citaspro-theme', newTheme);
        });
    });

    // ==========================================
    // 1. INICIALIZAR LENIS (Smooth Scroll Premium)
    // ==========================================
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // ==========================================
    // 2. GSAP SCROLLTRIGGER (LIBRE DE BUGS)
    // ==========================================
    gsap.registerPlugin(ScrollTrigger);

    const heroTl = gsap.timeline();
    heroTl.from(".hero-content h1", { y: 50, opacity: 0, duration: 1, ease: "power3.out" })
          .from(".hero-content p", { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.6")
          .from(".hero-actions", { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.6")
          .from(".hero-dashboard", { y: 100, opacity: 0, rotationX: 25, duration: 1.5, ease: "power4.out" }, "-=0.8");

    // SOLUCIÓN AL BUG: clearProps limpia la animación para que Vanilla Tilt funcione
    gsap.utils.toArray('.gsap-fade-up').forEach(elem => {
        gsap.from(elem, {
            scrollTrigger: {
                trigger: elem,
                start: "top 85%",
                toggleActions: "play none none none"
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
            clearProps: "all" 
        });
    });

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
    // 3. EFECTOS INTERACTIVOS PREMIUM 
    // ==========================================
    const mouseGlow = document.querySelector('.mouse-glow');
    const heroImage = document.querySelector('.hero-dashboard img');

    window.addEventListener('mousemove', (e) => {
        if (mouseGlow) {
            mouseGlow.style.setProperty('--mouse-x', `${e.clientX}px`);
            mouseGlow.style.setProperty('--mouse-y', `${e.clientY}px`);
        }
        if (heroImage) {
            const xAxis = (window.innerWidth / 2 - e.clientX) / 40; 
            const yAxis = (window.innerHeight / 2 - e.clientY) / 40; 
            gsap.to(heroImage, { rotationY: xAxis, rotationX: yAxis, duration: 1.5, ease: "power2.out" });
        }
    });

    window.addEventListener('mouseleave', () => {
        if (heroImage) {
            gsap.to(heroImage, { rotationY: 0, rotationX: 0, duration: 1.5, ease: "power2.out" });
        }
    });

    // ==========================================
    // 4. LÓGICA DE MENÚ MÓVIL Y FAQ
    // ==========================================
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            if(mobileMenu.classList.contains('active')) {
                lenis.stop();
            } else {
                lenis.start();
            }
        });

        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
                lenis.start();
            });
        });
    }

    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');

        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                    otherItem.querySelector('.faq-answer').style.maxHeight = null;
                }
            });
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