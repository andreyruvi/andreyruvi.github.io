# Professional Portfolio: Revit / BIM Specialist

A static portfolio website for a Revit / BIM specialist and architectural designer. It's written for architecture firms, BIM companies, contractors, and recruiters who want to see your work, skills, and resume quickly and contact you in one click.

It runs on GitHub Pages as is. There's no backend, no database, and no build step.

## Features

- Responsive layout for desktop, laptop, tablet, and mobile, with a hamburger menu on small screens
- Revit/BIM project showcase with project cards, optional type filters, and a detail page for each project
- Project gallery with a full-screen image viewer (keyboard arrows, Esc, and swipe)
- Resume section with an experience timeline, qualifications, and a PDF download
- One-click contact links for Email, WhatsApp, Telegram, LinkedIn, and X
- Draft mode that highlights every placeholder so none of them go live by mistake
- SEO and Open Graph metadata, semantic HTML, visible focus states, and `prefers-reduced-motion` support
- Lightweight: no frameworks or libraries, just three Google Fonts

## Design & effects

The site uses a dark theme with a brass accent and a blueprint grid. Headings use a wide architectural typeface (Archivo), with italic serif accents (Instrument Serif).

- **Effects:** hero intro animation and image wipe, CAD-style crosshair with coordinates, pointer spotlight on the blueprint grid, scroll progress bar, services ticker, soft glow on cards that follows the cursor, slight 3D tilt on project cards, sliding button fills, and fade-in on scroll.
- **When effects run:** pointer effects only run on devices with a mouse. Visitors who have "reduce motion" turned on in their system settings get a still version automatically.
- **Changing it:** colors live in `style.css` → `:root`. The accent color is `--accent`. The effects are in `script.js` → `setupEffects()`.

## Technologies

HTML5, CSS3, and plain (vanilla) JavaScript.

## Project structure

```
/
├── index.html              Main one-page site (Home, About, Services, Skills, Portfolio, Resume, Contact)
├── editor.html             ★ VISUAL EDITOR: open in Chrome/Edge to edit everything with forms
├── editor/                 Editor files (editor.js, editor.css)
├── content.js              All your content (written by the editor, or edit by hand)
├── style.css               Design (colors and fonts are at the top in :root)
├── script.js               Builds the page from content.js; you normally don't need to edit this
├── README.md
├── .nojekyll               Tells GitHub Pages to serve the files as they are
│
├── assets/
│   ├── resume.pdf          ← add your resume here (not included yet)
│   └── images/
│       ├── projects/       ← your project images, one folder per project
│       ├── profile/        ← optional portrait
│       ├── logos/          ← favicon
│       └── placeholders/   ← line-drawing placeholders (delete once you've replaced them)
│
└── projects/
    └── project.html        Detail page template, used for every project (?id=project-01)
```

## ★ Easiest way to edit: the visual editor (no coding)

1. Open the portfolio folder and double-click **`editor.html`**. It must open in **Google Chrome** or **Microsoft Edge**. If it opens in another browser, right-click it and choose **Open with → Chrome / Edge**.
2. Click **Connect folder** and select this portfolio folder (the one containing `index.html`). Click **Allow / Edit files** when the browser asks. You only do this once.
3. Pick a section on the left (**Profile, Contact, About, Services, Skills, Projects, Resume, Settings**) and fill in the forms. The **live preview** on the right updates as you type.
   - Orange numbers in the menu show how many placeholders are left in each section.
   - **Choose image…** copies your photo into the right folder. Large photos are resized automatically.
   - Under **Projects**, click **+ Add project**. Use ↑ ↓ to reorder, ⧉ to duplicate, and ✕ to delete.
   - Under **Resume**, click **Upload resume PDF…**.
   - Under **Settings**, you can change the accent color, hide sections, turn effects off, and see the **"Before you publish"** checklist.
4. Click **Save** (or press **Ctrl+S**). Your changes are written into `content.js`, and your images and resume go into `assets/`.
5. **Publish:** upload the changed files to GitHub (see [GitHub Pages deployment](#github-pages-deployment)). With **GitHub Desktop**, publishing is just **Commit → Push**.

Good to know:
- The editor only changes files **on your computer**. The live website changes when you upload to GitHub.
- If you close the editor without saving, it offers to restore your edits the next time you open it.
- `editor.html` and the `editor/` folder can be uploaded too. They're hidden from Google and can't change your live site. You can also leave them out of the upload.
- After you publish, GitHub Pages can take a few minutes to show the new content. Refresh with **Ctrl+F5**.

## Customization: where to edit what (by hand)

You don't need this section if you use the editor. Almost everything is in **`content.js`**. Any text in `[SQUARE BRACKETS]` is a placeholder. Replace it and remove the brackets.

| What | Where |
|---|---|
| Name | `content.js` → `SITE.name` |
| Title | `content.js` → `SITE.title` |
| Hero statement / location / availability | `content.js` → `SITE.statement`, `SITE.location`, `SITE.availability` |
| Hero image | `content.js` → `SITE.heroImage` |
| About section | `content.js` → `SITE.about` (lead, paragraphs, facts) |
| Services | `content.js` → `SITE.services` |
| Skills | `content.js` → `SITE.skills` |
| Resume content (summary, experience, education, certifications, languages, training) | `content.js` → `SITE.resume` |
| Resume PDF | `assets/resume.pdf` |
| Email, WhatsApp, Telegram, LinkedIn, X | `content.js` → `SITE.contact` |
| Projects | `content.js` → `PROJECTS` |
| Browser tab title, Google description, social previews | Updated automatically when you Save in the editor (or edit `index.html` → `<head>`) |
| Colors / fonts | `style.css` → `:root` at the top |

> **Important:** the Services and Skills lists are suggestions taken from the original brief. Delete anything you don't actually offer or use.

### Draft mode

While `draft: true` is set in `content.js`:

- a banner at the top reminds you that the site is a draft
- every `[placeholder]` is outlined
- contact methods you haven't set yet show as **"Not set"**

When your content is ready, set `draft: false`. Any contact method that's still a placeholder is then **hidden automatically**, so no fake links can go live. Also check that no `[brackets]` are left anywhere on the page.

### 1. Change contact information

In `content.js`:

```js
contact: {
  email: "you@example.com",                           // just the address
  whatsapp: "15551234567",                            // international number: country code + number, digits only
  telegram: "yourusername",                           // without the @
  linkedin: "https://www.linkedin.com/in/your-profile/",
  x: "https://x.com/yourhandle",
},
```

The site builds the correct links for you: `mailto:`, `https://wa.me/…`, and `https://t.me/…`. To leave a method out, keep its placeholder and it will be hidden once `draft: false` is set.

### 2. Add a project

1. Create a folder such as `assets/images/projects/riverside-residence/` and put the images in it.
2. In `content.js`, copy one `{ … }` block inside `PROJECTS`, paste it, and fill it in:

```js
{
  id: "riverside-residence",              // unique, lowercase, no spaces; used in the page URL
  title: "Riverside Residence",
  category: "Residential Architecture",    // used for the portfolio filter buttons
  location: "…",
  year: "…",
  role: "Revit / BIM Modeler",
  software: ["Revit", "AutoCAD"],
  scope: "Architectural modeling, documentation, drawing production.",
  image: "assets/images/projects/riverside-residence/cover.jpg",
  imageAlt: "Exterior view of the Revit model of Riverside Residence",
  summary: "One sentence for the project card.",
  description: ["Paragraph one…", "Paragraph two…"],
  responsibilities: ["…", "…"],
  deliverables: ["Floor plans", "Elevations", "Sections"],
  gallery: [
    { src: "assets/images/projects/riverside-residence/plan.jpg", alt: "Level 1 floor plan", caption: "Level 1 floor plan" },
  ],
},
```

The project card and its detail page (`projects/project.html?id=riverside-residence`) appear automatically. Projects show in the same order as in the file. Filter buttons appear once you have two or more distinct `category` values.

To remove a sample project, delete its whole `{ … },` block.

### 3. Replace project images

- Use **JPG** for renders and screenshots and **PNG** for crisp drawings. About **2000px wide** is plenty.
- Keep each image under about **500 KB** (you can compress for free at [squoosh.app](https://squoosh.app)).
- Landscape images with a **16:10** ratio fit the cards best.
- Write a meaningful `alt` for every image, e.g. `"Revit 3D model of a two-storey residence"`.
- File names are **case-sensitive** on GitHub Pages: `Cover.JPG` and `cover.jpg` are different files.
- Once every placeholder image is replaced, you can delete `assets/images/placeholders/`.

### 4. Replace the resume PDF

Save your resume as **`assets/resume.pdf`**, using that exact lowercase name. To replace it later, overwrite the file. Until the file exists, the "Download Resume" buttons send visitors to the Contact section instead of a broken link.

### 5. SEO and social preview

In `index.html` → `<head>`, replace `[Your Name]` in the `<title>`, `description`, `author`, and `og:title` tags. Once the site is live, uncomment `og:url` and `canonical` and fill in your real address. For a link-preview image, add a 1200×630 JPG to `assets/images/og-image.jpg` and uncomment the `og:image` line, which needs the full URL.

## Preview locally

Open `index.html` in a browser. For the most accurate preview (including the resume check), run a small local server in the project folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Updating the live website: double-click `update.bat`

After the site is published (it is: https://andreyruvi.github.io/):

1. Open `editor.html`, make your changes, press **Save**.
2. Double-click **`update.bat`**.

It lists what changed, asks before removing any file, and sends the update. It never creates a new repository. If the folder isn't connected yet, it stops and says so. Changes appear in 1–2 minutes (Ctrl+F5 to refresh).

## First-time publishing: `push.bat`

1. Save your changes in the editor.
2. Double-click **`push.bat`** in this folder.
3. **The first time only:**
   - If the GitHub repository doesn't exist yet, GitHub's "Create a new repository" page opens with the name **andreyruvi.github.io** already filled in. Keep it Public, don't tick "Add a README file", click **Create repository**, then press **R** in the black window.
   - A GitHub sign-in window may open in your browser. Sign in once and Windows remembers it.
4. The script shows what changed, asks before removing anything, uploads, and offers to open **https://andreyruvi.github.io/**. The first publish takes up to 10 minutes to go live; later updates take 1–2 minutes.

It warns you if Draft mode is still on. No password is stored in the file.

## GitHub Pages deployment (manual alternative)

1. **Create a repository.** On GitHub, click **New repository**. Name it, for example, `portfolio`, make it **Public**, and click **Create repository**.
   *(Tip: name it `YOUR_USERNAME.github.io` and the site will live at `https://YOUR_USERNAME.github.io/`.)*
2. **Upload the files.** On the new repository page, click **uploading an existing file** and drag in **everything inside this folder**, including `.nojekyll`, `index.html`, `content.js`, and the `assets` and `projects` folders. `index.html` must be at the top level of the repository, not inside a subfolder.
3. **Commit changes.** Scroll down and click **Commit changes**.
4. **Open repository Settings.** Click the **Settings** tab of the repository.
5. **Open Pages.** In the left sidebar, click **Pages**.
6. **Select a deployment source.** Under **Build and deployment → Source**, choose **Deploy from a branch**. Under **Branch**, choose `main` and `/ (root)`, then click **Save**.
7. **Deploy.** GitHub builds the site. This takes 1–2 minutes, and you can watch progress in the **Actions** tab.
8. **Open the generated website.** Refresh **Settings → Pages** and a banner shows **"Your site is live at https://YOUR_USERNAME.github.io/portfolio/"**. Click **Visit site**.

**Easiest way to publish updates: GitHub Desktop.** Install [GitHub Desktop](https://desktop.github.com/), sign in, and choose **File → Add local repository** (or clone your repository and put these files in it). After saving in the editor, open GitHub Desktop, type a short summary such as "Update projects", then click **Commit to main** and **Push origin**.

**To update the site later (web upload):** edit or upload the changed files in the repository and commit. The site redeploys automatically within a minute or two. Refresh with Ctrl+F5 if you still see the old version.

Using git instead of the web uploader:

```bash
git init
git add .
git commit -m "Portfolio website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/portfolio.git
git push -u origin main
```

## Pre-publish checklist

- [ ] All `[placeholders]` in `content.js` replaced, or their items removed
- [ ] Services and Skills contain only what you actually offer
- [ ] `draft: false` in `content.js`
- [ ] `assets/resume.pdf` uploaded
- [ ] Real project images added with descriptive `alt` text
- [ ] `<title>` and meta tags in `index.html` updated
- [ ] Every contact link clicked once on the live site
