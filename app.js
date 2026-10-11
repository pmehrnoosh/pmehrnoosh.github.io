const CONTENT_URL = "portfolio.md";
let lastContent = "";
let statusTimer;

const escapeHtml = (value = "") =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );

function formatInline(value) {
  return escapeHtml(value).replace(
    /\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g,
    (match, doubleStar, doubleUnderscore, singleStar, italic) =>
      italic !== undefined
        ? `<em>${italic}</em>`
        : `<strong>${doubleStar ?? doubleUnderscore ?? singleStar}</strong>`,
  );
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { data: {}, body: markdown };

  const data = {};
  match[1].split("\n").forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    data[key] = value;
  });

  return { data, body: markdown.slice(match[0].length) };
}

function parseSections(body) {
  const sections = [];
  let current = null;
  let item = null;

  body.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith("# ")) {
      current = { title: line.slice(2).trim(), intro: [], items: [] };
      sections.push(current);
      item = null;
      return;
    }

    if (!current) return;

    if (line.startsWith("## ")) {
      item = { title: line.slice(3).trim(), meta: "", bullets: [], text: [] };
      current.items.push(item);
      return;
    }

    if (line.startsWith("*-") || line === "*") return;

    if (/^_[^_].*[^_]_$/.test(line) && item) {
      item.meta = line.slice(1, -1);
      return;
    }

    if (line.startsWith("- ") && item) {
      item.bullets.push(line.slice(2));
      return;
    }

    if (item) item.text.push(line);
    else current.intro.push(line);
  });

  return sections;
}

function linkFor(label, value) {
  if (!value) return "";
  const safeLabel = escapeHtml(label);
  const safeValue = escapeHtml(value);
  let href = "";

  if (label === "Email") href = `mailto:${safeValue}`;
  if (label === "Phone") href = `tel:${safeValue.replace(/\s/g, "")}`;
  if (label === "LinkedIn") {
    href = safeValue.startsWith("http") ? safeValue : `https://${safeValue}`;
  }

  const content = href
    ? `<a href="${href}"${label === "LinkedIn" ? ' target="_blank" rel="noreferrer"' : ""}>${safeValue}</a>`
    : safeValue;

  return `<li><span class="sr-only">${safeLabel}: </span>${content}</li>`;
}

function renderSection(section) {
  const title = formatInline(section.title);
  const type = section.title.toLowerCase();

  if (type === "summary") {
    const paragraphs = section.intro
      .map((paragraph) => `<p>${formatInline(paragraph)}</p>`)
      .join("");
    return sectionShell(title, paragraphs);
  }

  if (type === "skills") {
    const groups = section.items
      .map(
        (group) => `
          <div class="skill-group">
            <h3>${formatInline(group.title)}</h3>
            <ul>${group.bullets.map((skill) => `<li>${formatInline(skill)}</li>`).join("")}</ul>
          </div>`,
      )
      .join("");
    return sectionShell(title, `<div class="skills-grid">${groups}</div>`);
  }

  const entries = section.items
    .map(
      (entry) => `
        <article class="entry">
          <h3>${formatInline(entry.title)}</h3>
          ${entry.meta ? `<p class="meta">${formatInline(entry.meta)}</p>` : ""}
          ${entry.text.map((text) => `<p>${formatInline(text)}</p>`).join("")}
          ${entry.bullets.length ? `<ul>${entry.bullets.map((bullet) => `<li>${formatInline(bullet)}</li>`).join("")}</ul>` : ""}
        </article>`,
    )
    .join("");

  return sectionShell(title, entries);
}

function sectionShell(title, body) {
  return `
    <section class="resume-section" aria-labelledby="section-${slugify(title)}">
      <h2 id="section-${slugify(title)}">${title}</h2>
      <div class="section-body">${body}</div>
    </section>`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fitName() {
  const heading = document.getElementById("name");
  heading.style.removeProperty("font-size");
  const availableWidth = heading.parentElement.clientWidth;
  if (!availableWidth || !heading.textContent.trim()) return;

  const style = window.getComputedStyle(heading);
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return;
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const widestWord = Math.max(
    ...heading.textContent.trim().split(/\s+/).map((word) => context.measureText(word).width),
  );
  if (widestWord > availableWidth) {
    heading.style.fontSize = `${parseFloat(style.fontSize) * availableWidth / widestWord}px`;
  }
}

window.addEventListener("resize", fitName);
document.fonts.ready.then(fitName);

function render(markdown) {
  const { data, body } = parseFrontmatter(markdown);
  const sections = parseSections(body);
  const name = data.name || "Your Name";

  document.title = `${name} — Portfolio`;
  document.getElementById("name").textContent = name;
  fitName();
  document.getElementById("role").textContent =
    data.role || "Professional Title";

  document.getElementById("contact-list").innerHTML = [
    linkFor("Location", data.location),
    linkFor("Email", data.email),
    linkFor("Phone", data.phone),
    linkFor("LinkedIn", data.linkedin),
  ].join("");

  document.getElementById("content").innerHTML = sections
    .map(renderSection)
    .join("");
}

function showStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.classList.add("is-visible");
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(
    () => status.classList.remove("is-visible"),
    1600,
  );
}

async function loadContent({ announce = false } = {}) {
  try {
    const response = await fetch(`${CONTENT_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Could not load ${CONTENT_URL}`);
    const markdown = await response.text();
    if (markdown === lastContent) return;

    render(markdown);
    if (lastContent && announce) showStatus("Portfolio updated");
    lastContent = markdown;
  } catch (error) {
    if (!lastContent) {
      document.getElementById("content").innerHTML = `
        <p class="error">The portfolio content could not be loaded. Open this folder through a local web server rather than opening index.html directly.</p>`;
    }
    console.error(error);
  }
}

loadContent();
