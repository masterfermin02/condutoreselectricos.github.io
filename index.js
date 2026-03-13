(function () {
  if (typeof window === 'undefined' || typeof window.gsap === 'undefined') {
    return;
  }

  var body = document.body;
  var preloader = document.querySelector('.preloader');
  var webglStarted = false;
  var currentYear = document.getElementById('current-year');
  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    if (preloader) {
      preloader.remove();
    }
    if (body) {
      body.classList.remove('is-loading');
    }
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;

  if (ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  var setIfExists = function (selector, vars) {
    var nodes = document.querySelectorAll(selector);
    if (nodes.length) {
      gsap.set(nodes, vars);
    }
  };

  var animateOnScroll = function (selector, fromVars, extraVars) {
    var nodes = document.querySelectorAll(selector);
    if (!nodes.length || !ScrollTrigger) {
      return;
    }

    nodes.forEach(function (node) {
      gsap.fromTo(
        node,
        fromVars,
        Object.assign(
          {
            y: 0,
            x: 0,
            opacity: 1,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: node,
              start: 'top 82%'
            }
          },
          extraVars || {}
        )
      );
    });
  };

  var initSmoothAnchorScroll = function () {
    var header = document.querySelector('.site-header');
    var links = document.querySelectorAll('a[href^="#"]');
    if (!links.length) {
      return;
    }

    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var href = link.getAttribute('href');
        if (!href || href === '#') {
          return;
        }

        var target = document.querySelector(href);
        if (!target) {
          return;
        }

        event.preventDefault();

        var headerOffset = header ? header.offsetHeight + 16 : 96;
        var targetTop = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        var destination = Math.min(Math.max(0, targetTop), maxScroll);
        var state = { value: window.pageYOffset };

        gsap.killTweensOf(state);
        gsap.to(state, {
          value: destination,
          duration: 1.1,
          ease: 'power2.inOut',
          overwrite: true,
          onUpdate: function () {
            window.scrollTo(0, state.value);
          },
          onComplete: function () {
            if (history.pushState) {
              history.pushState(null, '', href);
            } else {
              window.location.hash = href;
            }
          }
        });
      });
    });
  };

  var animateStats = function () {
    if (!ScrollTrigger) {
      return;
    }

    var statValues = document.querySelectorAll('.stats .stat strong');
    if (!statValues.length) {
      return;
    }

    statValues.forEach(function (node) {
      var rawValue = (node.textContent || '').trim();
      var match = rawValue.match(/^(\d+)(\+?)$/);
      if (!match) {
        return;
      }

      var target = parseInt(match[1], 10);
      var suffix = match[2] || '';
      node.textContent = '0' + suffix;

      gsap.to(
        { value: 0 },
        {
          value: target,
          duration: target >= 100 ? 1.8 : 1.2,
          ease: 'power2.out',
          snap: { value: 1 },
          scrollTrigger: {
            trigger: node.closest('.stats'),
            start: 'top 82%',
            once: true
          },
          onUpdate: function () {
            node.textContent = Math.round(this.targets()[0].value) + suffix;
          }
        }
      );
    });
  };

  var initWebGLEnergy = function () {
    if (webglStarted) {
      return;
    }

    var canvases = document.querySelectorAll('.js-webgl-energy');
    if (!canvases.length) {
      return;
    }

    var vertexShaderSource = [
      'attribute vec2 a_position;',
      'void main() {',
      '  gl_Position = vec4(a_position, 0.0, 1.0);',
      '}'
    ].join('\n');

    var fragmentShaderSource = [
      'precision mediump float;',
      'uniform vec2 u_resolution;',
      'uniform float u_time;',
      'uniform vec3 u_primary;',
      'uniform vec3 u_accent;',
      'uniform float u_intensity;',
      'uniform vec2 u_pointer;',
      '',
      'float band(vec2 uv, float offset, float amp, float speed, float thickness) {',
      '  float wave = 0.5 + amp * sin((uv.x * 8.0) + (u_time * speed) + offset);',
      '  return smoothstep(thickness, 0.0, abs(uv.y - wave));',
      '}',
      '',
      'float spark(vec2 uv, vec2 center, float scale) {',
      '  float d = distance(uv, center);',
      '  return scale / max(d * 24.0, 0.08);',
      '}',
      '',
      'void main() {',
      '  vec2 uv = gl_FragCoord.xy / u_resolution.xy;',
      '  vec2 localUv = uv;',
      '  uv.x *= u_resolution.x / max(u_resolution.y, 1.0);',
      '  vec2 pointer = u_pointer;',
      '  pointer.x *= u_resolution.x / max(u_resolution.y, 1.0);',
      '  float pointerField = 1.0 - smoothstep(0.0, 0.52, distance(uv, pointer));',
      '',
      '  uv.y += (pointerField - 0.22) * 0.025;',
      '  float flowA = band(uv, 0.0, 0.082, 0.9, 0.024);',
      '  float flowB = band(uv, 2.1, 0.06, 1.15, 0.019);',
      '  float flowC = band(uv, 4.4, 0.042, 1.42, 0.014);',
      '  float pulse = 0.5 + 0.5 * sin(u_time * 1.35);',
      '  float energy = (flowA * 0.56) + (flowB * 0.72) + (flowC * 0.9);',
      '  energy += spark(uv, vec2(0.52 + 0.06 * sin(u_time * 0.4), 0.48), 0.016 + pulse * 0.01);',
      '  energy += spark(uv, vec2(1.18 + 0.03 * cos(u_time * 0.45), 0.34 + 0.02 * sin(u_time)), 0.009);',
      '  energy += pointerField * 0.11;',
      '',
      '  vec3 base = u_primary * (0.15 + (localUv.y * 0.2));',
      '  float accentMix = smoothstep(0.48, 1.15, energy);',
      '  vec3 glow = mix(u_primary, u_accent, accentMix);',
      '  vec3 color = base + (glow * energy * u_intensity);',
      '',
      '  float vignette = smoothstep(1.45, 0.18, distance(uv, vec2(0.9, 0.5)));',
      '  color *= 0.76 + (vignette * 0.28);',
      '',
      '  gl_FragColor = vec4(color, 0.8);',
      '}'
    ].join('\n');

    var compileShader = function (gl, type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    };

    var createProgram = function (gl) {
      var vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      var fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      if (!vertexShader || !fragmentShader) {
        return null;
      }

      var program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return null;
      }

      return program;
    };

    var instances = [];

    canvases.forEach(function (canvas) {
      var gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
      if (!gl) {
        return;
      }

      var program = createProgram(gl);
      if (!program) {
        return;
      }

      var positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
           1, -1,
          -1,  1,
          -1,  1,
           1, -1,
           1,  1
        ]),
        gl.STATIC_DRAW
      );

      var theme = canvas.getAttribute('data-energy-theme');
      var config = theme === 'cta'
        ? {
            primary: [0.08, 0.18, 0.31],
            accent: [0.58, 0.72, 0.88],
            intensity: 0.52,
            speed: 0.68
          }
        : {
            primary: [0.01, 0.10, 0.24],
            accent: [0.92, 0.62, 0.08],
            intensity: 0.74,
            speed: 0.84
          };

      instances.push({
        canvas: canvas,
        gl: gl,
        program: program,
        buffer: positionBuffer,
        position: gl.getAttribLocation(program, 'a_position'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        time: gl.getUniformLocation(program, 'u_time'),
        primary: gl.getUniformLocation(program, 'u_primary'),
        accent: gl.getUniformLocation(program, 'u_accent'),
        intensity: gl.getUniformLocation(program, 'u_intensity'),
        pointer: gl.getUniformLocation(program, 'u_pointer'),
        config: config
      });
    });

    if (!instances.length) {
      return;
    }

    webglStarted = true;

    instances.forEach(function (instance) {
      instance.pointerCurrent = { x: 0.52, y: 0.48 };
      instance.pointerTarget = { x: 0.52, y: 0.48 };

      if (instance.canvas.getAttribute('data-energy-theme') !== 'hero') {
        return;
      }

      var host = instance.canvas.closest('.hero');
      if (!host) {
        return;
      }

      host.addEventListener('pointermove', function (event) {
        var rect = host.getBoundingClientRect();
        instance.pointerTarget.x = (event.clientX - rect.left) / rect.width;
        instance.pointerTarget.y = (event.clientY - rect.top) / rect.height;
      });

      host.addEventListener('pointerleave', function () {
        instance.pointerTarget.x = 0.52;
        instance.pointerTarget.y = 0.48;
      });
    });

    var resize = function () {
      instances.forEach(function (instance) {
        var rect = instance.canvas.getBoundingClientRect();
        var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        instance.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
        instance.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
        instance.gl.viewport(0, 0, instance.canvas.width, instance.canvas.height);
      });
    };

    var render = function (time) {
      if (document.hidden) {
        window.requestAnimationFrame(render);
        return;
      }

      instances.forEach(function (instance) {
        var gl = instance.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      });

      instances.forEach(function (instance) {
        var gl = instance.gl;
        instance.pointerCurrent.x += (instance.pointerTarget.x - instance.pointerCurrent.x) * 0.02;
        instance.pointerCurrent.y += (instance.pointerTarget.y - instance.pointerCurrent.y) * 0.02;
        gl.useProgram(instance.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, instance.buffer);
        gl.enableVertexAttribArray(instance.position);
        gl.vertexAttribPointer(instance.position, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(instance.resolution, instance.canvas.width, instance.canvas.height);
        gl.uniform1f(instance.time, time * 0.001 * instance.config.speed);
        gl.uniform3fv(instance.primary, instance.config.primary);
        gl.uniform3fv(instance.accent, instance.config.accent);
        gl.uniform1f(instance.intensity, instance.config.intensity);
        gl.uniform2f(instance.pointer, instance.pointerCurrent.x, 1.0 - instance.pointerCurrent.y);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });

      window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    window.requestAnimationFrame(render);
  };

  setIfExists('.js-brand, .js-nav a, .js-header-actions .btn', {
    opacity: 0,
    y: -18
  });
  setIfExists('.js-hero-eyebrow, .js-hero-title, .js-hero-lead, .js-hero-actions, .js-hero-card', {
    opacity: 0,
    y: 36
  });
  setIfExists('.js-service-card, .js-contact-item, .js-footer-item, .js-reveal-up, .js-reveal-left, .js-reveal-right, .js-cta', {
    opacity: 0
  });
  setIfExists('.preloader__core', {
    scale: 0.78,
    opacity: 0
  });
  setIfExists('.preloader__logo', {
    scale: 0.82,
    opacity: 0,
    rotate: -8
  });
  setIfExists('.preloader__halo, .preloader__pulse, .preloader__caption', {
    opacity: 0
  });
  setIfExists('.preloader__scan', {
    yPercent: -140,
    opacity: 0
  });
  setIfExists('.preloader__spark', {
    opacity: 0,
    scale: 0.2
  });
  setIfExists('.preloader__logo-shell', {
    clipPath: 'inset(100% 0 0 0 round 1rem)'
  });
  setIfExists('.preloader__wire--left, .preloader__wire--right', {
    scaleX: 0.2,
    opacity: 0.3,
    transformOrigin: 'center center'
  });

  var intro = function () {
    initWebGLEnergy();

    var sequence = gsap.timeline({ defaults: { ease: 'power3.out' } });

    sequence
      .to('.js-brand', { opacity: 1, y: 0, duration: 0.55 })
      .to('.js-nav a', { opacity: 1, y: 0, duration: 0.45, stagger: 0.06 }, '-=0.3')
      .to('.js-header-actions .btn', { opacity: 1, y: 0, duration: 0.45, stagger: 0.08 }, '-=0.28')
      .to('.js-hero-eyebrow', { opacity: 1, y: 0, duration: 0.5 }, '-=0.1')
      .to('.js-hero-title', { opacity: 1, y: 0, duration: 0.8 }, '-=0.1')
      .to('.js-hero-lead', { opacity: 1, y: 0, duration: 0.65 }, '-=0.45')
      .to('.js-hero-actions', { opacity: 1, y: 0, duration: 0.55 }, '-=0.4')
      .to('.js-hero-card', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5');
  };

  var runPreloader = function () {
    if (!preloader) {
      if (body) {
        body.classList.remove('is-loading');
      }
      intro();
      return;
    }

    var preload = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () {
        if (body) {
          body.classList.remove('is-loading');
        }
        preloader.remove();
        intro();
      }
    });

    preload
      .to('.preloader__core', { opacity: 1, scale: 1, duration: 0.55 })
      .to('.preloader__logo-shell', { clipPath: 'inset(0% 0 0 0 round 1rem)', duration: 0.45 }, '-=0.28')
      .to('.preloader__logo', { opacity: 1, scale: 1, rotate: 0, duration: 0.42 }, '<')
      .to('.preloader__scan', { opacity: 1, yPercent: 120, duration: 0.58, ease: 'power2.inOut' }, '-=0.15')
      .to('.preloader__caption', { opacity: 1, y: -6, duration: 0.4 }, '-=0.2')
      .to('.preloader__wire--left, .preloader__wire--right', { opacity: 1, scaleX: 1, duration: 0.55 }, '-=0.35')
      .to('.preloader__halo', { opacity: 1, duration: 0.25 }, '-=0.25')
      .to('.preloader__pulse', { opacity: 1, duration: 0.2 }, '-=0.15')
      .to('.preloader__spark', { opacity: 1, scale: 1, duration: 0.18, stagger: 0.05 }, '-=0.25')
      .to('.preloader__wire--left', { '--charge-shift': '220%', duration: 0.85, ease: 'power2.inOut' }, 0)
      .to('.preloader__wire--right', { '--charge-shift': '-220%', duration: 0.85, ease: 'power2.inOut' }, 0)
      .to('.preloader__pulse', { scale: 1.2, opacity: 0.9, duration: 0.28, repeat: 1, yoyo: true }, '-=0.2')
      .to('.preloader__spark--1', { x: -18, y: -12, opacity: 0, duration: 0.22 }, '-=0.05')
      .to('.preloader__spark--2', { x: 20, y: -16, opacity: 0, duration: 0.22 }, '<')
      .to('.preloader__spark--3', { x: 18, y: 16, opacity: 0, duration: 0.22 }, '<')
      .to('.preloader__spark--4', { x: -16, y: 18, opacity: 0, duration: 0.22 }, '<')
      .to('.preloader__halo', { scale: 1.18, opacity: 0, duration: 0.45 }, '+=0.05')
      .to('.preloader__content', { y: -18, opacity: 0, duration: 0.45 }, '-=0.08')
      .to('.preloader__caption', { opacity: 0, duration: 0.25 }, '<')
      .to(preloader, { opacity: 0, duration: 0.4 }, '-=0.08');
  };

  gsap.to('.preloader__wire--left', {
    '--charge-shift': '220%',
    duration: 1.15,
    repeat: -1,
    ease: 'none'
  });

  gsap.to('.preloader__wire--right', {
    '--charge-shift': '-220%',
    duration: 1.15,
    repeat: -1,
    ease: 'none'
  });

  gsap.to('.preloader__halo', {
    scale: 1.08,
    duration: 1.3,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut'
  });

  gsap.to('.hero__backdrop', {
    yPercent: 10,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1
    }
  });

  gsap.to('.js-hero-card', {
    y: '-=10',
    duration: 2.4,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    delay: 1.2
  });

  animateOnScroll('.js-reveal-up', { y: 48, opacity: 0 });
  animateOnScroll('.js-reveal-left', { x: -56, opacity: 0 });
  animateOnScroll('.js-reveal-right', { x: 56, opacity: 0 });
  animateStats();
  initSmoothAnchorScroll();

  var serviceCards = document.querySelectorAll('.js-service-card');
  if (serviceCards.length && ScrollTrigger) {
    gsap.to(serviceCards, {
      opacity: 1,
      y: 0,
      duration: 0.75,
      stagger: 0.14,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.service-grid',
        start: 'top 75%'
      }
    });
  }

  var contactItems = document.querySelectorAll('.js-contact-item');
  if (contactItems.length && ScrollTrigger) {
    gsap.fromTo(
      contactItems,
      { y: 24, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.contact-list',
          start: 'top 80%'
        }
      }
    );
  }

  animateOnScroll('.js-cta', { y: 40, opacity: 0 });

  var footerItems = document.querySelectorAll('.js-footer-item');
  if (footerItems.length && ScrollTrigger) {
    gsap.fromTo(
      footerItems,
      { y: 28, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        stagger: 0.12,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.site-footer',
          start: 'top 85%'
        }
      }
    );
  }

  runPreloader();
})();
