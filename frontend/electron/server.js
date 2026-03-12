import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ── 内存文件缓存：处理完成后将docx读入内存，避免下载时找不到文件 ──
// key: sessionId, value: { buffer: Buffer, expires: number }
const fileCache = new Map();
// 每15分钟清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of fileCache.entries()) {
    if (val.expires < now) fileCache.delete(key);
  }
}, 15 * 60 * 1000);

// 使用绝对路径存放上传文件，避免cwd不同导致路径解析错误
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// 配置multer保留文件扩展名
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    // 保留原始文件扩展名
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

// 状态检查
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', version: '2.0' });
});

// 处理接口
app.post('/api/process', upload.fields([
  { name: 'referenceDoc', maxCount: 1 },
  { name: 'targetDoc', maxCount: 1 }
]), async (req, res) => {
  try {
    const refFile = req.files['referenceDoc'][0];
    const targetFile = req.files['targetDoc'][0];

    const pythonScript = path.join(__dirname, '../../scripts/run_full_pipeline.py');
    const outputPath = path.join(__dirname, '../../outputs/result.docx');
    const projectRoot = path.join(__dirname, '../..');

    const pythonProcess = spawn('python', [
      pythonScript,
      '--english', refFile.path,
      '--chinese', targetFile.path,
      '--output', outputPath
    ], {
      cwd: projectRoot,  // 确保Python在项目根目录运行，outputs/等相对路径正确
      env: {
        ...process.env,
        HTTP_PROXY: '',
        HTTPS_PROXY: '',
        http_proxy: '',
        https_proxy: '',
        NO_PROXY: '*'
      }
    });

    let stdout = '';
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('Python:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      fs.unlinkSync(refFile.path);
      fs.unlinkSync(targetFile.path);

      if (code !== 0) {
        return res.status(500).json({ error: 'Processing failed' });
      }

      // 读取对照表
      const tablePath = path.join(__dirname, '../../outputs/alignment_table.json');
      const table = JSON.parse(fs.readFileSync(tablePath, 'utf-8'));

      // 转换为前端格式
      const citations = table.map(entry => ({
        id: entry.footnote_id,
        anchorNumber: parseInt(entry.footnote_id),
        originalContext: entry.english_sentence,
        originalFootnote: entry.english_footnote,
        targetSentence: entry.chinese_sentence,
        translatedFootnote: entry.chinese_footnote,
        confidence: entry.confidence,
        status: 'pending',
        isOrphaned: false
      }));

      const logs = stdout.split('\n').filter(l => l.trim()).map((line, i) => ({
        id: `log-${i}`,
        timestamp: new Date().toISOString(),
        level: line.includes('[ERROR]') ? 'ERROR' : 'INFO',
        module: 'Python',
        message: line
      }));

      res.json({ citations, logs, outputPath });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 流式处理接口（SSE）- 实时推送Python日志
app.post('/api/process-stream', upload.fields([
  { name: 'referenceDoc', maxCount: 1 },
  { name: 'targetDoc', maxCount: 1 }
]), (req, res) => {
  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let refFile, targetFile;
  try {
    refFile = req.files['referenceDoc'][0];
    targetFile = req.files['targetDoc'][0];
  } catch (e) {
    sendEvent('error', { message: '文件上传失败: ' + e.message });
    res.end();
    return;
  }

  // 每次请求使用唯一文件名，避免多用户冲突
  const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const pythonScript = path.join(__dirname, '../../scripts/run_full_pipeline.py');
  const outputPath = path.join(__dirname, `../../outputs/result-${sessionId}.docx`);
  const projectRoot = path.join(__dirname, '../..');

  const pythonProcess = spawn('python', [
    '-u',  // 禁用Python输出缓冲，确保实时输出
    pythonScript,
    '--english', refFile.path,
    '--chinese', targetFile.path,
    '--output', outputPath
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      http_proxy: '',
      https_proxy: '',
      NO_PROXY: '*',
      PYTHONUNBUFFERED: '1'  // 再次确保Python不缓冲
    }
  });

  pythonProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        sendEvent('log', { message: line.trim() });
      }
    });
  });

  pythonProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        sendEvent('log', { message: line.trim(), level: 'ERROR' });
      }
    });
  });

  pythonProcess.on('close', (code) => {
    // 清理上传文件
    try { fs.unlinkSync(refFile.path); } catch (e) {}
    try { fs.unlinkSync(targetFile.path); } catch (e) {}

    if (code !== 0) {
      sendEvent('error', { message: `Python进程退出，代码: ${code}` });
      res.end();
      return;
    }

    try {
      const tablePath = path.join(__dirname, '../../outputs/alignment_table.json');
      const table = JSON.parse(fs.readFileSync(tablePath, 'utf-8'));

      const citations = table.map(entry => ({
        id: entry.footnote_id,
        anchorNumber: parseInt(entry.footnote_id),
        originalContext: entry.english_sentence,
        originalFootnote: entry.english_footnote,
        targetSentence: entry.chinese_sentence,
        translatedFootnote: entry.chinese_footnote,
        confidence: entry.confidence,
        status: 'pending',
        isOrphaned: false
      }));

      // 将docx文件读入内存缓存（10分钟有效），避免下载时磁盘访问失败
      const fileBuffer = fs.readFileSync(outputPath);
      fileCache.set(sessionId, { buffer: fileBuffer, expires: Date.now() + 10 * 60 * 1000 });
      // 从磁盘删除临时文件
      try { fs.unlinkSync(outputPath); } catch (e) {}

      // 返回带 sessionId 的下载URL，前端可直接触发浏览器下载
      const downloadUrl = `/api/download?id=${sessionId}`;
      sendEvent('done', { citations, outputPath: downloadUrl, downloadUrl });
    } catch (e) {
      sendEvent('error', { message: '读取结果失败: ' + e.message });
    }
    res.end();
  });

  // 客户端断开时杀掉Python进程
  req.on('close', () => {
    pythonProcess.kill();
  });
});

// 下载接口 - 从内存缓存中提供文件，不依赖磁盘
app.get('/api/download', (req, res) => {
  const sessionId = req.query.id;

  if (!sessionId) {
    return res.status(400).json({ error: '缺少 session ID，请重新处理文档。' });
  }

  const cached = fileCache.get(sessionId);
  if (!cached) {
    return res.status(404).json({ error: '文件不存在或已过期（10分钟），请重新处理文档。' });
  }

  // 明确设置下载响应头，确保浏览器识别为文件下载
  res.setHeader('Content-Disposition', 'attachment; filename="result.docx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Length', cached.buffer.length);
  res.end(cached.buffer);
});

// 生产环境：serve 前端构建产物
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log(`Express server on port ${PORT}`));
