/* =========================================================================
   Costa Dourada — motor de scroll cinematográfico
   Sem dependências obrigatórias: o site funciona sem GSAP (fallback).
   ========================================================================= */
(function () {
  'use strict';

  var root   = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasG   = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasG) { gsap.registerPlugin(ScrollTrigger); root.classList.add('has-gsap'); }

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ------------------------------------------------------------------
     1. LOADER — espera os vídeos do palco estarem prontos
  ------------------------------------------------------------------ */
  var loader   = document.getElementById('loader');
  var fill     = document.getElementById('loaderFill');
  var pctLabel = document.getElementById('loaderPct');
  var stageVids = Array.prototype.slice.call(document.querySelectorAll('.stage__v'));
  var ready = 0, shown = 0, started = performance.now(), finished = false;

  function bufferedFrac(v) {
    try {
      if (!v.duration || !v.buffered.length) return 0;
      return v.buffered.end(v.buffered.length - 1) / v.duration;
    } catch (e) { return 0; }
  }

  function tickLoader() {
    if (finished) return;
    var buf = 0;
    stageVids.forEach(function (v) { buf = Math.max(buf, bufferedFrac(v)); });
    var target = buf * 70 + (ready / Math.max(stageVids.length, 1)) * 30;
    if (performance.now() - started > 5200) target = 100;
    shown = lerp(shown, target, 0.09);
    fill.style.width = shown.toFixed(1) + '%';
    pctLabel.textContent = Math.round(shown);
    if (shown > 99.2 || target === 100) finish();
    else requestAnimationFrame(tickLoader);
  }

  function finish() {
    if (finished) return;
    finished = true;
    fill.style.width = '100%';
    pctLabel.textContent = '100';
    loader.classList.add('is-done');
    setTimeout(function () { loader.style.display = 'none'; }, 800);
    kickVideos();
    document.body.classList.add('is-ready');
  }

  stageVids.forEach(function (v) {
    var mark = function () {
      if (v.dataset.ready) return;
      v.dataset.ready = '1';
      ready++;
      if (v.id === 'v1') v.play().catch(function () {});
    };
    if (v.readyState >= 3) mark();
    else v.addEventListener('canplaythrough', mark, { once: true });
    v.addEventListener('loadeddata', mark, { once: true });
    v.addEventListener('error', mark, { once: true });
  });
  requestAnimationFrame(tickLoader);

  function kickVideos() {
    var v1 = document.getElementById('v1');
    if (v1 && v1.paused) v1.play().catch(function () {});
  }

  /* ------------------------------------------------------------------
     2. NAV — estado sólido / claro, menu móvel
  ------------------------------------------------------------------ */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  var lightSections = Array.prototype.slice.call(document.querySelectorAll('.showroom'));

  burger.addEventListener('click', function () {
    var open = navLinks.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  function syncNav() {
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('is-solid', y > 30);
    var probe = nav.getBoundingClientRect().bottom - 6;
    var light = false;
    for (var i = 0; i < lightSections.length; i++) {
      var r = lightSections[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { light = true; break; }
    }
    nav.classList.toggle('is-light', light);
  }

  /* ------------------------------------------------------------------
     3. FILM RAIL — os 4 momentos, a assinatura da página
  ------------------------------------------------------------------ */
  var rail = document.getElementById('rail');
  var railItems = Array.prototype.slice.call(document.querySelectorAll('.rail__item'));
  var SCENE_NAMES = { 1: '01 / Exterior', 2: '02 / Saguão', 3: '03 / O mar', 4: '04 / A saída' };

  function setScene(n) {
    railItems.forEach(function (el, i) {
      var idx = i + 1;
      el.classList.toggle('is-live', idx === n);
      el.classList.toggle('is-past', idx < n);
    });
  }

  /* ------------------------------------------------------------------
     4. ATOS — crossfade de vídeo + copy guiados pelo scroll
  ------------------------------------------------------------------ */
  var SCENES = {
    1: { vids: ['v1', 'v2'], hud: ['hudScene', 'hudFill'] },
    2: { vids: ['v3', 'v4'], hud: ['hudScene2', 'hudFill2'] }
  };
  var playing = {};

  function renderAct(section, p) {
    var act = section.dataset.act;
    var conf = SCENES[act];
    var a = document.getElementById(conf.vids[0]);
    var b = document.getElementById(conf.vids[1]);
    if (!a || !b) return;

    var mix = smooth(0.42, 0.58, p);

    /* opacidade */
    a.style.opacity = (1 - mix).toFixed(4);
    b.style.opacity = mix.toFixed(4);

    /* escala — empurrão lento de câmera, sem salto na troca */
    if (!reduce) {
      a.style.transform = 'scale(' + (1.11 - 0.10 * smooth(0, 0.6, p)).toFixed(4) + ')';
      b.style.transform = 'scale(' + (1.13 - 0.11 * smooth(0.38, 1, p)).toFixed(4) + ')';
    }

    /* copy: pequena pausa para o texto não colidir */
    var beats = section.querySelectorAll('.beat');
    if (beats[0]) beats[0].classList.toggle('is-live', p < 0.47);
    if (beats[1]) beats[1].classList.toggle('is-live', p >= 0.53);

    /* HUD */
    var sceneNo = (act === '1' ? 1 : 3) + (p >= 0.5 ? 1 : 0);
    var lbl = document.getElementById(conf.hud[0]);
    var bar = document.getElementById(conf.hud[1]);
    if (lbl) lbl.textContent = SCENE_NAMES[sceneNo];
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';

    /* rail */
    if (rail.classList.contains('is-on')) setScene(sceneNo);

    /* taxa de reprodução ligada à velocidade do scroll */
    var vel = section.__vel || 0;
    var rate = clamp(1 + vel / 5200, 0.45, 1.8);
    var active = mix < 0.5 ? a : b;
    [a, b].forEach(function (v) {
      if (v === active) { v.__rate = rate; }
      else { v.__rate = 1; }
    });
  }

  function setupActs() {
    var acts = Array.prototype.slice.call(document.querySelectorAll('.act'));

    if (!hasG) {
      /* fallback: sem GSAP, calculamos o progresso manualmente */
      var onScroll = function () {
        acts.forEach(function (s) {
          var r = s.getBoundingClientRect();
          var total = s.offsetHeight - window.innerHeight;
          var p = clamp(-r.top / (total || 1), 0, 1);
          if (r.top < window.innerHeight && r.bottom > 0) renderAct(s, p);
        });
        syncNav();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();
      acts.forEach(function (s) { renderAct(s, 0); });
      return;
    }

    acts.forEach(function (s) {
      var vids = SCENES[s.dataset.act].vids.map(function (id) { return document.getElementById(id); });

      ScrollTrigger.create({
        trigger: s,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: function (self) {
          s.__vel = self.getVelocity();
          renderAct(s, self.progress);
        },
        onToggle: function (self) {
          rail.classList.toggle('is-on', self.isActive);
          if (self.isActive) {
            vids.forEach(function (v) { if (v.paused) v.play().catch(function () {}); });
          } else {
            vids.forEach(function (v) { v.pause(); });
          }
        },
        onEnter: function () { rail.classList.add('is-on'); },
        onEnterBack: function () { rail.classList.add('is-on'); }
      });

      renderAct(s, 0);
    });
  }

  /* taxa de reprodução: suaviza em direção ao alvo a cada quadro */
  function rateLoop() {
    stageVids.forEach(function (v) {
      if (!v.duration) return;
      var target = v.__rate || 1;
      var cur = v.playbackRate || 1;
      var next = lerp(cur, target, 0.12);
      if (Math.abs(next - cur) > 0.005) {
        try { v.playbackRate = clamp(next, 0.25, 4); } catch (e) {}
      }
    });
    requestAnimationFrame(rateLoop);
  }

  /* ------------------------------------------------------------------
     5. REVELAÇÕES + CONTADORES
  ------------------------------------------------------------------ */
  function setupReveals() {
    if (!hasG || reduce) {
      Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (el) {
        el.style.opacity = 1; el.style.transform = 'none';
      });
      runCounters(true);
      return;
    }

    gsap.utils.toArray('.reveal').forEach(function (el, i) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.95, ease: 'power3.out',
        delay: (i % 3) * 0.07,
        scrollTrigger: { trigger: el, start: 'top 86%', once: true }
      });
    });

    gsap.utils.toArray('.num').forEach(function (el) {
      var done = false;
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: function () { if (!done) { done = true; countUp(el); } }
      });
    });
  }

  function countUp(el) {
    var to = parseFloat(el.dataset.to) || 0;
    var dec = parseInt(el.dataset.dec || '0', 10);
    var suffix = el.dataset.suffix || '';
    var obj = { v: 0 };
    if (hasG) {
      gsap.to(obj, {
        v: to, duration: 1.7, ease: 'power2.out',
        onUpdate: function () {
          el.textContent = obj.v.toFixed(dec).replace('.', ',') + suffix;
        }
      });
    } else {
      el.textContent = to.toFixed(dec).replace('.', ',') + suffix;
    }
  }

  function runCounters() {
    Array.prototype.forEach.call(document.querySelectorAll('.num'), countUp);
  }

  /* ------------------------------------------------------------------
     6. CARDS — pré-visualização do vídeo ao passar o rato
  ------------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll('.card__media video'), function (v) {
    var card = v.closest('.card');
    if (!card) return;
    var on = function () { v.play().catch(function () {}); };
    var off = function () { v.pause(); try { v.currentTime = v.dataset.start || 0; } catch (e) {} };
    card.addEventListener('mouseenter', on);
    card.addEventListener('mouseleave', off);
    card.addEventListener('focusin', on);
    card.addEventListener('focusout', off);
    v.addEventListener('loadedmetadata', function () {
      var m = /#t=([\d.]+)/.exec(v.getAttribute('src') || '');
      if (m) v.dataset.start = m[1];
    });
  });

  /* ------------------------------------------------------------------
     7. FORMULÁRIO
  ------------------------------------------------------------------ */
  var form = document.getElementById('briefing');
  var status = document.getElementById('formStatus');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (input) {
        var bad = !input.value.trim();
        input.parentElement.classList.toggle('is-bad', bad);
        if (bad) ok = false;
      });
      if (!ok) {
        status.style.color = '#E06B5A';
        status.textContent = 'Preencha os campos obrigatórios para continuar.';
        return;
      }
      status.style.color = '';
      status.textContent = 'Briefing registado — em produção este lead cai na CRM e dispara o WhatsApp do corretor.';
      form.reset();
    });
    form.addEventListener('input', function (e) {
      if (e.target.parentElement) e.target.parentElement.classList.remove('is-bad');
    });
  }

  /* ------------------------------------------------------------------
     8. ARRANQUE
  ------------------------------------------------------------------ */
  var y = document.getElementById('ano');
  if (y) y.textContent = new Date().getFullYear();

  syncNav();
  window.addEventListener('scroll', syncNav, { passive: true });
  window.addEventListener('resize', syncNav);

  setupActs();
  setupReveals();
  requestAnimationFrame(rateLoop);

  if (hasG) {
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    window.addEventListener('resize', function () { ScrollTrigger.refresh(); });
  }
})();
