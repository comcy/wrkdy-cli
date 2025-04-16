// view-server.ts
import express, { Express } from "express";
import path from "path";
import fs from "fs";
import { marked } from "marked";
import { loadConfig } from "./config";
import matter from "gray-matter";


export async function startViewMode(port = 3000) {
  
  const open = (await import("open")).default;
  const app: Express = express();
  const config = loadConfig();

  app.use("/static", express.static(config.wrkdyPath));

  // app.get("/", (req, res) => {
  //   res.redirect("/pages/index");
  // });

  app.get("/", (req: any, res: any) => {
    const folders = fs.readdirSync(config.wrkdyPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `<li><a href="/${entry.name}">${entry.name}</a></li>`)
      .join("");

    res.send(renderHTML("Startseite", `<h2>Inhaltsverzeichnisse</h2><ul>${folders}</ul>`));
  });

  app.get("/:type/:name", (req: any, res: any) => {
    const { type, name } = req.params;
    const dirPath = path.join(config.wrkdyPath, type);
    const filePath = path.join(dirPath, `${name}.md`);
    const subDirPath = path.join(dirPath, name);
  
    if (!fs.existsSync(dirPath)) return res.status(404).send("Nicht gefunden.");
  
    // Table of contents for sidebar
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith(".md"));
    const toc = files.map(f => {
      const base = f.replace(/\.md$/, "");
      return `<li><a href="/${type}/${base}">${base}</a></li>`;
    }).join("");
  
    // === FALL 1: Datei mit Name.md existiert
    if (fs.existsSync(filePath)) {
      const rawContent = fs.readFileSync(filePath, "utf8");
      const { content, data } = matter(rawContent);
  
      const fixedContent = content.replace(/\[([^\]]+)\]\(([^)]+)\.md\)/g, (_, text, link) => {
        return `[${text}](/${type}/${link})`;
      });
  
      const html = marked(fixedContent);
  
      const frontMatterHtml = Object.entries(data).map(
        ([key, value]) => `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`
      ).join("");
  
      const styledFrontMatter = `
        <div class="front-matter">
          <table style="font-size: 0.85em; margin-bottom: 1rem;">
            ${frontMatterHtml}
          </table>
          <hr/>
        </div>
      `;
  
      res.send(renderHTML(name, styledFrontMatter + html, toc));
  
    // === FALL 2: Es ist ein Unterordner → zeige dessen .md-Dateien
    } else if (fs.existsSync(subDirPath) && fs.statSync(subDirPath).isDirectory()) {
      const subFiles = fs.readdirSync(subDirPath).filter(f => f.endsWith(".md"));
      const subList = subFiles.map(f => {
        const base = f.replace(/\.md$/, "");
        return `<li><a href="/${type}/${name}/${base}">${base}</a></li>`;
      }).join("");
  
      res.send(renderHTML(`${type}/${name}`, `<h2>Verzeichnis: ${type}/${name}</h2><ul>${subList}</ul>`, toc));
  
    } else {
      res.status(404).send("Datei nicht gefunden.");
    }
  });
  

  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`📖 View-Server läuft auf ${url}`);
    open(url);
  });
}

function buildRecursiveToc(dir: string, baseUrl: string = ""): string {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let list = "<ul>";

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(dir, entry.name);
      list += `<li><strong>${entry.name}/</strong>${buildRecursiveToc(subDir, `${baseUrl}/${entry.name}`)}</li>`;
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const nameWithoutExt = entry.name.replace(/\.md$/, "");
      list += `<li><a href="${baseUrl}/${nameWithoutExt}">${nameWithoutExt}</a></li>`;
    }
  }

  list += "</ul>";
  return list;
}


function renderHTML(name: string, html: string, toc: string = ''): string {
  return `
  <html>
    <head>
      <title>${name}</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.1.0/github-markdown.min.css">
      <style>
        body {
          font-family: system-ui, sans-serif;
          background: #f2f2f2;
          margin: 8px;
          padding: 0;
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }

        nav {
          width: 200px;
          padding: 2rem;
          background: #ffffff;
          border-right: 1px solid #e0e0e0;
          height: 100vh;
          overflow-y: auto;
        }
        .markdown-body {
          background: #fff;
          padding: 2rem;
          border-radius: 12px;
          width: 100%;
          margin: 2rem;
          box-shadow: 0 8px 30px rgba(0,0,0,0.05);
        }
        pre {
          background: #f6f8fa;
          padding: 1rem;
          overflow-x: auto;
          border-radius: 6px;
        }
        .topnav {
          margin-bottom: 1.5rem;
        }
        .topnav a, .topnav button {
          margin-right: 1rem;
          text-decoration: none;
          font-weight: bold;
        }
        .front-matter {
          font-size: 0.85rem;
          color: #555;
          // margin-bottom: 1rem;
          // border-left: 4px solid #ccc;
          // padding-left: 1rem;
        }
        .front-matter div {
          margin-bottom: 0.3rem;
        }
      </style>
      <script>
        const ws = new WebSocket("ws://" + location.host);
        ws.onmessage = (msg) => {
          if (msg.data === "reload") location.reload();
        };
      </script>
    </head>
    <body>
      <nav>
        <h3>📂 Inhalt</h3>
        <ul>${toc}</ul>
      </nav>
      <main class="markdown-body">
        <div class="topnav">
          <a href="/">🏠 Startseite</a>
          <button onclick="history.back()">🔙 Zurück</button>
        </div>
        ${html}
      </main>
    </body>
  </html>
`;
}