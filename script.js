const sourceInput = document.getElementById("sourceInput");
const referenceInput = document.getElementById("referenceInput");
const sourcePreview = document.getElementById("sourcePreview");
const referencePreview = document.getElementById("referencePreview");
const sourceHint = document.getElementById("sourceHint");
const referenceHint = document.getElementById("referenceHint");
const resultHint = document.getElementById("resultHint");
const resultCanvas = document.getElementById("resultCanvas");
const resultImage = document.getElementById("resultImage");
const saveTip = document.getElementById("saveTip");
const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const downloadBtn = document.getElementById("downloadBtn");

let sourceImage = null;
let referenceImage = null;
let hasResult = false;
let resultBlob = null;
let resultObjectUrl = "";

sourceInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    sourceImage = await fileToImage(file);
    showPreview(sourceImage, sourcePreview, sourceHint);
    clearResult();
    setStatus("");
  } catch (error) {
    setStatus("原图读取失败，请换一张图片重试");
  }
});

referenceInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    referenceImage = await fileToImage(file);
    showPreview(referenceImage, referencePreview, referenceHint);
    clearResult();
    setStatus("");
  } catch (error) {
    setStatus("参考图读取失败，请换一张图片重试");
  }
});

startBtn.addEventListener("click", async () => {
  if (!sourceImage || !referenceImage) {
    setStatus("请先上传原图和参考图");
    return;
  }

  setLoading(true);
  setStatus("正在调色中...");

  await waitForPaint();

  try {
    applyColorStyle(sourceImage, referenceImage, resultCanvas);
    resultBlob = await canvasToPngBlob(resultCanvas);
    updateResultImageFromBlob(resultBlob);
    resultCanvas.style.display = "block";
    resultImage.style.display = "none";
    resultHint.style.display = "none";
    saveTip.style.display = "none";
    saveTip.textContent = "";
    hasResult = true;
    downloadBtn.disabled = false;
    setStatus("调色完成");
  } catch (error) {
    setStatus("调色失败，请更换图片后重试");
  } finally {
    setLoading(false);
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!hasResult) return;
  try {
    const blob = resultBlob || (await canvasToPngBlob(resultCanvas));
    resultBlob = blob;

    const shared = await tryShareImage(blob);
    if (shared) {
      setStatus("已打开分享面板，可保存到相册");
      return;
    }

    showLongPressSaveGuide(blob);
    downloadByAnchor(blob);
  } catch (error) {
    setStatus("下载失败，请重试");
  }
});

function setStatus(text) {
  statusText.textContent = text;
}

function setLoading(loading) {
  startBtn.disabled = loading;
  sourceInput.disabled = loading;
  referenceInput.disabled = loading;
}

function clearResult() {
  const ctx = resultCanvas.getContext("2d");
  ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultCanvas.style.display = "none";
  resultImage.style.display = "none";
  resultHint.style.display = "block";
  saveTip.style.display = "none";
  saveTip.textContent = "";
  downloadBtn.disabled = true;
  hasResult = false;
  resultBlob = null;
  if (resultObjectUrl) {
    URL.revokeObjectURL(resultObjectUrl);
    resultObjectUrl = "";
  }
}

function showPreview(image, imgEl, hintEl) {
  imgEl.src = image.src;
  imgEl.style.display = "block";
  hintEl.style.display = "none";
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("png blob create failed"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function tryShareImage(blob) {
  if (!navigator.share || typeof navigator.canShare !== "function") {
    return false;
  }

  const file = new File([blob], "color-result.png", { type: "image/png" });
  const shareData = {
    files: [file],
    title: "调色结果",
    text: "AI 图片风格调色工具结果图",
  };

  if (!navigator.canShare(shareData)) {
    return false;
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch (error) {
    return false;
  }
}

function updateResultImageFromBlob(blob) {
  if (resultObjectUrl) {
    URL.revokeObjectURL(resultObjectUrl);
  }
  resultObjectUrl = URL.createObjectURL(blob);
  resultImage.src = resultObjectUrl;
}

function showLongPressSaveGuide(blob) {
  if (!resultObjectUrl) {
    updateResultImageFromBlob(blob);
  }
  resultCanvas.style.display = "none";
  resultImage.style.display = "block";
  resultHint.style.display = "none";
  saveTip.textContent = "请长按图片，选择保存到相册。";
  saveTip.style.display = "block";
  setStatus("当前浏览器无法直接分享文件，已切换为长按保存模式");
}

function downloadByAnchor(blob) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.download = "color-result.png";
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function applyColorStyle(sourceImg, referenceImg, outputCanvas) {
  const maxEdge = 1600;
  const sourceSize = fitSize(sourceImg.width, sourceImg.height, maxEdge);
  outputCanvas.width = sourceSize.width;
  outputCanvas.height = sourceSize.height;

  const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
  outputCtx.drawImage(sourceImg, 0, 0, sourceSize.width, sourceSize.height);
  const sourceImageData = outputCtx.getImageData(0, 0, sourceSize.width, sourceSize.height);

  const refCanvas = document.createElement("canvas");
  const refSize = fitSize(referenceImg.width, referenceImg.height, 720);
  refCanvas.width = refSize.width;
  refCanvas.height = refSize.height;
  const refCtx = refCanvas.getContext("2d", { willReadFrequently: true });
  refCtx.drawImage(referenceImg, 0, 0, refSize.width, refSize.height);
  const refImageData = refCtx.getImageData(0, 0, refSize.width, refSize.height);

  const sourceStats = getImageStats(sourceImageData.data);
  const refStats = getImageStats(refImageData.data);

  const brightnessDelta = clamp(refStats.luminanceMean - sourceStats.luminanceMean, -28, 28);
  const contrastScale = clamp(
    (refStats.luminanceStd + 1) / (sourceStats.luminanceStd + 1),
    0.82,
    1.24
  );
  const saturationScale = clamp(
    (refStats.saturationMean + 0.0001) / (sourceStats.saturationMean + 0.0001),
    0.78,
    1.35
  );
  const channelScale = {
    r: clamp((refStats.mean.r + 1) / (sourceStats.mean.r + 1), 0.82, 1.22),
    g: clamp((refStats.mean.g + 1) / (sourceStats.mean.g + 1), 0.82, 1.22),
    b: clamp((refStats.mean.b + 1) / (sourceStats.mean.b + 1), 0.82, 1.22),
  };

  const pixels = sourceImageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a === 0) continue;

    r = (r - sourceStats.luminanceMean) * contrastScale + sourceStats.luminanceMean + brightnessDelta;
    g = (g - sourceStats.luminanceMean) * contrastScale + sourceStats.luminanceMean + brightnessDelta;
    b = (b - sourceStats.luminanceMean) * contrastScale + sourceStats.luminanceMean + brightnessDelta;

    r *= channelScale.r;
    g *= channelScale.g;
    b *= channelScale.b;

    const hsl = rgbToHsl(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
    hsl.s = clamp(hsl.s * saturationScale, 0, 1);
    hsl.l = clamp(hsl.l, 0.03, 0.97);

    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);

    pixels[i] = clamp(rgb.r, 0, 255);
    pixels[i + 1] = clamp(rgb.g, 0, 255);
    pixels[i + 2] = clamp(rgb.b, 0, 255);
  }

  outputCtx.putImageData(sourceImageData, 0, 0);
}

function getImageStats(pixels) {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumLum = 0;
  let sumLumSq = 0;
  let sumSat = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha === 0) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;

    sumR += r;
    sumG += g;
    sumB += b;
    sumLum += lum;
    sumLumSq += lum * lum;
    sumSat += sat;
    count += 1;
  }

  if (count === 0) {
    return {
      mean: { r: 127, g: 127, b: 127 },
      luminanceMean: 127,
      luminanceStd: 30,
      saturationMean: 0.4,
    };
  }

  const meanLum = sumLum / count;
  const variance = Math.max(0, sumLumSq / count - meanLum * meanLum);

  return {
    mean: {
      r: sumR / count,
      g: sumG / count,
      b: sumB / count,
    },
    luminanceMean: meanLum,
    luminanceStd: Math.sqrt(variance),
    saturationMean: sumSat / count,
  };
}

function fitSize(width, height, maxEdge) {
  if (width <= maxEdge && height <= maxEdge) {
    return { width, height };
  }
  const scale = Math.min(maxEdge / width, maxEdge / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (h >= 0 && h < 60) {
    rn = c;
    gn = x;
  } else if (h >= 60 && h < 120) {
    rn = x;
    gn = c;
  } else if (h >= 120 && h < 180) {
    gn = c;
    bn = x;
  } else if (h >= 180 && h < 240) {
    gn = x;
    bn = c;
  } else if (h >= 240 && h < 300) {
    rn = x;
    bn = c;
  } else {
    rn = c;
    bn = x;
  }

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
}
