/* =====================================================================
   Portfolio Editor
   Visual editor for content.js. Runs locally in Chrome / Edge and saves
   straight into the portfolio folder using the File System Access API.
   ===================================================================== */
(function () {
  "use strict";

  const PREVIEW_KEY = "portfolio-preview";
  const AUTOSAVE_KEY = "portfolio-editor-autosave";
  const CAN_SAVE = "showDirectoryPicker" in window;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const PH = /\[[^\]]*\]/;
  const plain = (v) => String(v || "").replace(/[[\]]/g, "").trim();
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => c != null && n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  }

  const slug = (s) =>
    String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  let data = null;          // { site, projects }
  let savedJSON = "";       // last saved/loaded snapshot
  let dirHandle = null;     // connected portfolio folder
  let page = "profile";
  let previewPath = "index.html";
  let previewHash = "#home";
  const openItems = new WeakSet(); // repeat items shown expanded

  function normalize(site, projects) {
    const s = clone(site || {});
    s.theme = s.theme || { accent: "#c9a071" };
    if (s.effects === undefined) s.effects = true;
    s.sections = Object.assign({ about: true, services: true, skills: true, portfolio: true, resume: true }, s.sections || {});
    s.heroImage = s.heroImage || { src: "", alt: "", caption: "" };
    s.logo = s.logo || "";
    s.personName = s.personName || "";
    if (s.logoShowName === undefined) s.logoShowName = true;
    s.contact = Object.assign({ email: "", whatsapp: "", telegram: "", linkedin: "", x: "", instagram: "" }, s.contact || {});
    s.stats = s.stats || [];
    s.process = s.process || [];
    s.toolNotes = s.toolNotes || [];
    s.sections = Object.assign({ process: true }, s.sections);
    s.about = Object.assign({ lead: "", paragraphs: [], facts: [] }, s.about || {});
    s.services = s.services || [];
    s.skills = s.skills || [];
    s.resume = Object.assign({ summary: "", experience: [], education: [], certifications: [], languages: [], training: [] }, s.resume || {});
    s.resumePdf = s.resumePdf || "assets/resume.pdf";
    return { site: s, projects: clone(projects || []) };
  }

  /* ------------------------------------------------------------------
     Contact helpers (mirror the rules used by the website)
     ------------------------------------------------------------------ */
  const isUrl = (v) => /^https?:\/\/\S+\.\S+/.test(v || "") && !PH.test(v);
  const CONTACT = {
    email(v) {
      if (!v || PH.test(v)) return { state: "unset" };
      return /^[^\s@[\]]+@[^\s@[\]]+\.[^\s@[\]]+$/.test(v) ? { state: "ok", link: "mailto:" + v } : { state: "bad", msg: "Enter an address like name@example.com" };
    },
    whatsapp(v) {
      if (!v || PH.test(v)) return { state: "unset" };
      if (isUrl(v)) return { state: "ok", link: v };
      const d = v.replace(/\D/g, "");
      return d.length >= 7 ? { state: "ok", link: "https://wa.me/" + d } : { state: "bad", msg: "Enter your full number with country code, e.g. +84 912 345 678" };
    },
    telegram(v) {
      if (!v || PH.test(v)) return { state: "unset" };
      if (isUrl(v)) return { state: "ok", link: v };
      const u = v.replace(/^@/, "");
      return /^[A-Za-z0-9_]{4,}$/.test(u) ? { state: "ok", link: "https://t.me/" + u } : { state: "bad", msg: "Enter your Telegram username, e.g. @yourname" };
    },
    url(v) {
      if (!v || PH.test(v)) return { state: "unset" };
      return isUrl(v) ? { state: "ok", link: v } : { state: "bad", msg: "Paste the full address starting with https://" };
    },
  };

  /* ------------------------------------------------------------------
     Page definitions (what the forms contain)
     ------------------------------------------------------------------ */
  const T = (key, label, o = {}) => ({ type: "text", key, label, ...o });
  const TA = (key, label, o = {}) => ({ type: "textarea", key, label, rows: 3, ...o });
  const L = (key, label, o = {}) => ({ type: "lines", key, label, ...o });

  const projectDir = (ctx) => `assets/images/projects/${slug(ctx.project && ctx.project.id) || "misc"}`;

  const PAGES = [
    {
      id: "profile", label: "Profile", hash: "#home",
      intro: "Your name, title, and the first screen visitors see.",
      obj: (d) => d.site,
      fields: [
        T("name", "Name shown on the site", { hint: "Shown large on the first screen and in the footer (your name or your studio name)." }),
        T("personName", "Your personal name", { hint: "Used in About, the resume box and for Google (author). e.g. Andrey Ruvi (Duong Lam)" }),
        T("title", "Professional title", { hint: "e.g. Revit / BIM Specialist | Architectural Designer" }),
        T("tagline", "Core software line", { hint: "Shown under the first screen, e.g. Revit · Chief Architect · AutoCAD · SketchUp" }),
        TA("statement", "Short statement", { hint: "One or two sentences about what you help clients with." }),
        T("availability", "Availability", { hint: "Shown next to the green dot, e.g. Available for remote & freelance work" }),
        T("location", "Location", { hint: "e.g. Ho Chi Minh City, Vietnam · Working remotely" }),
        { type: "group", key: "_logo", label: "Logo", flat: true, fields: [
          { type: "image", key: "logo", label: "Logo image", dir: () => "assets/images/logos", logo: true,
            hint: "Shown top-left in the header and in the footer. Best: SVG or PNG with a transparent background, light-coloured for the dark site." },
          { type: "checkbox", key: "logoShowName", label: "Show my name next to the logo", hint: "Turn off if your logo already contains your name." },
        ] },
        { type: "group", key: "heroImage", label: "Cover image (background of the first screen)", fields: [
          { type: "image", key: "src", label: "Cover image", dir: () => "assets/images", altKey: "alt",
            hint: "A wide landscape image works best (e.g. a render or Revit view, 2400 px wide). It is darkened automatically so the text stays readable." },
          { type: "select", key: "position", label: "Keep this part of the image visible", options: [["center", "Center"], ["right", "Right side"], ["left", "Left side"], ["top", "Top"], ["bottom", "Bottom"]],
            hint: "On narrow screens the image is cropped — choose which part matters most." },
          T("alt", "Image description", { hint: "Describe the image for Google and screen readers, e.g. Revit model of a 3-storey office building" }),
          T("caption", "Caption", { hint: "Small text under the image, e.g. Project name · Revit model" }),
        ] },
      ],
    },
    {
      id: "contact", label: "Contact", hash: "#contact",
      intro: "How clients reach you. Every valid item becomes a one-click button on the site.",
      obj: (d) => d.site.contact,
      fields: [
        { type: "contact", key: "email", label: "Email", check: CONTACT.email, hint: "name@example.com" },
        { type: "contact", key: "whatsapp", label: "WhatsApp number", check: CONTACT.whatsapp, hint: "With country code, e.g. +84 912 345 678" },
        { type: "contact", key: "telegram", label: "Telegram username", check: CONTACT.telegram, hint: "e.g. @yourname" },
        { type: "contact", key: "linkedin", label: "LinkedIn profile link", check: CONTACT.url, hint: "https://www.linkedin.com/in/your-name/" },
        { type: "contact", key: "x", label: "X (Twitter) profile link", check: CONTACT.url, hint: "https://x.com/yourname" },
        { type: "contact", key: "instagram", label: "Instagram profile link (optional)", check: CONTACT.url, hint: "https://instagram.com/yourname — leave empty to hide" },
        { type: "group", key: "_lead", label: "Contact section text", flat: true, root: true, fields: [
          TA("contactLead", "Invitation text", { rows: 3, hint: "The paragraph under “Let's work together”." }),
        ] },
      ],
    },
    {
      id: "about", label: "About", hash: "#about",
      intro: "A short professional introduction.",
      obj: (d) => d.site.about,
      fields: [
        TA("lead", "Introduction (large text)", { rows: 2 }),
        L("paragraphs", "Paragraphs", { hint: "One paragraph per line. Press Enter to start a new paragraph.", rows: 6 }),
        { type: "repeat", key: "facts", label: "Quick facts", addLabel: "Add fact", title: (f) => plain(f.label) || "New fact",
          create: () => ({ label: "", value: "" }),
          fields: [T("label", "Label", { hint: "e.g. Experience" }), T("value", "Value", { hint: "e.g. 5 years" })] },
        { type: "repeat", key: "stats", root: true, label: "Big numbers (stats row)", addLabel: "Add number", compact: true,
          title: (x) => [plain(x.value), plain(x.label)].filter(Boolean).join(" — ") || "New number",
          create: () => ({ value: "", label: "" }),
          fields: [{ type: "row", fields: [T("value", "Number", { hint: "e.g. 100+" }), T("label", "Label", { hint: "e.g. Drawing sheets produced" })] }] },
      ],
    },
    {
      id: "services", label: "Services", hash: "#services",
      intro: "What you offer. Keep only services you really provide.",
      obj: (d) => d.site,
      fields: [
        { type: "repeat", key: "services", label: "Services", addLabel: "Add service", title: (s) => plain(s.title) || "New service",
          create: (arr) => ({ code: "S-" + String(arr.length + 1).padStart(2, "0"), title: "", summary: "", items: [] }),
          fields: [T("title", "Service name"), TA("summary", "One-sentence description", { rows: 2 }),
            L("items", "What's included", { hint: "One item per line.", rows: 5 }), T("code", "Small code label", { hint: "e.g. S-01 (optional)" })] },
        { type: "repeat", key: "process", label: "How I work (process steps)", addLabel: "Add step", compact: true,
          title: (x, i) => `${String(i + 1).padStart(2, "0")}  ${plain(x.title) || "New step"}`,
          create: () => ({ title: "", text: "" }),
          fields: [T("title", "Step name", { hint: "e.g. Brief and files" }), TA("text", "Description", { rows: 2 })] },
      ],
    },
    {
      id: "skills", label: "Skills", hash: "#skills",
      intro: "Software and skills, in groups. Groups named “Software” and “BIM / Technical” also appear in the Resume.",
      obj: (d) => d.site,
      fields: [
        { type: "repeat", key: "skills", label: "Skill groups", addLabel: "Add group", title: (g) => plain(g.group) || "New group",
          create: () => ({ group: "", items: [] }),
          fields: [T("group", "Group name", { hint: "e.g. Software" }), L("items", "Skills", { hint: "One skill per line.", rows: 6 })] },
        { type: "repeat", key: "toolNotes", label: "Software descriptions (optional)", addLabel: "Add description", compact: true,
          title: (x) => plain(x.tool) || "New description",
          create: () => ({ tool: "", note: "" }),
          fields: [T("tool", "Software name", { hint: "Must match the name in the Software list exactly, e.g. Autodesk Revit" }),
            T("note", "What you use it for", { hint: "e.g. Architectural, structural and MEP modelling, families, sheets and schedules" })] },
      ],
    },
    {
      id: "projects", label: "Projects", hash: "#portfolio",
      intro: "Your portfolio. Open a project to edit it — the preview shows its page. Drag order with the ↑ ↓ buttons.",
      obj: (d) => d,
      fields: [
        { type: "repeat", key: "projects", label: "Projects", addLabel: "Add project", ctxKey: "project", numbered: true,
          title: (p) => plain(p.title) || "Untitled project",
          create: (arr) => {
            let n = arr.length + 1, id;
            do { id = "project-" + String(n++).padStart(2, "0"); } while (arr.some((p) => p.id === id));
            return { id, title: "", category: "", location: "", year: "", role: "", software: ["Revit"], scope: "",
              image: "", imageAlt: "", summary: "", description: [], responsibilities: [], deliverables: [], gallery: [] };
          },
          onOpen: (p) => setPreview("projects/project.html", "", p.id),
          fields: [
            T("title", "Project name"),
            T("category", "Project type", { hint: "e.g. Permit Drawings — also used for the filter buttons" }),
            T("buildingType", "Building type", { hint: "e.g. Residential, Commercial" }),
            { type: "row", fields: [T("location", "Location"), T("year", "Year")] },
            T("role", "Your role", { hint: "e.g. Revit / BIM Modeler" }),
            L("software", "Software used", { hint: "One per line, e.g. Revit", rows: 3 }),
            TA("scope", "Scope of work", { rows: 2, hint: "e.g. Architectural modeling, documentation, drawing production" }),
            { type: "image", key: "image", label: "Cover image", dir: projectDir, altKey: "imageAlt", thumbKey: "thumb" },
            T("imageAlt", "Cover image description", { hint: "e.g. Exterior view of the Revit model" }),
            TA("summary", "Card summary (one sentence)", { rows: 2 }),
            L("description", "Project description", { hint: "One paragraph per line.", rows: 5 }),
            L("responsibilities", "Your responsibilities", { hint: "One per line.", rows: 4 }),
            L("deliverables", "Deliverables / scope items", { hint: "One per line, e.g. Floor plans", rows: 4 }),
            L("tags", "Tags", { hint: "One per line, e.g. New Construction", rows: 3 }),
            { type: "repeat", key: "gallery", label: "Gallery images", addLabel: "Add image", compact: true,
              title: (g, i) => plain(g.caption) || (g.src ? g.src.split("/").pop() : `Image ${i + 1}`),
              create: () => ({ src: "", alt: "", caption: "" }),
              fields: [{ type: "image", key: "src", label: "Image", dir: projectDir, altKey: "alt", thumbKey: "thumb" },
                T("caption", "Caption", { hint: "e.g. Level 1 floor plan" }), T("alt", "Image description")] },
            { type: "text", key: "id", label: "Page address name", advanced: true,
              hint: "Used in the project's web address. Lowercase letters, numbers and dashes only.", sanitize: slug },
          ] },
      ],
    },
    {
      id: "resume", label: "Resume", hash: "#resume",
      intro: "Your experience and qualifications. Upload your resume PDF at the bottom.",
      obj: (d) => d.site.resume,
      fields: [
        TA("summary", "Professional summary", { rows: 4 }),
        { type: "repeat", key: "experience", label: "Work experience (newest first)", addLabel: "Add job",
          title: (x) => [plain(x.position), plain(x.company)].filter(Boolean).join(" — ") || "New position",
          create: () => ({ dates: "", position: "", company: "", location: "", responsibilities: [], highlights: [] }),
          fields: [T("position", "Position"), T("company", "Company"),
            { type: "row", fields: [T("dates", "Dates", { hint: "e.g. 2022 — Present" }), T("location", "Location", { hint: "City or Remote" })] },
            L("responsibilities", "Responsibilities", { hint: "One per line.", rows: 4 }),
            L("highlights", "Key projects & achievements", { hint: "One per line.", rows: 3 })] },
        ...[["education", "Education", "Degree / program", "Institution · Year"],
          ["certifications", "Certifications", "Certification", "Issuer · Year"],
          ["languages", "Languages", "Language", "Level, e.g. Native / Professional"],
          ["training", "Training & courses", "Course", "Provider · Year"]].map(([key, label, a, b]) => ({
          type: "repeat", key, label, addLabel: "Add", compact: true, title: (x) => plain(x.title) || "New entry",
          create: () => ({ title: "", detail: "" }), fields: [T("title", a), T("detail", "Details", { hint: b })] })),
        { type: "resumepdf", label: "Resume PDF" },
      ],
    },
    {
      id: "settings", label: "Settings", hash: "#home",
      intro: "Look & feel, visible sections, and the publishing checklist.",
      obj: (d) => d.site,
      fields: [
        { type: "checklist", label: "Before you publish" },
        { type: "checkbox", key: "draft", label: "Draft mode", hint: "Highlights placeholders and shows “Not set” contacts. Turn OFF before sharing your site." },
        { type: "checkbox", key: "effects", label: "Animations & effects", hint: "Hover effects, intro animation, moving ticker. Turn off for a completely still site." },
        { type: "group", key: "theme", label: "Accent color", fields: [
          { type: "color", key: "accent", label: "Accent color", presets: [
            ["Brass", "#c9a071"], ["Copper", "#d0875a"], ["Blueprint", "#6fa3d8"], ["Sage", "#8fb39a"], ["Stone", "#d9d4c7"], ["Signal", "#e0694a"]] },
        ] },
        { type: "group", key: "sections", label: "Show sections", fields: [
          { type: "checkbox", key: "about", label: "About" },
          { type: "checkbox", key: "services", label: "Services" },
          { type: "checkbox", key: "skills", label: "Skills" },
          { type: "checkbox", key: "portfolio", label: "Portfolio" },
          { type: "checkbox", key: "process", label: "How I work" },
          { type: "checkbox", key: "resume", label: "Resume" },
        ] },
      ],
    },
  ];

  /* ------------------------------------------------------------------
     Field rendering
     ------------------------------------------------------------------ */
  function fieldWrap(def, control, extra) {
    const id = "f" + Math.random().toString(36).slice(2, 9);
    control.id = control.id || id;
    return el("div", { class: "field" + (def.advanced ? " advanced" : "") },
      el("label", { for: control.id, class: "field-label" }, def.label),
      control,
      def.hint ? el("p", { class: "hint" }, def.hint) : null,
      extra || null);
  }

  function markPh(input, value) {
    const has = PH.test(Array.isArray(value) ? value.join("\n") : value || "");
    input.classList.toggle("has-ph", has);
    const box = input.closest(".field");
    if (box) box.classList.toggle("is-ph", has);
  }

  function clearBtn(input, apply) {
    return el("button", { type: "button", class: "clear-ph", title: "Remove the placeholder text",
      onclick: () => { input.value = ""; apply(""); input.focus(); } }, "Clear placeholder");
  }

  function renderField(def, obj, ctx) {
    if (def.root) { obj = data.site; }
    switch (def.type) {
      case "text":
      case "textarea":
      case "contact": {
        const input = def.type === "textarea"
          ? el("textarea", { rows: def.rows || 3 })
          : el("input", { type: "text", autocomplete: "off", spellcheck: def.type === "contact" ? "false" : null });
        input.dataset.key = def.key;
        input.value = obj[def.key] == null ? "" : obj[def.key];
        const status = def.type === "contact" ? el("p", { class: "check" }) : null;
        const apply = (v) => {
          if (def.sanitize) v = def.sanitize(v);
          obj[def.key] = v;
          markPh(input, v);
          if (status) showCheck(status, def.check(v));
          changed(ctx);
        };
        input.addEventListener("input", () => apply(input.value));
        if (def.sanitize) input.addEventListener("blur", () => (input.value = obj[def.key]));
        const wrap = fieldWrap(def, input, el("div", { class: "field-foot" }, status, clearBtn(input, apply)));
        markPh(input, input.value);
        if (status) showCheck(status, def.check(input.value));
        return wrap;
      }
      case "lines": {
        const input = el("textarea", { rows: def.rows || 4 });
        input.value = (obj[def.key] || []).join("\n");
        const apply = (v) => {
          obj[def.key] = v.split("\n").map((s) => s.trim()).filter(Boolean);
          markPh(input, v);
          changed(ctx);
        };
        input.addEventListener("input", () => apply(input.value));
        const wrap = fieldWrap(def, input, el("div", { class: "field-foot" }, clearBtn(input, apply)));
        markPh(input, input.value);
        return wrap;
      }
      case "checkbox": {
        const input = el("input", { type: "checkbox" });
        input.checked = obj[def.key] !== false;
        input.addEventListener("change", () => { obj[def.key] = input.checked; changed(ctx); refreshChecklist(); });
        return el("label", { class: "switch" }, input, el("span", { class: "switch-ui", "aria-hidden": "true" }),
          el("span", { class: "switch-text" }, el("strong", {}, def.label), def.hint ? el("small", {}, def.hint) : null));
      }
      case "color": {
        const val = /^#[0-9a-f]{6}$/i.test(obj[def.key] || "") ? obj[def.key] : "#c9a071";
        const picker = el("input", { type: "color", value: val });
        const hex = el("input", { type: "text", value: val, maxlength: 7, class: "hex", "aria-label": "Hex color code" });
        const set = (v) => {
          if (!/^#[0-9a-f]{6}$/i.test(v)) return;
          obj[def.key] = v.toLowerCase(); picker.value = v; hex.value = v.toLowerCase();
          $$(".swatch", box).forEach((s) => s.setAttribute("aria-pressed", String(s.dataset.v === v.toLowerCase())));
          changed(ctx);
        };
        picker.addEventListener("input", () => set(picker.value));
        hex.addEventListener("input", () => set(hex.value.startsWith("#") ? hex.value : "#" + hex.value));
        const box = el("div", { class: "color-row" }, picker, hex,
          el("div", { class: "swatches" }, (def.presets || []).map(([n, v]) =>
            el("button", { type: "button", class: "swatch", "data-v": v, title: n, "aria-label": n, "aria-pressed": String(v === val),
              style: `--c:${v}`, onclick: () => set(v) }, el("span", {}, n)))));
        return fieldWrap(def, box);
      }
      case "select": {
        const sel = el("select", {}, def.options.map(([v, label]) => el("option", { value: v }, label)));
        sel.value = obj[def.key] || def.options[0][0];
        sel.addEventListener("change", () => { obj[def.key] = sel.value; changed(ctx); });
        return fieldWrap(def, sel);
      }
      case "image": return renderImage(def, obj, ctx);
      case "group": {
        const target = def.flat ? obj : (obj[def.key] = obj[def.key] || {});
        return el("fieldset", { class: "group" }, el("legend", {}, def.label),
          def.fields.map((f) => renderField(f, target, ctx)));
      }
      case "row":
        return el("div", { class: "row" }, def.fields.map((f) => renderField(f, obj, ctx)));
      case "repeat": return renderRepeat(def, obj, ctx);
      case "resumepdf": return renderResumePdf(def);
      case "checklist": return el("div", { class: "checklist", "data-checklist": "" });
      default: return el("p", {}, "Unknown field " + def.type);
    }
  }

  function showCheck(node, r) {
    node.className = "check " + r.state;
    node.textContent =
      r.state === "ok" ? "✓ Button links to: " + r.link :
      r.state === "bad" ? "⚠ " + r.msg :
      "Not set — this contact is hidden on the site when Draft mode is off.";
  }

  /* ---------- repeatable lists ---------- */
  function renderRepeat(def, obj, ctx) {
    obj[def.key] = obj[def.key] || [];
    const arr = obj[def.key];
    const listEl = el("div", { class: "items" });
    const count = el("span", { class: "count" });
    const box = el("section", { class: "repeat" + (def.compact ? " compact" : "") },
      el("div", { class: "repeat-head" }, el("h3", {}, def.label), count), listEl,
      el("button", { type: "button", class: "btn add", onclick: () => {
        const item = def.create(arr);
        arr.push(item);
        openItems.add(item);
        draw();
        changed(ctx, true);
        const last = listEl.lastElementChild;
        if (last) { last.scrollIntoView({ block: "nearest", behavior: "smooth" }); const f = $("input, textarea", last); if (f) f.focus(); }
        if (def.onOpen) def.onOpen(item);
      } }, "+ " + (def.addLabel || "Add")));

    function draw() {
      listEl.innerHTML = "";
      count.textContent = arr.length ? String(arr.length) : "";
      if (!arr.length) listEl.append(el("p", { class: "empty" }, "Nothing here yet."));
      arr.forEach((item, i) => {
        const titleEl = el("span", { class: "item-title" });
        const updTitle = () => {
          titleEl.textContent = (def.numbered ? String(i + 1).padStart(2, "0") + "  " : "") + def.title(item, i);
          const ph = PH.test(JSON.stringify(item));
          details.classList.toggle("is-ph", ph);
        };
        const act = (label, text, fn, disabled) =>
          el("button", { type: "button", class: "mini", title: label, "aria-label": label, disabled,
            onclick: (e) => { e.preventDefault(); e.stopPropagation(); fn(); } }, text);
        const details = el("details", { class: "item", open: openItems.has(item) },
          el("summary", {}, titleEl, el("span", { class: "item-actions" },
            act("Move up", "↑", () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); draw(); changed(ctx, true); }, i === 0),
            act("Move down", "↓", () => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); draw(); changed(ctx, true); }, i === arr.length - 1),
            act("Duplicate", "⧉", () => {
              const copy = clone(item);
              if ("id" in copy) { let n = 2; while (arr.some((p) => p.id === `${item.id}-${n}`)) n++; copy.id = `${item.id}-${n}`; }
              arr.splice(i + 1, 0, copy); openItems.add(copy); draw(); changed(ctx, true);
            }),
            act("Delete", "✕", () => {
              if (!confirm(`Delete “${def.title(item, i)}”? This can't be undone after you save.`)) return;
              arr.splice(i, 1); draw(); changed(ctx, true);
            }))));
        details.addEventListener("toggle", () => {
          if (details.open) { openItems.add(item); if (def.onOpen) def.onOpen(item); } else openItems.delete(item);
        });
        const body = el("div", { class: "item-body" });
        const sub = { ...ctx, onItemChange: () => { updTitle(); if (ctx.onItemChange) ctx.onItemChange(); } };
        if (def.ctxKey) sub[def.ctxKey] = item;
        def.fields.forEach((f) => body.append(renderField(f, item, sub)));
        details.append(body);
        listEl.append(details);
        updTitle();
      });
    }
    draw();
    return box;
  }

  /* ---------- images ---------- */
  function renderImage(def, obj, ctx) {
    const thumb = el("img", { alt: "", class: "thumb" });
    const path = el("input", { type: "text", class: "path", spellcheck: false, placeholder: "No image yet" });
    const setThumb = () => {
      const v = obj[def.key];
      thumb.hidden = !v;
      if (v) thumb.src = v + (v.includes("?") ? "&" : "?") + "t=" + Date.now();
    };
    thumb.addEventListener("error", () => (thumb.hidden = true));
    path.value = obj[def.key] || "";
    path.addEventListener("change", () => { obj[def.key] = path.value.trim(); if (def.thumbKey) delete obj[def.thumbKey]; setThumb(); changed(ctx); });
    const choose = el("button", { type: "button", class: "btn", onclick: async () => {
      if (!(await folderReadyForUpload())) return;
      const file = await pickFile("image/*");
      if (!file) return;
      try {
        busy(true, "Saving image…");
        const { blob, ext, note } = await processImage(file, def.logo ? 512 : 2400);
        const base = slug(file.name.replace(/\.[^.]+$/, "")) || "image";
        const rel = `${def.dir(ctx)}/${base}.${ext}`;
        await writeFile(rel, blob);
        obj[def.key] = rel;
        if (def.thumbKey) delete obj[def.thumbKey];
        path.value = rel;
        if (def.altKey && (!obj[def.altKey] || PH.test(obj[def.altKey]))) {
          obj[def.altKey] = base.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
          const altInput = findSiblingInput(choose, def.altKey);
          if (altInput) { altInput.value = obj[def.altKey]; markPh(altInput, altInput.value); }
        }
        setThumb();
        choose.textContent = "Replace image…";
        changed(ctx, true);
        await save(true); // write content.js too, so the site shows the new image right away
        toast(`Image added ✓  Saved to ${rel}${note ? " · " + note : ""}`);
      } catch (err) {
        console.error(err);
        toast("Couldn't save the image: " + err.message, true);
      } finally { busy(false); }
    } }, obj[def.key] ? "Replace image…" : "Choose image…");
    const remove = el("button", { type: "button", class: "btn ghost", onclick: () => {
      obj[def.key] = ""; if (def.thumbKey) delete obj[def.thumbKey]; path.value = ""; setThumb(); changed(ctx);
    } }, "Remove");
    setThumb();
    const box = el("div", { class: "image-field" }, el("div", { class: "thumb-box" }, thumb),
      el("div", { class: "image-side" }, el("div", { class: "image-btns" }, choose, remove), path,
        el("p", { class: "hint" }, CAN_SAVE ? "Large photos are resized automatically (max 2400 px) for fast loading." :
          "To add images, open the editor in Chrome or Edge.")));
    const wrap = fieldWrap(def, path, null);
    wrap.replaceChild(box, path);
    return wrap;
  }

  function findSiblingInput(fromEl, key) {
    const block = fromEl.closest(".item-body, fieldset.group, .panel-body");
    return block ? $(`:scope > .field input[data-key="${key}"]`, block) : null;
  }

  function pickFile(accept) {
    return new Promise((res) => {
      const input = el("input", { type: "file", accept });
      input.addEventListener("change", () => res(input.files[0] || null));
      input.click();
    });
  }

  /* Resize big images and store them efficiently:
     - never larger than `max` px (2400 for photos, 512 for logos)
     - PNGs without transparency (renders, screenshots) become much smaller JPGs
     - PNGs with transparency (logos) stay PNG */
  async function processImage(file, max = 2400) {
    const ext0 = (file.name.split(".").pop() || "").toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { blob: file, ext: ext0 || "img" };
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const g = c.getContext("2d");
    g.drawImage(bmp, 0, 0, c.width, c.height);
    let transparent = false;
    if (file.type !== "image/jpeg") {
      const px = g.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < px.length; i += 4 * 7) if (px[i] < 250) { transparent = true; break; }
    }
    if (scale === 1 && file.size < 400 * 1024 && (file.type === "image/jpeg" || transparent)) {
      return { blob: file, ext: ext0 === "jpeg" ? "jpg" : ext0 };
    }
    const asPng = transparent;
    const blob = await new Promise((r) => c.toBlob(r, asPng ? "image/png" : "image/jpeg", 0.85));
    const kb = (n) => Math.round(n / 1024) + " KB";
    return { blob, ext: asPng ? "png" : "jpg", note: `optimized ${kb(file.size)} → ${kb(blob.size)}` };
  }

  /* ---------- resume PDF ---------- */
  function renderResumePdf(def) {
    const status = el("p", { class: "check" }, "Checking…");
    const refresh = async () => {
      const f = await readFileInfo(data.site.resumePdf || "assets/resume.pdf");
      status.className = "check " + (f ? "ok" : "unset");
      status.textContent = f ? `✓ resume.pdf is in the folder (${Math.round(f.size / 1024)} KB, updated ${new Date(f.lastModified).toLocaleDateString()})`
        : dirHandle ? "No resume PDF yet — visitors are sent to the Contact section instead." : "Connect your folder to check or upload the resume.";
    };
    const btn = el("button", { type: "button", class: "btn", onclick: async () => {
      if (!(await folderReadyForUpload())) return;
      const file = await pickFile("application/pdf,.pdf");
      if (!file) return;
      if (!/\.pdf$/i.test(file.name)) return toast("Please choose a PDF file.", true);
      try {
        busy(true, "Saving resume…");
        await writeFile(data.site.resumePdf || "assets/resume.pdf", file);
        toast("Resume saved as assets/resume.pdf");
        refresh(); refreshChecklist();
      } catch (e) { toast("Couldn't save the resume: " + e.message, true); } finally { busy(false); }
    } }, "Upload resume PDF…");
    refresh();
    return el("fieldset", { class: "group" }, el("legend", {}, def.label), btn, status,
      el("p", { class: "hint" }, "Saved as assets/resume.pdf — uploading again replaces the old file."));
  }

  /* ------------------------------------------------------------------
     Folder access (File System Access API)
     ------------------------------------------------------------------ */
  const idb = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open("portfolio-editor", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) {
      try {
        const db = await this.open();
        return await new Promise((res) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
      } catch (e) { return null; }
    },
    async set(k, v) {
      try { const db = await this.open(); db.transaction("kv", "readwrite").objectStore("kv").put(v, k); } catch (e) { /* ignore */ }
    },
  };

  async function hasPermission(h, ask) {
    const opts = { mode: "readwrite" };
    if ((await h.queryPermission(opts)) === "granted") return true;
    return ask ? (await h.requestPermission(opts)) === "granted" : false;
  }

  async function connectFolder() {
    if (!CAN_SAVE) {
      notice("This browser can't save files directly. Open <b>editor.html</b> in <b>Google Chrome</b> or <b>Microsoft Edge</b>, or use <b>Download</b> and replace content.js yourself.");
      return false;
    }
    try {
      const h = await window.showDirectoryPicker({ id: "portfolio", mode: "readwrite" });
      try { await h.getFileHandle("index.html"); await h.getFileHandle("content.js"); }
      catch (e) { toast("That folder doesn't contain index.html and content.js — please choose your portfolio folder.", true); return false; }
      dirHandle = h;
      await idb.set("dir", h);
      updateTopbar();
      hideNotice();
      toast(`Connected to folder “${h.name}”`);
      refreshPage();
      return true;
    } catch (e) {
      if (e.name !== "AbortError") toast("Couldn't open the folder: " + e.message, true);
      return false;
    }
  }

  /* Browsers only allow permission prompts and file dialogs directly after a click,
     and only one per click. So: if the folder isn't ready yet, connect it on this click
     and ask the user to click the upload button once more. */
  async function folderReadyForUpload() {
    if (!CAN_SAVE) {
      notice("Uploading images needs <b>Google Chrome</b> or <b>Microsoft Edge</b>. Please open <b>editor.html</b> in one of them.");
      return false;
    }
    try {
      if (dirHandle && (await dirHandle.queryPermission({ mode: "readwrite" })) === "granted") return true;
      const ok = dirHandle ? await hasPermission(dirHandle, true) || (await connectFolder()) : await connectFolder();
      if (ok) { hideNotice(); toast("Folder connected ✓  Now click the button again to choose your file."); }
      return false;
    } catch (e) {
      console.error(e);
      const ok = await connectFolder();
      if (ok) toast("Folder connected ✓  Now click the button again to choose your file.");
      return false;
    }
  }

  async function ensureFolder() {
    if (dirHandle && (await hasPermission(dirHandle, true))) return true;
    return connectFolder();
  }

  async function writeFile(rel, blob) {
    const parts = rel.split("/").filter(Boolean);
    let dir = dirHandle;
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
    const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  }

  async function readFileInfo(rel) {
    if (!dirHandle || !(await hasPermission(dirHandle, false))) return null;
    try {
      const parts = rel.split("/").filter(Boolean);
      let dir = dirHandle;
      for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
      return await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------
     Save / download
     ------------------------------------------------------------------ */
  function buildContentJs() {
    return `/* =====================================================================
   PORTFOLIO CONTENT
   ---------------------------------------------------------------------
   Easiest way to edit: open editor.html in Chrome or Edge.
   You can also edit this file by hand. Text in [SQUARE BRACKETS] is a
   placeholder. Image paths are relative to the website root.
   Last saved: ${new Date().toISOString().slice(0, 16).replace("T", " ")}
   ===================================================================== */

const SITE = ${JSON.stringify(data.site, null, 2)};

const PROJECTS = ${JSON.stringify(data.projects, null, 2)};
`;
  }

  function validate() {
    const ids = data.projects.map((p) => p.id);
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) return `Two projects use the same page address name “${dup}”. Change one of them (Projects → open project → Page address name).`;
    const empty = data.projects.findIndex((p) => !p.id);
    if (empty >= 0) return `Project ${empty + 1} needs a page address name (Projects → open it → Page address name).`;
    return "";
  }

  async function save(silent) {
    silent = silent === true;
    const err = validate();
    if (err) { toast(err, true); return; }
    if (!CAN_SAVE) { download(); return; }
    if (!(await ensureFolder())) return;
    try {
      busy(true, "Saving…");
      await writeFile("content.js", new Blob([buildContentJs()], { type: "text/javascript" }));
      await updateSeo();
      savedJSON = JSON.stringify(data);
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* ignore */ }
      updateTopbar();
      if (!silent) toast("Saved ✓  Your changes are in content.js. Upload the folder to GitHub to publish them.");
    } catch (e) {
      toast("Save failed: " + e.message, true);
    } finally { if (!silent) busy(false); }
  }

  /* Keep the <title> and meta tags in index.html (used by Google & link previews)
     in sync with your name / title / statement. Skipped while the name is a placeholder. */
  async function updateSeo() {
    const s = data.site;
    if (!s.name || PH.test(s.name)) return;
    try {
      const fh = await dirHandle.getFileHandle("index.html");
      const html = await (await fh.getFile()).text();
      const attr = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      const title = plain(s.title) ? `${s.name} — ${plain(s.title)}` : s.name;
      let desc = `Portfolio of ${s.name}${plain(s.title) ? ", " + plain(s.title) : ""}.${s.statement && !PH.test(s.statement) ? " " + s.statement : ""}`;
      if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, "") + "…";
      const next = html
        .replace(/<title>[^<]*<\/title>/, `<title>${attr(title)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*(")/, `$1${attr(desc)}$2`)
        .replace(/(<meta name="author" content=")[^"]*(")/, `$1${attr(plain(s.personName) || s.name)}$2`)
        .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${attr(title)}$2`)
        .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${attr(desc)}$2`);
      if (next !== html) await writeFile("index.html", new Blob([next], { type: "text/html" }));
    } catch (e) {
      console.warn("Could not update index.html meta tags:", e);
    }
  }

  function download() {
    const err = validate();
    if (err) { toast(err, true); return; }
    const a = el("a", { href: URL.createObjectURL(new Blob([buildContentJs()], { type: "text/javascript" })), download: "content.js" });
    document.body.append(a); a.click(); a.remove();
    toast("Downloaded content.js — replace the old content.js in your portfolio folder with it.");
  }

  /* ------------------------------------------------------------------
     Change tracking, autosave, preview
     ------------------------------------------------------------------ */
  let previewTimer, autosaveTimer;
  function changed(ctx) {
    if (ctx && ctx.onItemChange) ctx.onItemChange();
    refreshChecklistSoon();
    updateTopbar();
    updateNavBadges();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ t: Date.now(), data })); } catch (e) { /* ignore */ }
    }, 400);
    clearTimeout(previewTimer);
    previewTimer = setTimeout(reloadPreview, 650);
  }

  let clTimer;
  function refreshChecklistSoon() { clearTimeout(clTimer); clTimer = setTimeout(refreshChecklist, 500); }

  const dirty = () => JSON.stringify(data) !== savedJSON;

  function countPh(o) {
    const s = JSON.stringify(o || "");
    return (s.match(/\[[^\]"{]+\]/g) || []).length;
  }

  function setPreview(path, hash, projectId) {
    previewPath = path;
    previewHash = hash || "";
    previewProject = projectId || "";
    reloadPreview();
  }
  let previewProject = "";

  function reloadPreview() {
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    const frame = $("[data-preview]");
    const key = previewPath + "|" + previewProject + "|" + previewHash;
    const samePage = frame.dataset.page === key;
    let y = 0;
    if (samePage) try { y = frame.contentWindow.scrollY; } catch (e) { /* not readable on file:// */ }
    frame.dataset.page = key;
    frame.onload = () => { if (y) try { frame.contentWindow.scrollTo(0, y); } catch (e) { /* ignore */ } };
    const q = `?preview=1${previewProject ? "&id=" + encodeURIComponent(previewProject) : ""}&t=${Date.now()}`;
    frame.src = previewPath + q + previewHash;
  }

  function fitPreview() {
    const stage = $("[data-stage]");
    const frame = $("[data-preview]");
    const mobile = stage.dataset.size === "mobile";
    const W = mobile ? 390 : 1280;
    const s = Math.min(1, (stage.clientWidth - (mobile ? 24 : 0)) / W);
    frame.style.width = W + "px";
    frame.style.height = Math.round((stage.clientHeight - (mobile ? 24 : 0)) / s) + "px";
    frame.style.transform = `scale(${s})`;
  }

  /* ------------------------------------------------------------------
     UI chrome: nav, panel, topbar, notices
     ------------------------------------------------------------------ */
  function renderNav() {
    const nav = $("[data-nav]");
    nav.innerHTML = "";
    PAGES.forEach((p) => {
      nav.append(el("button", { type: "button", class: "nav-item", "data-page": p.id, "aria-current": p.id === page ? "page" : null,
        onclick: () => go(p.id) }, el("span", {}, p.label), el("span", { class: "badge", "data-badge": p.id })));
    });
    nav.append(el("div", { class: "nav-help" },
      el("strong", {}, "How it works"),
      el("ol", {},
        el("li", {}, "Connect folder (once)"),
        el("li", {}, "Edit — preview updates live"),
        el("li", {}, "Save (Ctrl+S)"),
        el("li", {}, "Upload to GitHub to publish"))));
    updateNavBadges();
  }

  function updateNavBadges() {
    const scope = {
      profile: () => [data.site.name, data.site.title, data.site.statement, data.site.location, data.site.availability, data.site.heroImage],
      contact: () => [data.site.contact, data.site.contactLead],
      about: () => [data.site.about, data.site.stats],
      services: () => [data.site.services, data.site.process],
      skills: () => data.site.skills,
      projects: () => data.projects,
      resume: () => data.site.resume,
      settings: () => null,
    };
    PAGES.forEach((p) => {
      const b = $(`[data-badge="${p.id}"]`);
      if (!b) return;
      const n = countPh(scope[p.id]());
      b.textContent = n ? String(n) : "";
      b.title = n ? `${n} placeholder${n > 1 ? "s" : ""} to fill in` : "";
    });
  }

  function go(id) {
    page = id;
    $$(".nav-item").forEach((b) => b.setAttribute("aria-current", b.dataset.page === id ? "page" : "false"));
    const p = PAGES.find((x) => x.id === id);
    renderPanel();
    if (id !== "projects") setPreview("index.html", p.hash, "");
    else {
      const open = data.projects.find((pr) => openItems.has(pr));
      if (open) setPreview("projects/project.html", "", open.id); else setPreview("index.html", p.hash, "");
    }
    $("[data-panel]").scrollTop = 0;
  }

  function refreshPage() { renderPanel(); }

  function renderPanel() {
    const p = PAGES.find((x) => x.id === page);
    const panel = $("[data-panel]");
    panel.innerHTML = "";
    const body = el("div", { class: "panel-body" });
    const ctx = {};
    p.fields.forEach((f) => body.append(renderField(f, p.obj(data), ctx)));
    panel.append(el("header", { class: "panel-head" }, el("h1", {}, p.label), el("p", {}, p.intro)), body);
    refreshChecklist();
  }

  async function refreshChecklist() {
    const box = $("[data-checklist]");
    if (!box) return;
    const ph = countPh(data);
    const c = data.site.contact;
    const contacts = ["email", "whatsapp", "telegram"].map((k) => CONTACT[k](c[k])).concat([CONTACT.url(c.linkedin), CONTACT.url(c.x), CONTACT.url(c.instagram)]);
    const okContacts = contacts.filter((r) => r.state === "ok").length;
    const resume = await readFileInfo(data.site.resumePdf || "assets/resume.pdf");
    const realImgs = data.projects.filter((p) => p.image && !/placeholders\//.test(p.image)).length;
    const items = [
      [ph === 0, ph ? `${ph} placeholder${ph > 1 ? "s" : ""} still to fill in (see the numbers in the menu)` : "No placeholders left"],
      [okContacts > 0, `${okContacts} of 6 contact methods set`],
      [!!resume, resume ? "Resume PDF uploaded" : dirHandle ? "Resume PDF not uploaded (Resume page)" : "Resume PDF — connect folder to check"],
      [realImgs === data.projects.length && data.projects.length > 0, `${realImgs} of ${data.projects.length} projects have your own cover image`],
      [data.site.draft === false, data.site.draft === false ? "Draft mode is off" : "Turn Draft mode off (below)"],
      [!dirty(), dirty() ? "Unsaved changes — click Save" : "All changes saved"],
    ];
    box.innerHTML = "";
    box.append(el("h3", {}, "Before you publish"),
      el("ul", {}, items.map(([ok, text]) => el("li", { class: ok ? "ok" : "todo" }, el("span", { "aria-hidden": "true" }, ok ? "✓" : "•"), text))));
  }

  function updateTopbar() {
    const st = $("[data-status]");
    const d = dirty();
    st.className = "status " + (d ? "unsaved" : "saved");
    st.textContent = d ? "● Unsaved changes" : "✓ All changes saved";
    const cb = $('[data-action="connect"]');
    cb.textContent = dirHandle ? "📁 " + dirHandle.name : "Connect folder";
    cb.classList.toggle("connected", !!dirHandle);
    $('[data-action="save"]').textContent = CAN_SAVE ? "Save" : "Download content.js";
  }

  let noticeEl;
  function notice(html, actions) {
    noticeEl = $("[data-notice]");
    noticeEl.innerHTML = "";
    noticeEl.append(el("div", { class: "notice-text", html }), el("div", { class: "notice-actions" }, actions || [],
      el("button", { type: "button", class: "btn ghost", onclick: hideNotice }, "Dismiss")));
    noticeEl.hidden = false;
  }
  function hideNotice() { const n = $("[data-notice]"); if (n) n.hidden = true; }

  let toastTimer;
  function toast(msg, isError) {
    const t = $("[data-toast]");
    t.textContent = msg;
    t.className = "toast show" + (isError ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "toast"), isError ? 7000 : 4500);
  }
  function busy(on, msg) {
    document.body.classList.toggle("busy", on);
    if (on && msg) toast(msg);
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function loadContent() {
    return new Promise((res) => {
      const s = document.createElement("script");
      s.src = "content.js?v=" + Date.now();
      s.onload = () => res(true);
      s.onerror = () => res(false);
      document.head.append(s);
    });
  }

  async function boot() {
    const ok = await loadContent();
    /* global SITE, PROJECTS */
    if (!ok || typeof SITE === "undefined") {
      $("[data-panel]").innerHTML = "<div class='panel-body'><h1>content.js could not be loaded</h1><p>Make sure editor.html is inside your portfolio folder, next to content.js. If you edited content.js by hand, it may contain a typo — undo the last change.</p></div>";
      return;
    }
    data = normalize(SITE, typeof PROJECTS !== "undefined" ? PROJECTS : []);
    savedJSON = JSON.stringify(data);

    // Offer to restore unsaved edits from last time
    try {
      const a = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || "null");
      if (a && a.data && JSON.stringify(a.data) !== savedJSON) {
        notice(`You have unsaved edits from <b>${new Date(a.t).toLocaleString()}</b>.`, [
          el("button", { type: "button", class: "btn primary", onclick: () => {
            data = normalize(a.data.site, a.data.projects); hideNotice(); renderNav(); renderPanel(); changed();
            toast("Unsaved edits restored — click Save to keep them.");
          } }, "Restore them"),
          el("button", { type: "button", class: "btn ghost", onclick: () => { localStorage.removeItem(AUTOSAVE_KEY); hideNotice(); } }, "Discard"),
        ]);
      }
    } catch (e) { /* ignore */ }

    // Reconnect to the previously used folder
    if (CAN_SAVE) {
      const h = await idb.get("dir");
      if (h) {
        dirHandle = h;
        if (!(await hasPermission(h, false))) {
          if ($("[data-notice]").hidden) notice(`Click <b>Reconnect</b> to allow saving into “${h.name}”.`, [
            el("button", { type: "button", class: "btn primary", onclick: async () => {
              if (await hasPermission(h, true)) { hideNotice(); toast("Folder reconnected"); refreshPage(); }
            } }, "Reconnect")]);
        }
      } else if ($("[data-notice]").hidden) {
        notice("<b>Welcome!</b> First, click <b>Connect folder</b> and choose your portfolio folder (the one containing index.html). Then edit on the left, and click <b>Save</b>.",
          [el("button", { type: "button", class: "btn primary", onclick: connectFolder }, "Connect folder")]);
      }
    } else {
      notice("This browser can't save files directly. For the best experience open <b>editor.html</b> in <b>Google Chrome</b> or <b>Microsoft Edge</b>. You can still edit here and use <b>Download</b>.");
    }

    renderNav();
    renderPanel();
    updateTopbar();
    go(page);

    // events
    $('[data-action="save"]').addEventListener("click", save);
    $('[data-action="download"]').addEventListener("click", download);
    $('[data-action="connect"]').addEventListener("click", connectFolder);
    $('[data-action="reload-preview"]').addEventListener("click", reloadPreview);
    $('[data-action="toggle-preview"]').addEventListener("click", () => {
      document.body.classList.toggle("show-preview");
      requestAnimationFrame(fitPreview);
    });
    $$("[data-size]").forEach((b) => b.addEventListener("click", () => {
      $("[data-stage]").dataset.size = b.dataset.size;
      $$("[data-size]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      fitPreview();
    }));
    window.addEventListener("resize", fitPreview);
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    });
    window.addEventListener("beforeunload", (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });
    fitPreview();
  }

  boot();
})();
