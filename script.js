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
const skinProtectRange = document.getElementById("skinProtectRange");
const faceLightRange = document.getElementById("faceLightRange");
const skinProtectValue = document.getElementById("skinProtectValue");
const faceLightValue = document.getElementById("faceLightValue");
const softProtectToggle = document.getElementById("softProtectToggle");
const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const downloadBtn = document.getElementById("downloadBtn");

let sourceImage = null;
let referenceImage = null;
let hasResult = false;
let resultBlob = null;
let resultObjectUrl = "";

bindRangeLabels();

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
    applyColorStyle(sourceImage, referenceImage, resultCanvas, {
      skinProtect: Number(skinProtectRange.value) / 100,
      faceLight: Number(faceLightRange.value) / 100,
      softProtect: softProtectToggle.checked,
    });
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

function bindRangeLabels() {
  const sync = () => {
    skinProtectValue.textContent = skinProtectRange.value;
    faceLightValue.textContent = faceLightRange.value;
  };
  skinProtectRange.addEventListener("input", sync);
  faceLightRange.addEventListener("input", sync);
  sync();
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

function applyColorStyle(sourceImg, referenceImg, outputCanvas, userOptions) {
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
  const options = {
    skinProtect: clamp(userOptions.skinProtect, 0, 1),
    faceLight: clamp(userOptions.faceLight, 0, 1),
    softProtect: Boolean(userOptions.softProtect),
  };

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
  const width = sourceSize.width;
  const height = sourceSize.height;
  const pixelCount = width * height;
  const normalRgb = new Float32Array(pixelCount * 3);
  const finalRgb = new Float32Array(pixelCount * 3);

  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
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
    const styled = hslToRgb(hsl.h, hsl.s, hsl.l);

    const idx3 = p * 3;
    normalRgb[idx3] = styled.r;
    normalRgb[idx3 + 1] = styled.g;
    normalRgb[idx3 + 2] = styled.b;
    finalRgb[idx3] = styled.r;
    finalRgb[idx3 + 1] = styled.g;
    finalRgb[idx3 + 2] = styled.b;
  }

  if (options.softProtect) {
    const mask = createSoftSkinMask(pixels, width, height, options);
    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      if (pixels[i + 3] === 0) continue;
      const idx3 = p * 3;
      const normal = {
        r: normalRgb[idx3],
        g: normalRgb[idx3 + 1],
        b: normalRgb[idx3 + 2],
      };
      const original = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
      const protectedPixel = createSkinProtectedPixel(original, normal, mask[p], options);
      const mixed = blendRgb(normal, protectedPixel, mask[p]);
      finalRgb[idx3] = mixed.r;
      finalRgb[idx3 + 1] = mixed.g;
      finalRgb[idx3 + 2] = mixed.b;
    }
    smoothProtectedLuminance(finalRgb, mask, width, height);
  }

  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    const idx3 = p * 3;
    pixels[i] = clamp(Math.round(finalRgb[idx3]), 0, 255);
    pixels[i + 1] = clamp(Math.round(finalRgb[idx3 + 1]), 0, 255);
    pixels[i + 2] = clamp(Math.round(finalRgb[idx3 + 2]), 0, 255);
  }

  outputCtx.putImageData(sourceImageData, 0, 0);
}

function createSoftSkinMask(pixels, width, height, options) {
  const seed = new Float32Array(width * height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    if (pixels[i + 3] === 0) continue;
    seed[p] = skinSeedStrength(pixels[i], pixels[i + 1], pixels[i + 2], options.skinProtect);
  }

  const centerWeight = createPortraitCenterWeight(seed, width, height, options.skinProtect);
  for (let i = 0; i < seed.length; i += 1) {
    // Keep weak peripheral detections from dominating mask.
    seed[i] = clamp(seed[i] * centerWeight[i], 0, 1);
  }

  let mask = seed;
  for (let pass = 0; pass < 3; pass += 1) {
    mask = boxBlurFloatMap(mask, width, height, 2);
  }
  for (let i = 0; i < mask.length; i += 1) {
    // Restore center emphasis after blur while keeping soft transition.
    mask[i] = clamp(mask[i] * (0.84 + centerWeight[i] * 0.16), 0, 1);
  }
  return mask;
}

function createPortraitCenterWeight(seed, width, height, protectLevel) {
  const count = seed.length;
  const weight = new Float32Array(count);
  weight.fill(1);

  let sum = 0;
  let sumX = 0;
  let sumY = 0;
  let valid = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const s = seed[idx];
      if (s < 0.45) continue;
      sum += s;
      sumX += x * s;
      sumY += y * s;
      valid += 1;
    }
  }

  if (sum <= 0 || valid < Math.max(80, Math.floor(count * 0.0015))) {
    return weight;
  }

  const cx = sumX / sum;
  const cy = sumY / sum;
  let varX = 0;
  let varY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const s = seed[idx];
      if (s < 0.45) continue;
      varX += (x - cx) * (x - cx) * s;
      varY += (y - cy) * (y - cy) * s;
    }
  }

  const sigmaX = Math.sqrt(varX / sum) + width * 0.03;
  const sigmaY = Math.sqrt(varY / sum) + height * 0.03;
  const gain = 0.34 + protectLevel * 0.24;
  const floor = 0.4 + protectLevel * 0.1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const dx = (x - cx) / Math.max(1, sigmaX * 1.8);
      const dy = (y - cy) / Math.max(1, sigmaY * 1.8);
      const dist2 = dx * dx + dy * dy;
      const radial = Math.exp(-dist2);
      const localSeed = seed[idx];
      const localBoost = clamp(0.78 + localSeed * 0.35, 0.78, 1.12);
      weight[idx] = clamp((floor + radial * gain) * localBoost, 0.32, 1.18);
    }
  }

  return weight;
}

function skinSeedStrength(r, g, b, protectLevel) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const hsl = rgbToHsl(r, g, b);
  const hueOk = hsl.h <= 50 || hsl.h >= 330;

  const rgbCore = r > 95 && g > 40 && b > 20 && r > g && r > b && chroma > 15;
  const ycbcrCore = cb >= 80 && cb <= 126 && cr >= 134 && cr <= 172;
  const satOk = hsl.s >= 0.1 && hsl.s <= 0.58;
  const lumOk = hsl.l >= 0.18 && hsl.l <= 0.82 && y >= 55 && y <= 225;

  if (!rgbCore || !ycbcrCore || !hueOk || !satOk || !lumOk) return 0;
  if (hsl.s > 0.52 || (r - g > 95 && hsl.s > 0.4) || y < 52) return 0;

  let strength = 0.5;
  if (cr > 139 && cr < 165) strength += 0.14;
  if (cb > 86 && cb < 122) strength += 0.12;
  if (hsl.h <= 35 || hsl.h >= 345) strength += 0.1;
  if (hsl.l > 0.26 && hsl.l < 0.74) strength += 0.08;
  if (chroma < 95) strength += 0.08;
  strength += protectLevel * 0.06;

  return clamp(strength, 0, 1);
}

function createSkinProtectedPixel(original, normal, maskStrength, options) {
  const protectStrength = clamp(0.35 + options.skinProtect * 0.2, 0.35, 0.55);
  const styleStrength = clamp(0.95 - maskStrength * (0.95 - protectStrength), 0.35, 0.95);
  let mixed = blendRgb(original, normal, styleStrength);

  const lightInfo = getLuminanceAndShadow(mixed.r, mixed.g, mixed.b);
  const maxLift = 0.12 + options.faceLight * 0.03;
  const shadowLift = (0.05 + options.faceLight * 0.07) * lightInfo.shadowFactor;
  const midLift = (0.015 + options.faceLight * 0.03) * (1 - Math.abs(lightInfo.lNorm - 0.5) * 2);
  const highlightSuppress = 1 - lightInfo.highlightFactor * 0.95;
  let lightGain = (shadowLift + midLift) * highlightSuppress * maskStrength;

  if (lightInfo.lNorm > 0.8) lightGain *= 0.2;
  else if (lightInfo.lNorm > 0.7) lightGain *= 0.45;
  lightGain = clamp(lightGain, 0, maxLift);

  let hsl = rgbToHsl(mixed.r, mixed.g, mixed.b);
  hsl.l = clamp(hsl.l + lightGain, 0.02, 0.95);
  hsl.s = clamp(hsl.s * (0.985 - 0.06 * maskStrength), 0.08, 0.6);
  mixed = hslToRgb(hsl.h, hsl.s, hsl.l);

  const cleanBoost = maskStrength * (0.01 + options.skinProtect * 0.02);
  mixed.r += 255 * cleanBoost * 0.45;
  mixed.g += 255 * cleanBoost * 0.26;
  mixed.b += 255 * cleanBoost * 0.5;
  mixed.g -= 255 * cleanBoost * 0.08;

  const peak = Math.max(mixed.r, mixed.g, mixed.b);
  if (peak > 248) {
    const reduce = peak - 248;
    mixed.r -= reduce * 0.72;
    mixed.g -= reduce * 0.8;
    mixed.b -= reduce * 0.86;
  }

  return {
    r: clamp(mixed.r, 0, 255),
    g: clamp(mixed.g, 0, 255),
    b: clamp(mixed.b, 0, 255),
  };
}

function smoothProtectedLuminance(rgbArray, mask, width, height) {
  const count = width * height;
  const lum = new Float32Array(count);
  for (let p = 0; p < count; p += 1) {
    const idx3 = p * 3;
    lum[p] = 0.2126 * rgbArray[idx3] + 0.7152 * rgbArray[idx3 + 1] + 0.0722 * rgbArray[idx3 + 2];
  }

  const blurredLum = boxBlurFloatMap(lum, width, height, 1);
  for (let p = 0; p < count; p += 1) {
    const m = mask[p];
    if (m < 0.25) continue;
    const idx3 = p * 3;
    const currentLum = lum[p];
    const delta = (blurredLum[p] - currentLum) * m * 0.22;
    if (Math.abs(delta) < 0.2) continue;
    const scale = clamp((currentLum + delta) / Math.max(1, currentLum), 0.9, 1.1);
    rgbArray[idx3] = clamp(rgbArray[idx3] * scale, 0, 255);
    rgbArray[idx3 + 1] = clamp(rgbArray[idx3 + 1] * scale, 0, 255);
    rgbArray[idx3 + 2] = clamp(rgbArray[idx3 + 2] * scale, 0, 255);
  }
}

function boxBlurFloatMap(input, width, height, radius) {
  const temp = new Float32Array(input.length);
  const output = new Float32Array(input.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const nx = x + k;
        if (nx < 0 || nx >= width) continue;
        sum += input[y * width + nx];
        count += 1;
      }
      temp[y * width + x] = count === 0 ? 0 : sum / count;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const ny = y + k;
        if (ny < 0 || ny >= height) continue;
        sum += temp[ny * width + x];
        count += 1;
      }
      output[y * width + x] = count === 0 ? 0 : sum / count;
    }
  }

  return output;
}

function blendRgb(base, target, strength) {
  const t = clamp(strength, 0, 1);
  return {
    r: base.r + (target.r - base.r) * t,
    g: base.g + (target.g - base.g) * t,
    b: base.b + (target.b - base.b) * t,
  };
}

function getLuminanceAndShadow(r, g, b) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const lNorm = lum / 255;
  return {
    lNorm,
    shadowFactor: clamp((0.5 - lNorm) / 0.5, 0, 1),
    highlightFactor: clamp((lNorm - 0.62) / 0.38, 0, 1),
  };
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
