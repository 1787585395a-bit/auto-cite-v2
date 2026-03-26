import cors from "cors";
import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const uploadsDir = path.join(__dirname, "uploads");
const jobsRootDir = path.join(projectRoot, "outputs", "jobs");

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(jobsRootDir, { recursive: true });

const app = express();
const fileCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of fileCache.entries()) {
    if (value.expires < now) {
      fileCache.delete(key);
    }
  }
}, 15 * 60 * 1000);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json());

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupUploadedFiles(files) {
  for (const file of files) {
    if (!file) continue;
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      // Ignore best-effort cleanup failures.
    }
  }
}

function buildCitations(table) {
  return table.map((entry) => ({
    id: entry.footnote_id,
    anchorNumber: Number.parseInt(entry.footnote_id, 10) || 0,
    originalContext: entry.english_sentence || "",
    originalFootnote: entry.english_footnote || "",
    targetSentence: entry.chinese_sentence || "",
    translatedFootnote: entry.chinese_footnote || "",
    confidence: entry.confidence ?? 0.8,
    status: "pending",
    isOrphaned: false,
  }));
}

function buildPipelineArgs({ englishPath, chinesePath, outputPath, outputDir, citationStyle }) {
  const pythonScript = path.join(projectRoot, "scripts", "run_full_pipeline.py");
  const args = [
    "-u",
    pythonScript,
    "--english",
    englishPath,
    "--output",
    outputPath,
    "--output-dir",
    outputDir,
    "--citation-style",
    citationStyle || "GB/T 7714",
  ];

  if (chinesePath) {
    args.push("--chinese", chinesePath);
  }

  return args;
}

function spawnPipeline({ englishPath, chinesePath, outputPath, outputDir, citationStyle }) {
  return spawn("python", buildPipelineArgs({ englishPath, chinesePath, outputPath, outputDir, citationStyle }), {
    cwd: projectRoot,
    env: {
      ...process.env,
      HTTP_PROXY: "",
      HTTPS_PROXY: "",
      http_proxy: "",
      https_proxy: "",
      NO_PROXY: "*",
      PYTHONUNBUFFERED: "1",
      AUTO_CITE_OUTPUT_DIR: outputDir,
    },
  });
}

function readJobArtifacts(sessionId, outputDir, outputPath) {
  const tablePath = path.join(outputDir, "alignment_table.json");
  const table = JSON.parse(fs.readFileSync(tablePath, "utf-8"));
  const citations = buildCitations(table);
  const fileBuffer = fs.readFileSync(outputPath);

  fileCache.set(sessionId, {
    buffer: fileBuffer,
    expires: Date.now() + 10 * 60 * 1000,
  });

  try {
    fs.unlinkSync(outputPath);
  } catch (error) {
    // Ignore temp output cleanup failures.
  }

  return {
    citations,
    downloadUrl: `/api/download?id=${sessionId}`,
  };
}

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", version: "2.1-web" });
});

app.post(
  "/api/process",
  upload.fields([
    { name: "referenceDoc", maxCount: 1 },
    { name: "targetDoc", maxCount: 1 },
  ]),
  async (req, res) => {
    const referenceFile = req.files?.referenceDoc?.[0];
    const targetFile = req.files?.targetDoc?.[0];
    const citationStyle = req.body?.citationStyle || "GB/T 7714";

    if (!referenceFile) {
      res.status(400).json({ error: "referenceDoc is required" });
      return;
    }

    const sessionId = createSessionId();
    const outputDir = path.join(jobsRootDir, sessionId);
    const outputPath = path.join(outputDir, "result.docx");
    fs.mkdirSync(outputDir, { recursive: true });

    const pythonProcess = spawnPipeline({
      englishPath: referenceFile.path,
      chinesePath: targetFile?.path,
      outputPath,
      outputDir,
      citationStyle,
    });

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      cleanupUploadedFiles([referenceFile, targetFile]);

      if (code !== 0) {
        res.status(500).json({ error: stderr || stdout || "Processing failed" });
        return;
      }

      try {
        const artifacts = readJobArtifacts(sessionId, outputDir, outputPath);
        const logs = stdout
          .split("\n")
          .filter((line) => line.trim())
          .map((line, index) => ({
            id: `log-${index}`,
            timestamp: new Date().toISOString(),
            level: line.includes("[ERROR]") ? "ERROR" : "INFO",
            module: "Python",
            message: line,
          }));

        res.json({
          citations: artifacts.citations,
          logs,
          outputPath: artifacts.downloadUrl,
          downloadUrl: artifacts.downloadUrl,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  },
);

app.post(
  "/api/process-stream",
  upload.fields([
    { name: "referenceDoc", maxCount: 1 },
    { name: "targetDoc", maxCount: 1 },
  ]),
  (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const sendEvent = (type, data) => {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const referenceFile = req.files?.referenceDoc?.[0];
    const targetFile = req.files?.targetDoc?.[0];
    const citationStyle = req.body?.citationStyle || "GB/T 7714";

    if (!referenceFile) {
      sendEvent("error", { message: "referenceDoc is required" });
      res.end();
      return;
    }

    const sessionId = createSessionId();
    const outputDir = path.join(jobsRootDir, sessionId);
    const outputPath = path.join(outputDir, "result.docx");
    fs.mkdirSync(outputDir, { recursive: true });

    const pythonProcess = spawnPipeline({
      englishPath: referenceFile.path,
      chinesePath: targetFile?.path,
      outputPath,
      outputDir,
      citationStyle,
    });

    pythonProcess.stdout.on("data", (data) => {
      for (const line of data.toString().split("\n")) {
        if (line.trim()) {
          sendEvent("log", { message: line.trim() });
        }
      }
    });

    pythonProcess.stderr.on("data", (data) => {
      for (const line of data.toString().split("\n")) {
        if (line.trim()) {
          sendEvent("log", { message: line.trim(), level: "ERROR" });
        }
      }
    });

    pythonProcess.on("close", (code) => {
      cleanupUploadedFiles([referenceFile, targetFile]);

      if (code !== 0) {
        sendEvent("error", { message: `Python process exited with code ${code}` });
        res.end();
        return;
      }

      try {
        const artifacts = readJobArtifacts(sessionId, outputDir, outputPath);
        sendEvent("done", {
          citations: artifacts.citations,
          outputPath: artifacts.downloadUrl,
          downloadUrl: artifacts.downloadUrl,
          mode: targetFile ? "existing_translation" : "auto_translation",
        });
      } catch (error) {
        sendEvent("error", { message: error.message });
      }

      res.end();
    });

    req.on("close", () => {
      if (!pythonProcess.killed) {
        pythonProcess.kill();
      }
    });
  },
);

app.get("/api/download", (req, res) => {
  const sessionId = req.query.id;

  if (!sessionId) {
    res.status(400).json({ error: "Missing session ID." });
    return;
  }

  const cached = fileCache.get(sessionId);
  if (!cached) {
    res.status(404).json({ error: "File expired or was not found." });
    return;
  }

  res.setHeader("Content-Disposition", 'attachment; filename="result.docx"');
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader("Content-Length", cached.buffer.length);
  res.end(cached.buffer);
});

const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Web server on port ${PORT}`);
});
