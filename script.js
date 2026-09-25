/* =====================================================================
   Portfolio — behaviour & rendering
   Content lives in content.js; you normally don't need to edit this file.
   ===================================================================== */
(function () {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");

  let S = typeof SITE !== "undefined" ? SITE : {};
  let PROJ = typeof PROJECTS !== "undefined" ? PROJECTS : [];

  // Live preview from editor.html: use the unsaved content it stored locally.
  const PREVIEW = /[?&]preview\b/.test(location.search);
  if (PREVIEW) {
    root.classList.add("is-preview");
    try {
      const d = JSON.parse(localStorage.getItem("portfolio-preview") || "null");
      if (d && d.site) { S = d.site; PROJ = d.projects || []; }
    } catch (e) { /* ignore */ }
  }

  const BASE = document.body.dataset.root || ""; // "../" on pages inside /projects
  const PAGE = document.body.dataset.page || "home";
  const HOME = BASE ? BASE + "index.html" + (PREVIEW ? "?preview=1" : "") : "";
  const DRAFT = S.draft !== false;
  const EFFECTS = S.effects !== false;

  if (DRAFT) {
    root.classList.add("is-draft");
    const bar = document.querySelector("[data-draft-bar]");
    if (bar) bar.hidden = false;
  }

  // Accent color from content.js (theme.accent), e.g. "#c9a071"
  (function applyTheme() {
    const hex = S.theme && S.theme.accent;
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return;
    const n = parseInt(m[1], 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const light = rgb.map((c) => Math.round(c + (255 - c) * 0.35));
    root.style.setProperty("--accent", `rgb(${rgb.join(",")})`);
    root.style.setProperty("--accent-2", `rgb(${light.join(",")})`);
    root.style.setProperty("--accent-rgb", rgb.join(", "));
  })();

  /* ---------------- helpers ---------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const esc = (v) =>
    String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  /* Escape text and wrap any [PLACEHOLDER] segment so it is highlighted in draft mode. */
  const t = (v) => esc(v).replace(/\[[^\]]*\]/g, (m) => `<span class="ph">${m}</span>`);
  const hasPh = (v) => !v || /\[[^\]]*\]/.test(v) || /YOUR_/.test(v);
  const plain = (v) => String(v || "").replace(/[[\]]/g, "");
  const list = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
  const pad = (n) => String(n).padStart(2, "0");
  const src = (p) => (/^(https?:)?\/\//.test(p) ? p : BASE + p);
  const projectUrl = (p) => `${BASE ? "" : "projects/"}project.html?id=${encodeURIComponent(p.id)}${PREVIEW ? "&preview=1" : ""}`;
  const NO_IMG = "assets/images/placeholders/model-3d.svg";
  const cover = (p) => p.image || NO_IMG;
  const at = (hash) => (HOME ? HOME + hash : hash);

  const ICONS = {
    email: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    whatsapp:
      '<path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.4z"/><path d="M9.2 8.6c.2 3.2 2.9 5.9 6.2 6.2l1.1-1.6-2.1-1.1-.9.8a4.6 4.6 0 0 1-2.3-2.3l.8-.9-1.1-2.1z"/>',
    telegram: '<path d="M21.5 2.5L10.8 13.2"/><path d="M21.5 2.5l-6.8 19-3.9-8.3-8.3-3.9z"/>',
    linkedin:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10.5v6M8 7.5v.01M12 16.5v-6M12 13.3c0-1.6 1-2.8 2.4-2.8 1.4 0 2.1 1 2.1 2.6v3.4"/>',
    x: '<path d="M4 4h4.6L20 20h-4.6z"/><path d="M19.6 4l-6.4 7.2M10.8 12.8L4.4 20"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><path d="M17 7v.01"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    download: '<path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16"/>',
  };
  const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  let toastTimer;
  function toast(msg) {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-shown"), 4200);
  }

  /* ---------------- contact data ---------------- */
  function contacts() {
    const c = S.contact || {};
    const out = [];
    const isUrl = (v) => /^https?:\/\/\S+\.\S+/.test(v || "") && !hasPh(v);
    const short = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

    // Email
    {
      const v = (c.email || "").trim();
      const ok = /^[^\s@[\]]+@[^\s@[\]]+\.[^\s@[\]]+$/.test(v);
      out.push({ key: "email", label: "Email", icon: "email", raw: v, ok, value: ok ? v : v || "[ADD EMAIL]",
        href: ok ? `mailto:${v}` : "", action: "Send an email", external: false });
    }
    // WhatsApp
    {
      const v = (c.whatsapp || "").trim();
      let href = "", value = v, ok = false;
      if (isUrl(v)) { ok = true; href = v; value = "WhatsApp"; }
      else if (!hasPh(v)) {
        const digits = v.replace(/\D/g, "");
        if (digits.length >= 7) { ok = true; href = `https://wa.me/${digits}`; value = `+${digits}`; }
      }
      out.push({ key: "whatsapp", label: "WhatsApp", icon: "whatsapp", raw: v, ok, value: ok ? value : v || "[ADD WHATSAPP NUMBER]",
        href, action: "Message Me on WhatsApp", external: true });
    }
    // Telegram
    {
      const v = (c.telegram || "").trim();
      let href = "", value = v, ok = false;
      if (isUrl(v)) { ok = true; href = v; value = "@" + short(v).split("/").pop(); }
      else if (!hasPh(v)) {
        const user = v.replace(/^@/, "");
        if (/^[A-Za-z0-9_]{4,}$/.test(user)) { ok = true; href = `https://t.me/${user}`; value = "@" + user; }
      }
      out.push({ key: "telegram", label: "Telegram", icon: "telegram", raw: v, ok, value: ok ? value : v || "[ADD TELEGRAM USERNAME]",
        href, action: "Message on Telegram", external: true });
    }
    // LinkedIn & X
    [["linkedin", "LinkedIn", "Connect on LinkedIn", "[ADD LINKEDIN URL]"], ["x", "X", "Follow on X", "[ADD X URL]"], ["instagram", "Instagram", "View on Instagram", ""]].forEach(([k, label, action, fallback]) => {
      if (k === "instagram" && !c.instagram) return; // optional
      const v = (c[k] || "").trim();
      const ok = isUrl(v);
      out.push({ key: k, label, icon: k, raw: v, ok, value: ok ? short(v) : v || fallback, href: ok ? v : "", action, external: true });
    });

    return DRAFT ? out : out.filter((i) => i.ok);
  }

  /* ---------------- simple bindings ---------------- */
  function bindText() {
    const map = {
      name: S.name,
      title: S.title,
      statement: S.statement,
      location: S.location,
      availability: S.availability,
      heroCaption: S.heroImage && S.heroImage.caption,
      tagline: S.tagline || null,
      contactLead: S.contactLead || null,
    };
    $$("[data-bind]").forEach((el) => {
      const v = map[el.dataset.bind];
      if (v != null) el.innerHTML = t(v);
    });

    // Cover image (hero background). Falls back to the placeholder drawing in the HTML.
    const hero = $("[data-hero-img]");
    if (hero) {
      const hasCover = S.heroImage && S.heroImage.src;
      hero.src = src(hasCover ? S.heroImage.src : "assets/images/placeholders/elevation.svg");
      hero.alt = hasCover ? S.heroImage.alt || "" : "";
    }
    if (hero && S.heroImage && S.heroImage.position) {
      const pos = { left: "left center", right: "right center", center: "center", top: "center top", bottom: "center bottom" };
      hero.style.objectPosition = pos[S.heroImage.position] || S.heroImage.position;
    }
    const cap = $("[data-hero-caption]");
    if (cap) {
      const c = S.heroImage && S.heroImage.caption;
      cap.hidden = !c || (!DRAFT && hasPh(c));
    }

    // Logo (content.js → logo). Replaces the square mark in the header.
    if (S.logo) {
      $$("[data-brand-mark]").forEach((m) => {
        const img = document.createElement("img");
        img.className = "brand-logo";
        img.src = src(S.logo);
        img.alt = S.logoShowName === false ? plain(S.name) || "Logo" : "";
        img.addEventListener("error", () => img.replaceWith(m)); // keep the mark if the file is missing
        m.replaceWith(img);
      });
      if (S.logoShowName === false) $$(".brand-text").forEach((t) => t.classList.add("sr-only"));
      const fav = document.querySelector('link[rel="icon"]');
      if (fav && /\.(svg|png|ico)$/i.test(S.logo)) { fav.href = src(S.logo); fav.type = /\.svg$/i.test(S.logo) ? "image/svg+xml" : ""; }
    }

    if (PAGE === "home" && S.name && !hasPh(S.name)) {
      document.title = `${S.name} — ${plain(S.title)}`;
    }
  }

  /* ---------------- home sections ---------------- */
  function renderAbout(el) {
    const a = S.about || {};
    el.innerHTML = `
      <div class="about-text reveal">
        ${a.lead ? `<p class="about-lead">${t(a.lead)}</p>` : ""}
        ${list(a.paragraphs).map((p) => `<p>${t(p)}</p>`).join("")}
      </div>
      <dl class="facts reveal">
        ${list(a.facts).map((f) => `<div><dt>${esc(f.label)}</dt><dd>${t(f.value)}</dd></div>`).join("")}
      </dl>
      ${list(S.stats).length ? `<dl class="stats reveal">${list(S.stats).map((s) => `<div><dt>${t(s.label)}</dt><dd>${t(s.value)}</dd></div>`).join("")}</dl>` : ""}`;
  }

  function renderProcess(el) {
    const steps = list(S.process);
    if (!steps.length) { const sec = el.closest("section"); if (sec) sec.hidden = true; return; }
    el.innerHTML = steps.map((s, i) => `
      <li class="step reveal" style="transition-delay:${i * 70}ms">
        <span class="step-num">${pad(i + 1)}</span>
        <h3>${t(s.title)}</h3>
        <p>${t(s.text)}</p>
      </li>`).join("");
  }

  function draftNote(el, text) {
    if (DRAFT) el.insertAdjacentHTML("beforebegin", `<p class="draft-note">${esc(text)}</p>`);
  }

  function renderServices(el) {
    el.innerHTML = list(S.services)
      .map(
        (s, i) => `
      <article class="service reveal" style="transition-delay:${i * 60}ms">
        <p class="service-code">${esc(s.code || "S-" + pad(i + 1))}</p>
        <h3>${t(s.title)}</h3>
        ${s.summary ? `<p>${t(s.summary)}</p>` : ""}
        <ul class="tick-list">${list(s.items).map((x) => `<li>${t(x)}</li>`).join("")}</ul>
      </article>`
      )
      .join("");
  }

  function renderSkills(el) {
    const notes = {};
    list(S.toolNotes).forEach((n) => { if (n && n.tool && n.note) notes[n.tool] = n.note; });
    el.innerHTML = list(S.skills)
      .map((g) => {
        const withNotes = list(g.items).some((x) => notes[x]);
        return `
      <div class="skill-group reveal${withNotes ? " skill-group-wide" : ""}">
        <h3>${esc(g.group)}</h3>
        ${withNotes
          ? `<ul class="tools">${list(g.items).map((x) => `<li><strong>${t(x)}</strong>${notes[x] ? `<span>${t(notes[x])}</span>` : ""}</li>`).join("")}</ul>`
          : `<ul class="chips">${list(g.items).map((x) => `<li>${t(x)}</li>`).join("")}</ul>`}
      </div>`;
      })
      .join("");
  }

  function renderProjects(el, filtersEl) {
    if (!PROJ.length) {
      el.innerHTML = `<p class="empty-state">Projects coming soon.</p>`;
      return;
    }
    el.innerHTML = PROJ.map(
      (p, i) => `
      <article class="project-card reveal" data-category="${esc(p.category)}">
        <div class="project-media">
          <img src="${esc(src(p.thumb || cover(p)))}" alt="${esc(p.imageAlt || plain(p.title) || "Project image")}" width="1600" height="1000" loading="lazy" decoding="async">
        </div>
        <div class="project-body">
          <p class="project-kicker"><span class="num">Project ${pad(i + 1)}</span><span>${t(p.category)}</span>${p.buildingType ? `<span>${t(p.buildingType)}</span>` : ""}</p>
          <h3><a href="${projectUrl(p)}">${t(p.title)}</a></h3>
          ${p.summary ? `<p class="project-summary">${t(p.summary)}</p>` : ""}
          <dl class="spec">
            ${p.role ? `<div><dt>Role</dt><dd>${t(p.role)}</dd></div>` : ""}
            ${list(p.software).length ? `<div><dt>Software</dt><dd>${list(p.software).map(t).join(", ")}</dd></div>` : ""}
            ${p.scope ? `<div><dt>Scope</dt><dd>${t(p.scope)}</dd></div>` : ""}
          </dl>
          <span class="project-link" aria-hidden="true">View Project <span>→</span></span>
        </div>
      </article>`
    ).join("");

    // Filters — only from real (non-placeholder) categories, and only if there are 2+.
    const cats = [...new Set(PROJ.map((p) => p.category).filter((c) => c && !hasPh(c)))];
    if (!filtersEl || cats.length < 2) return;
    filtersEl.innerHTML = ["All", ...cats]
      .map((c, i) => `<button type="button" class="filter-btn" data-filter="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`)
      .join("");
    filtersEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      const f = btn.dataset.filter;
      $$(".filter-btn", filtersEl).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      $$(".project-card", el).forEach((card) => {
        card.hidden = !(f === "All" || card.dataset.category === f);
        if (!card.hidden) card.classList.add("is-visible");
      });
    });
  }

  function renderResume(el) {
    const r = S.resume || {};
    const groups = list(S.skills);
    const sw = groups.find((g) => /software/i.test(g.group));
    const tech = groups.find((g) => /technical|bim/i.test(g.group));

    const aside = (title, items) =>
      list(items).length
        ? `<div class="reveal"><h3 class="block-title">${esc(title)}</h3><ul class="aside-list">${list(items)
            .map((i) => `<li><strong>${t(i.title)}</strong>${i.detail ? `<span>${t(i.detail)}</span>` : ""}</li>`)
            .join("")}</ul></div>`
        : "";
    const chips = (title, g) =>
      g && list(g.items).length
        ? `<div class="reveal"><h3 class="block-title">${esc(title)}</h3><ul class="chips aside-chips">${list(g.items)
            .map((x) => `<li>${t(x)}</li>`)
            .join("")}</ul></div>`
        : "";

    el.innerHTML = `
      <div>
        ${r.summary ? `<p class="resume-summary reveal">${t(r.summary)}</p>` : ""}
        <h3 class="block-title reveal">Work Experience</h3>
        <ol class="timeline">
          ${list(r.experience)
            .map(
              (x) => `
            <li class="timeline-item reveal">
              <p class="timeline-dates">${t(x.dates)}</p>
              <div>
                <h4>${t(x.position)}</h4>
                <p class="timeline-company">${t(x.company)}${x.location ? `<span class="sep">/</span>${t(x.location)}` : ""}</p>
                ${list(x.responsibilities).length ? `<p class="timeline-sub">Responsibilities</p><ul class="dash-list">${list(x.responsibilities).map((i) => `<li>${t(i)}</li>`).join("")}</ul>` : ""}
                ${list(x.highlights).length ? `<p class="timeline-sub">Key projects &amp; achievements</p><ul class="dash-list">${list(x.highlights).map((i) => `<li>${t(i)}</li>`).join("")}</ul>` : ""}
              </div>
            </li>`
            )
            .join("")}
        </ol>
      </div>
      <aside class="resume-aside" aria-label="Qualifications">
        <div class="resume-download reveal">
          <p>${S.personName && !hasPh(S.personName) ? `Full resume of ${esc(S.personName)} (PDF).` : "Full resume (PDF)."}</p>
          <a class="btn btn-primary" href="${esc(src(S.resumePdf || "assets/resume.pdf"))}" download data-resume-link>${icon("download")} Download Resume PDF</a>
        </div>
        ${chips("Software", sw)}
        ${chips("Technical Skills", tech)}
        ${aside("Education", r.education)}
        ${aside("Certifications", r.certifications)}
        ${aside("Languages", r.languages)}
        ${aside("Training", r.training)}
      </aside>`;
  }

  function renderContact(listEl, ctaEl) {
    const items = contacts();
    if (listEl) {
      listEl.innerHTML = items
        .map((c) => {
          const inner = `
            <span class="contact-icon">${icon(c.icon)}</span>
            <span class="contact-meta"><span class="contact-label">${esc(c.label)}</span><span class="contact-value">${t(c.value)}</span></span>
            <span class="contact-go">${c.ok ? icon("arrowRight") : "Not set"}</span>`;
          return c.ok
            ? `<li class="contact-item"><a class="contact-link" href="${esc(c.href)}"${c.external ? ' target="_blank" rel="noopener noreferrer"' : ""} aria-label="${esc(c.action)}: ${esc(c.value)}">${inner}</a></li>`
            : `<li class="contact-item is-unset"><div class="contact-link">${inner}</div></li>`;
        })
        .join("");
    }
    if (ctaEl) {
      const get = (k) => items.find((i) => i.key === k && i.ok);
      const email = get("email");
      const wa = get("whatsapp");
      const li = get("linkedin");
      let html = "";
      if (email) {
        const subject = encodeURIComponent("Project inquiry");
        html += `<a class="btn btn-light" href="mailto:${esc(email.raw)}?subject=${subject}">Discuss a Project</a>`;
      } else if (DRAFT) {
        html += `<span class="btn btn-light" aria-disabled="true" title="Add your email in content.js">Discuss a Project</span>`;
      }
      if (wa) html += `<a class="btn btn-outline-light" href="${esc(wa.href)}" target="_blank" rel="noopener noreferrer">${icon("whatsapp")} Message Me on WhatsApp</a>`;
      else if (li) html += `<a class="btn btn-outline-light" href="${esc(li.href)}" target="_blank" rel="noopener noreferrer">${icon("linkedin")} Connect on LinkedIn</a>`;
      ctaEl.innerHTML = html;
    }
  }

  function renderFooter(el) {
    const items = contacts();
    el.innerHTML = `
      <div class="container">
        <div class="footer-top">
          <div>
            ${S.logo ? `<img class="brand-logo footer-logo" src="${esc(src(S.logo))}" alt="">` : ""}
            <p class="footer-name">${t(S.name)}</p>
            <p class="footer-title">${t(S.title)}</p>
          </div>
          <ul class="footer-social" aria-label="Contact links">
            ${items
              .map((c) =>
                c.ok
                  ? `<li><a href="${esc(c.href)}"${c.external ? ' target="_blank" rel="noopener noreferrer"' : ""} aria-label="${esc(c.label)}">${icon(c.icon)}</a></li>`
                  : `<li><span title="${esc(c.label)} not set" aria-hidden="true">${icon(c.icon)}</span></li>`
              )
              .join("")}
          </ul>
        </div>
        <div class="footer-bottom">
          <p>Copyright © ${new Date().getFullYear()} ${t(S.name)}. All rights reserved.</p>
          <a href="${HOME ? HOME + "#home" : "#home"}">Back to top ↑</a>
        </div>
      </div>`;
  }

  /* ---------------- project detail page ---------------- */
  function renderProjectPage(el) {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const idx = id ? PROJ.findIndex((p) => p.id === id) : 0;
    const p = PROJ[idx];

    if (!p) {
      el.innerHTML = `
        <div class="container not-found">
          <p class="pd-kicker">Project not found</p>
          <h1>This project isn't available.</h1>
          <p>It may have been moved or renamed.</p>
          <a class="btn btn-primary" href="${at("#portfolio")}">Back to Portfolio</a>
        </div>`;
      document.title = "Project not found";
      return;
    }

    document.title = `${plain(p.title)} — ${plain(S.name)}`;
    const md = document.querySelector('meta[name="description"]');
    if (md && p.summary && !hasPh(p.summary)) md.setAttribute("content", p.summary);

    const gallery = list(p.gallery).filter((g) => g && g.src);
    const heroSrc = cover(p);
    const heroItem = { src: heroSrc, alt: p.imageAlt || plain(p.title), caption: p.title };
    let items = gallery.slice();
    let heroIndex = items.findIndex((g) => g.src === heroSrc);
    if (heroIndex < 0) { items = [heroItem, ...items]; heroIndex = 0; }

    const prev = PROJ[idx - 1];
    const next = PROJ[idx + 1];
    const info = [
      ["Project Type", p.category],
      ["Building Type", p.buildingType],
      ["Location", p.location],
      ["Year", p.year],
      ["Role", p.role],
      ["Software", list(p.software).join(", ")],
      ["Scope", p.scope],
    ].filter(([, v]) => v);

    el.innerHTML = `
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><a href="${at("#home")}">Home</a></li>
            <li><a href="${at("#portfolio")}">Portfolio</a></li>
            <li aria-current="page">${t(p.title)}</li>
          </ol>
        </nav>
        <header class="pd-head">
          <div>
            <p class="pd-kicker">Project ${pad(idx + 1)} · ${t(p.category)}</p>
            <h1>${t(p.title)}</h1>
          </div>
          ${p.summary ? `<p class="pd-summary">${t(p.summary)}</p>` : ""}
        </header>
        ${heroSrc ? `<button type="button" class="pd-hero" data-lb="${heroIndex}" aria-label="Open image viewer: ${esc(heroItem.alt)}">
          <img src="${esc(src(heroSrc))}" alt="${esc(heroItem.alt)}" width="1600" height="1000" fetchpriority="high" decoding="async">
        </button>` : ""}

        <div class="pd-body">
          <dl class="pd-info" aria-label="Project information">
            ${info.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${t(v)}</dd></div>`).join("")}
          </dl>
          <div class="pd-content">
            ${list(p.description).length ? `<section aria-labelledby="pd-overview"><h2 id="pd-overview">Project Overview</h2>${list(p.description).map((d) => `<p>${t(d)}</p>`).join("")}</section>` : ""}
            <section class="pd-lists" aria-label="Responsibilities and deliverables">
              ${list(p.responsibilities).length ? `<div><h2>Responsibilities</h2><ul class="dash-list">${list(p.responsibilities).map((x) => `<li>${t(x)}</li>`).join("")}</ul></div>` : ""}
              ${list(p.deliverables).length ? `<div><h2>${list(p.responsibilities).length ? "Deliverables" : "Scope & deliverables"}</h2><ul class="dash-list">${list(p.deliverables).map((x) => `<li>${t(x)}</li>`).join("")}</ul></div>` : ""}
              ${list(p.tags).length ? `<div><h2>Tags</h2><ul class="chips">${list(p.tags).map((x) => `<li>${t(x)}</li>`).join("")}</ul></div>` : ""}
            </section>
          </div>
        </div>

        ${gallery.length ? `
        <section class="gallery-section" aria-labelledby="pd-gallery">
          <h2 class="block-title" id="pd-gallery">Project Gallery · ${gallery.length} image${gallery.length > 1 ? "s" : ""}</h2>
          <div class="gallery">
            ${gallery
              .map((g, gi) => {
                const i = items.indexOf(g);
                const shown = gi === 0 ? g.src : g.thumb || g.src;
                return `<figure class="gallery-item reveal">
                  <button type="button" class="gallery-btn" data-lb="${i}" aria-label="Open image viewer: ${esc(g.alt || g.caption || "")}">
                    <img src="${esc(src(shown))}" alt="${esc(g.alt || "")}" width="1600" height="1000" loading="lazy" decoding="async">
                  </button>
                  ${g.caption ? `<figcaption>${t(g.caption)}</figcaption>` : ""}
                </figure>`;
              })
              .join("")}
          </div>
        </section>` : ""}

        <nav class="pd-nav" aria-label="More projects">
          ${prev ? `<a href="${projectUrl(prev)}"><small>← Previous project</small><strong>${t(prev.title)}</strong></a>` : `<a href="${at("#portfolio")}"><small>← Back to</small><strong>All projects</strong></a>`}
          ${next ? `<a href="${projectUrl(next)}"><small>Next project →</small><strong>${t(next.title)}</strong></a>` : `<a href="${at("#portfolio")}"><small>Back to →</small><strong>All projects</strong></a>`}
        </nav>
      </div>
      <section class="pd-cta" aria-labelledby="pd-cta-title">
        <div class="container">
          <h2 id="pd-cta-title">Have a similar project?</h2>
          <div class="hero-actions">
            <a class="btn btn-primary" href="${at("#contact")}">Discuss a Project</a>
            <a class="btn btn-secondary" href="${at("#resume")}">View Resume</a>
          </div>
        </div>
      </section>`;

    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lb]");
      if (b) Lightbox.open(items, Number(b.dataset.lb), b);
    });
  }

  /* ---------------- lightbox ---------------- */
  const Lightbox = (() => {
    const box = $("[data-lightbox]");
    if (!box) return { open() {} };
    box.innerHTML = `
      <div class="lb-bar">
        <span class="lb-count" aria-live="polite"></span>
        <button type="button" class="lb-btn lb-close" aria-label="Close image viewer">${icon("close")}</button>
      </div>
      <div class="lb-stage">
        <button type="button" class="lb-btn lb-prev" aria-label="Previous image">${icon("arrowLeft")}</button>
        <img alt="">
        <button type="button" class="lb-btn lb-next" aria-label="Next image">${icon("arrowRight")}</button>
      </div>
      <p class="lb-caption"></p>`;
    const img = $("img", box), cap = $(".lb-caption", box), count = $(".lb-count", box);
    const prevB = $(".lb-prev", box), nextB = $(".lb-next", box), closeB = $(".lb-close", box);
    let items = [], i = 0, trigger = null;

    function show() {
      const it = items[i];
      img.src = src(it.src);
      img.alt = it.alt || "";
      cap.innerHTML = it.caption ? t(it.caption) : "";
      count.textContent = `${pad(i + 1)} / ${pad(items.length)}`;
      const multi = items.length > 1;
      prevB.hidden = nextB.hidden = !multi;
    }
    function open(list_, index, from) {
      if (!list_.length) return;
      items = list_; i = index || 0; trigger = from || null;
      show();
      box.hidden = false;
      document.body.style.overflow = "hidden";
      closeB.focus();
    }
    function close() {
      box.hidden = true;
      document.body.style.overflow = "";
      img.removeAttribute("src");
      if (trigger) trigger.focus();
    }
    const go = (d) => { i = (i + d + items.length) % items.length; show(); };

    prevB.addEventListener("click", () => go(-1));
    nextB.addEventListener("click", () => go(1));
    closeB.addEventListener("click", close);
    box.addEventListener("click", (e) => { if (e.target === box || e.target.classList.contains("lb-stage")) close(); });
    document.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft" && items.length > 1) go(-1);
      else if (e.key === "ArrowRight" && items.length > 1) go(1);
      else if (e.key === "Tab") {
        const f = $$("button:not([hidden])", box);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // basic swipe
    let x0 = null;
    box.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (x0 == null || items.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      x0 = null;
    });
    return { open };
  })();

  /* ---------------- resume link ---------------- */
  function setupResume() {
    const links = $$("[data-resume-link]");
    if (!links.length) return;
    const url = src(S.resumePdf || "assets/resume.pdf");
    links.forEach((a) => (a.href = url));

    const markMissing = () =>
      links.forEach((a) => {
        a.removeAttribute("download");
        a.setAttribute("href", at("#contact"));
        a.addEventListener("click", () =>
          toast(DRAFT ? "Draft: add your resume at assets/resume.pdf." : "The resume PDF is being updated — please get in touch for a copy.")
        );
      });

    if (!/^https?:/.test(location.protocol)) return; // can't check when opened as a local file
    fetch(url, { method: "HEAD", cache: "no-store" })
      .then((r) => { if (!r.ok) markMissing(); })
      .catch(markMissing);
  }

  /* ---------------- navigation ---------------- */
  function setupNav() {
    const header = $("[data-header]");
    const toggle = $("[data-nav-toggle]");
    const nav = $("[data-nav]");

    const setOpen = (open) => {
      if (!toggle || !nav) return;
      toggle.setAttribute("aria-expanded", String(open));
      $(".sr-only", toggle).textContent = open ? "Close menu" : "Open menu";
      nav.classList.toggle("is-open", open);
    };
    if (toggle) toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    if (nav) nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle && toggle.getAttribute("aria-expanded") === "true") { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (header && !header.contains(e.target)) setOpen(false);
    });
    window.addEventListener("resize", () => { if (window.innerWidth > 960) setOpen(false); });

    const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Highlight the nav link of the section in view (home page only).
    if (PAGE !== "home" || !("IntersectionObserver" in window) || !nav) return;
    const links = $$('a[href^="#"]', nav);
    const byId = Object.fromEntries(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => { a.classList.remove("is-active"); a.removeAttribute("aria-current"); });
          const a = byId[en.target.id];
          if (a) { a.classList.add("is-active"); a.setAttribute("aria-current", "true"); }
        }),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    $$("main section[id]").forEach((s) => io.observe(s));
  }

  /* ---------------- reveal on scroll ---------------- */
  function setupReveal() {
    const els = $$(".reveal");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || S.effects === false || PREVIEW || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
        }),
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((e) => io.observe(e));
  }

  /* ---------------- ticker (service keywords band under the hero) ---------------- */
  function renderTicker(el) {
    const words = list(S.services)
      .map((s) => s.title)
      .filter((w) => w && !hasPh(w));
    const uniq = [...new Set(words)];
    if (!uniq.length) { el.remove(); return; }
    const group = (hidden) =>
      `<div class="ticker-group"${hidden ? ' aria-hidden="true"' : ""}>${uniq.map((w) => `<span class="ticker-item">${esc(w)}</span>`).join("")}</div>`;
    el.innerHTML = `<div class="ticker-track">${group(false)}${STILL ? "" : group(true)}</div>`;
  }

  /* ---------------- effects ---------------- */
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const STILL = REDUCED || !EFFECTS; // no motion effects
  if (!EFFECTS) root.classList.add("no-effects");

  function setupEffects() {
    // Intro animation for the hero
    const loaded = () => document.body.classList.add("is-loaded");
    requestAnimationFrame(() => requestAnimationFrame(loaded));
    setTimeout(loaded, 400); // fallback: rAF is paused in background tabs
    if (STILL) return;

    // Scroll progress bar + hero parallax (one rAF-throttled scroll handler)
    const bar = $("[data-progress]");
    const frame = $("[data-hero-cover]");
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
      if (frame && scrollY < innerHeight * 1.2) frame.style.transform = `translate3d(0, ${scrollY * 0.25}px, 0)`;
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    if (!FINE) return;

    // Pointer-following glow on cards
    $$(".service, .project-card, .skill-group, .resume-download").forEach((c) => c.classList.add("spot"));
    document.addEventListener("pointermove", (e) => {
      const c = e.target.closest && e.target.closest(".spot");
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", `${e.clientX - r.left}px`);
      c.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });

    // Subtle 3D tilt on project cards
    $$(".project-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", `${(px * 5).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${(-py * 4).toFixed(2)}deg`);
      });
      card.addEventListener("pointerleave", () => {
        card.classList.remove("is-tilting");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });

    // CAD-style crosshair with coordinates — follows the mouse on every page
    document.body.insertAdjacentHTML("beforeend",
      '<div class="crosshair" aria-hidden="true"><span class="crosshair-x"></span><span class="crosshair-y"></span><span class="crosshair-label"></span></div>');
    const ch = $(".crosshair");
    const [cx, cy, lab] = [$(".crosshair-x", ch), $(".crosshair-y", ch), $(".crosshair-label", ch)];
    let px = -1, py = -1, raf = 0;
    const draw = () => {
      raf = 0;
      cx.style.transform = `translateY(${py}px)`;
      cy.style.transform = `translateX(${px}px)`;
      const flipX = px > innerWidth - 170, flipY = py > innerHeight - 40;
      lab.style.transform = `translate(${flipX ? px - 150 : px + 12}px, ${flipY ? py - 34 : py + 12}px)`;
      // coordinates are measured on the whole page, so they keep counting as you scroll
      const X = Math.round(px * 10), Y = Math.round((py + scrollY) * 10);
      lab.textContent = `X ${String(X).padStart(5, "0")}  Y ${String(Y).padStart(5, "0")}`;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(draw); };
    document.addEventListener("pointermove", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      px = e.clientX; py = e.clientY;
      ch.classList.add("is-on");
      queue();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => ch.classList.remove("is-on"));
    window.addEventListener("blur", () => ch.classList.remove("is-on"));
    window.addEventListener("scroll", () => { if (px >= 0) queue(); }, { passive: true });

    // Hero: blueprint-grid spotlight under the mouse
    const hero = $("[data-hero]");
    const bg = hero && $(".hero-bg", hero);
    if (hero && bg) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        bg.style.setProperty("--mx", `${e.clientX - r.left}px`);
        bg.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    }
  }

  /* ---------------- hero name: one line when it fits ---------------- */
  function fitHeroName() {
    const h = $(".hero-name");
    if (!h) return;
    h.classList.remove("is-fit");
    h.style.fontSize = "";
    const avail = h.clientWidth;
    const base = parseFloat(getComputedStyle(h).fontSize);
    h.classList.add("is-fit");
    const natural = h.scrollWidth;
    const size = natural > avail ? (base * avail) / natural * 0.99 : base;
    if (size < 30) { h.classList.remove("is-fit"); return; } // too long for this screen: wrap between words
    h.style.fontSize = size.toFixed(1) + "px";
  }
  function setupFitName() {
    fitHeroName();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeroName);
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fitHeroName, 120); });
  }

  /* ---------------- show / hide sections (content.js → sections) ---------------- */
  function applySections() {
    const vis = S.sections || {};
    Object.keys(vis).forEach((id) => {
      if (vis[id] !== false) return;
      const sec = document.getElementById(id);
      if (sec && PAGE === "home") sec.hidden = true;
      $$(`.site-nav a[href$="#${id}"]`).forEach((a) => { if (a.parentElement) a.parentElement.hidden = true; });
    });
    // renumber the visible section labels 01, 02, 03 ...
    $$("main section:not([hidden]) .section-label > span").forEach((el, i) => (el.textContent = pad(i + 1)));
  }

  /* ---------------- init ---------------- */
  const R = (name) => $(`[data-render="${name}"]`);
  try {
    bindText();
    if (R("ticker")) renderTicker(R("ticker"));
    if (R("about")) renderAbout(R("about"));
    if (R("services")) renderServices(R("services"));
    if (R("skills")) renderSkills(R("skills"));
    if (R("projects")) renderProjects(R("projects"), R("filters"));
    if (R("process")) renderProcess(R("process"));
    if (R("resume")) renderResume(R("resume"));
    if (R("contact") || R("contact-cta")) renderContact(R("contact"), R("contact-cta"));
    if (R("project")) renderProjectPage(R("project"));
    if (R("footer")) renderFooter(R("footer"));
    applySections();
  } catch (err) {
    console.error("Portfolio render error — check content.js for a typo:", err);
  }
  setupResume();
  setupNav();
  setupReveal();
  setupFitName();
  setupEffects();

  // In draft mode, list remaining placeholders in the console as a checklist.
  if (DRAFT) {
    const n = (document.body.innerHTML.match(/class="ph"/g) || []).length;
    console.info(`[portfolio] Draft mode: ${n} placeholder(s) on this page. Edit content.js, then set draft: false.`);
  }
})();
