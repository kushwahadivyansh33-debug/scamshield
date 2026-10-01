"use strict";

const form = document.querySelector("#analyzer-form");
const messageInput = document.querySelector("#message-input");
const formError = document.querySelector("#form-error");
const characterCount = document.querySelector("#character-count");
const resultPanel = document.querySelector("#result-panel");
const exampleButton = document.querySelector("#example-button");
const checkAnotherButton = document.querySelector("#check-another");
const themeToggle = document.querySelector("#theme-toggle");
const themeLabel = document.querySelector("#theme-label");
const screenshotInput = document.querySelector("#screenshot-input");
const screenshotDropzone = document.querySelector("#screenshot-dropzone");
const screenshotPreview = document.querySelector("#screenshot-preview");
const screenshotImage = document.querySelector("#screenshot-image");
const screenshotFilename = document.querySelector("#screenshot-filename");
const screenshotProgress = document.querySelector("#screenshot-progress");
const screenshotProgressBar = document.querySelector("#screenshot-progress-bar");
const screenshotStatus = document.querySelector("#screenshot-status");
const removeScreenshotButton = document.querySelector("#remove-screenshot");
const voiceInput = document.querySelector("#voice-input");
const voiceDropzone = document.querySelector("#voice-dropzone");
const voicePreview = document.querySelector("#voice-preview");
const voiceAudioPreview = document.querySelector("#voice-audio-preview");
const voiceFilename = document.querySelector("#voice-filename");
const voiceProgress = document.querySelector("#voice-progress");
const voiceProgressBar = document.querySelector("#voice-progress-bar");
const voiceStatus = document.querySelector("#voice-status");
const removeVoiceButton = document.querySelector("#remove-voice");
const maximumScreenshotSize = 10 * 1024 * 1024;
const maximumExtractedTextLength = 10000;
const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"]);
const maximumVoiceSize = 25 * 1024 * 1024;
const maximumVoiceDuration = 5 * 60;
const voiceSampleRate = 16000;
const supportedAudioTypes = new Set([
  "audio/aac", "audio/aiff", "audio/flac", "audio/mp3", "audio/mp4", "audio/m4a",
  "audio/mpeg", "audio/ogg", "audio/opus", "audio/wav", "audio/wave",
  "audio/webm", "audio/x-aac", "audio/x-aiff", "audio/x-flac", "audio/x-m4a",
  "audio/x-wav", "audio/vnd.wave",
]);
let screenshotObjectUrl = null;
let screenshotRequest = 0;
let tesseractLoadPromise = null;
let voiceObjectUrl = null;
let voiceRequest = 0;
let voiceTranscriberPromise = null;
let audioContextConstructor = null;

function getSavedTheme() {
  try {
    return localStorage.getItem("scamshield-theme");
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") return null;
    throw error;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem("scamshield-theme", theme);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "SecurityError")) throw error;
  }
}

function setTheme(theme, persist = false) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeLabel.textContent = isDark ? "Light" : "Dark";
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  themeToggle.setAttribute("aria-pressed", String(isDark));
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#171c19" : "#f7f8f4";
  if (persist) saveTheme(isDark ? "dark" : "light");
}

const savedTheme = getSavedTheme();
setTheme(
  savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
);

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
});

function setScreenshotStatus(message, state = "") {
  screenshotStatus.textContent = message;
  if (state) screenshotStatus.dataset.state = state;
  else delete screenshotStatus.dataset.state;
}

function clearScreenshot() {
  screenshotRequest += 1;
  if (screenshotObjectUrl) URL.revokeObjectURL(screenshotObjectUrl);
  screenshotObjectUrl = null;
  screenshotInput.value = "";
  screenshotImage.removeAttribute("src");
  screenshotFilename.textContent = "";
  screenshotProgress.textContent = "Ready to extract text";
  screenshotProgressBar.hidden = true;
  screenshotProgressBar.value = 0;
  screenshotPreview.hidden = true;
  screenshotDropzone.hidden = false;
  setScreenshotStatus("");
}

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoadPromise) return tesseractLoadPromise;

  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error("The OCR engine loaded but could not be started."));
    };
    script.onerror = () => reject(new Error("The OCR engine could not be downloaded. Check your connection and try again."));
    document.head.append(script);
  }).catch((error) => {
    tesseractLoadPromise = null;
    throw error;
  });
  return tesseractLoadPromise;
}

async function analyzeScreenshot(file) {
  const request = ++screenshotRequest;
  resultPanel.hidden = true;
  if (screenshotObjectUrl) URL.revokeObjectURL(screenshotObjectUrl);
  screenshotObjectUrl = null;
  screenshotImage.removeAttribute("src");
  screenshotPreview.hidden = true;
  screenshotDropzone.hidden = false;
  screenshotProgressBar.hidden = true;
  screenshotProgressBar.value = 0;
  setScreenshotStatus("");

  if (!supportedImageTypes.has(file.type)) {
    setScreenshotStatus("Please choose a PNG, JPG, WEBP, GIF, or BMP screenshot.", "error");
    screenshotInput.value = "";
    return;
  }
  if (file.size > maximumScreenshotSize) {
    setScreenshotStatus("This image is larger than 10 MB. Choose a smaller screenshot.", "error");
    screenshotInput.value = "";
    return;
  }
  if (file.size === 0) {
    setScreenshotStatus("This image file is empty. Choose another screenshot.", "error");
    screenshotInput.value = "";
    return;
  }

  if (screenshotObjectUrl) URL.revokeObjectURL(screenshotObjectUrl);
  screenshotObjectUrl = URL.createObjectURL(file);
  screenshotImage.src = screenshotObjectUrl;
  screenshotFilename.textContent = file.name || "Screenshot";
  screenshotDropzone.hidden = true;
  screenshotPreview.hidden = false;
  screenshotProgressBar.value = 0;
  screenshotProgressBar.hidden = false;
  screenshotProgress.textContent = "Loading the on-device OCR engine…";
  setScreenshotStatus("Preparing private, on-device text extraction. The OCR engine is downloaded only when you first use screenshot scanning.", "working");

  let worker = null;
  try {
    const tesseract = await loadTesseract();
    if (request !== screenshotRequest) return;
    worker = await tesseract.createWorker("eng", 1, {
      logger: (progress) => {
        if (request !== screenshotRequest) return;
        if (progress.status) screenshotProgress.textContent = progress.status;
        if (typeof progress.progress === "number") screenshotProgressBar.value = progress.progress;
      },
      workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
    });
    if (request !== screenshotRequest) return;
    screenshotProgress.textContent = "Reading screenshot…";
    const { data } = await worker.recognize(file);
    if (request !== screenshotRequest) return;

    const extractedText = data.text.trim();
    if (!extractedText) {
      screenshotProgressBar.hidden = true;
      screenshotProgress.textContent = "No text found";
      setScreenshotStatus("We couldn’t read text in this image. Try a clearer screenshot with larger, sharper text.", "error");
      return;
    }

    messageInput.value = extractedText.slice(0, maximumExtractedTextLength);
    messageInput.dispatchEvent(new Event("input", { bubbles: true }));
    screenshotProgressBar.value = 1;
    screenshotProgress.textContent = "Text extracted";
    const wasTruncated = extractedText.length > maximumExtractedTextLength;
    const notes = [];
    if (typeof data.confidence === "number" && data.confidence < 50) {
      notes.push(`OCR confidence is low (${Math.round(data.confidence)}%). Review the extracted text carefully.`);
    }
    if (wasTruncated) {
      notes.push("The first 10,000 characters were analyzed; some extracted text exceeded the analysis limit.");
    }
    setScreenshotStatus(
      notes.length
        ? notes.join(" ")
        : "Text extracted locally. Review it in the message box below; scam indicators are being checked.",
      notes.length ? "working" : "",
    );
    renderResult(messageInput.value);
  } catch (error) {
    if (request !== screenshotRequest) return;
    screenshotProgressBar.hidden = true;
    screenshotProgress.textContent = "Text extraction failed";
    setScreenshotStatus(
      error instanceof Error ? error.message : "The screenshot could not be processed. Choose another image and try again.",
      "error",
    );
  } finally {
    if (worker) await worker.terminate();
  }
}

screenshotInput.addEventListener("change", () => {
  const [file] = screenshotInput.files;
  if (file) void analyzeScreenshot(file);
});

screenshotDropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    screenshotInput.click();
  }
});

for (const eventName of ["dragenter", "dragover"]) {
  screenshotDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    screenshotDropzone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  screenshotDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    screenshotDropzone.classList.remove("is-dragging");
  });
}

screenshotDropzone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) void analyzeScreenshot(file);
});

removeScreenshotButton.addEventListener("click", clearScreenshot);

function setVoiceStatus(message, state = "") {
  voiceStatus.textContent = message;
  if (state) voiceStatus.dataset.state = state;
  else delete voiceStatus.dataset.state;
}

function clearVoiceRecording() {
  voiceRequest += 1;
  if (voiceObjectUrl) URL.revokeObjectURL(voiceObjectUrl);
  voiceObjectUrl = null;
  voiceInput.value = "";
  voiceAudioPreview.removeAttribute("src");
  voiceAudioPreview.load();
  voiceFilename.textContent = "";
  voiceProgress.textContent = "Ready to transcribe";
  voiceProgressBar.hidden = true;
  voiceProgressBar.value = 0;
  voicePreview.hidden = true;
  voiceDropzone.hidden = false;
  setVoiceStatus("");
}

function isSupportedAudio(file) {
  if (supportedAudioTypes.has(file.type)) return true;
  return /\.(?:aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav|webm)$/i.test(file.name);
}

function resampleAudio(audioBuffer, targetRate) {
  const sourceRate = audioBuffer.sampleRate;
  const targetLength = Math.ceil(audioBuffer.duration * targetRate);
  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  const output = new Float32Array(targetLength);

  for (let index = 0; index < targetLength; index += 1) {
    const sourcePosition = index * sourceRate / targetRate;
    const before = Math.floor(sourcePosition);
    const fraction = sourcePosition - before;
    let value = 0;
    for (const channel of channelData) {
      const firstSample = channel[Math.min(before, channel.length - 1)];
      const secondSample = channel[Math.min(before + 1, channel.length - 1)];
      value += firstSample + (secondSample - firstSample) * fraction;
    }
    output[index] = value / channelData.length;
  }

  return output;
}

function readVoiceDuration(audio) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    const cleanUp = () => {
      window.clearTimeout(timeoutId);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanUp();
      resolve(audio.duration);
    };
    const onError = () => {
      cleanUp();
      reject(new Error("This audio format could not be previewed. Try a WAV or MP3 recording."));
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    timeoutId = window.setTimeout(() => {
      cleanUp();
      reject(new Error("The recording duration could not be verified. Try a standard WAV, MP3, or M4A file."));
    }, 10000);
    audio.load();
    if (audio.readyState >= 1) onLoaded();
  });
}

async function loadVoiceTranscriber() {
  if (voiceTranscriberPromise) return voiceTranscriberPromise;

  voiceTranscriberPromise = (async () => {
    setVoiceStatus("Downloading the speech-recognition engine and English model. This can take a few minutes the first time.", "working");
    const { env, pipeline } = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js");
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.backends.onnx.wasm.numThreads = 1;
    return pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      revision: "79fb389fc764e7c395bd330e9531d9d32ada7049",
      quantized: true,
      progress_callback: (progress) => {
        if (!progress.status || voicePreview.hidden) return;
        const progressRatio = typeof progress.progress === "number"
          ? progress.progress > 1 ? progress.progress / 100 : progress.progress
          : null;
        const percent = progressRatio === null ? "" : ` (${Math.round(progressRatio * 100)}%)`;
        voiceProgress.textContent = `${progress.status}${percent}`;
        if (progressRatio !== null) voiceProgressBar.value = progressRatio;
      },
    });
  })().catch((error) => {
    voiceTranscriberPromise = null;
    throw error;
  });

  return voiceTranscriberPromise;
}

async function analyzeVoiceRecording(file) {
  const request = ++voiceRequest;
  resultPanel.hidden = true;
  if (voiceObjectUrl) URL.revokeObjectURL(voiceObjectUrl);
  voiceObjectUrl = null;
  voiceAudioPreview.removeAttribute("src");
  voicePreview.hidden = true;
  voiceDropzone.hidden = false;
  voiceProgressBar.hidden = true;
  voiceProgressBar.value = 0;
  setVoiceStatus("");

  if (!isSupportedAudio(file)) {
    setVoiceStatus("Please choose an audio recording, such as MP3, WAV, M4A, OGG, WEBM, or FLAC.", "error");
    voiceInput.value = "";
    return;
  }
  if (file.size > maximumVoiceSize) {
    setVoiceStatus("This recording is larger than 25 MB. Choose a smaller audio file.", "error");
    voiceInput.value = "";
    return;
  }
  if (file.size === 0) {
    setVoiceStatus("This audio file is empty. Choose another recording.", "error");
    voiceInput.value = "";
    return;
  }

  voiceObjectUrl = URL.createObjectURL(file);
  voiceAudioPreview.src = voiceObjectUrl;
  voiceAudioPreview.load();
  voiceFilename.textContent = file.name || "Voice recording";
  voiceDropzone.hidden = true;
  voicePreview.hidden = false;
  voiceProgressBar.hidden = false;
  voiceProgress.textContent = "Reading audio…";
  setVoiceStatus("Your audio is being prepared locally. It is never sent to a transcription service.", "working");

  let audioContext = null;
  try {
    const declaredDuration = await readVoiceDuration(voiceAudioPreview);
    if (request !== voiceRequest) return;
    if (!Number.isFinite(declaredDuration) || declaredDuration <= 0) {
      throw new Error("The recording duration could not be verified. Try a standard WAV, MP3, or M4A file.");
    }
    if (declaredDuration > maximumVoiceDuration) {
      voiceProgressBar.hidden = true;
      voiceProgress.textContent = "Recording is too long";
      setVoiceStatus("This recording is longer than 5 minutes. Choose a shorter clip to analyze.", "error");
      return;
    }

    audioContextConstructor ??= window.AudioContext || window.webkitAudioContext;
    if (!audioContextConstructor) {
      throw new Error("Audio decoding is not available in this browser. Try a recent version of Chrome or Edge.");
    }
    audioContext = new audioContextConstructor();
    const audioBuffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    if (request !== voiceRequest) return;
    if (audioBuffer.duration > maximumVoiceDuration) {
      voiceProgressBar.hidden = true;
      voiceProgress.textContent = "Recording is too long";
      setVoiceStatus("This recording is longer than 5 minutes. Choose a shorter clip to analyze.", "error");
      return;
    }
    if (!audioBuffer.numberOfChannels || !audioBuffer.length) {
      throw new Error("No audio could be read from this file. Try a different recording.");
    }

    voiceProgress.textContent = "Preparing 16 kHz audio…";
    const samples = resampleAudio(audioBuffer, voiceSampleRate);
    if (request !== voiceRequest) return;

    const transcriber = await loadVoiceTranscriber();
    if (request !== voiceRequest) return;
    setVoiceStatus("Transcribing locally. Longer recordings may take a few minutes.", "working");
    voiceProgress.textContent = "Transcribing in your browser…";
    const transcription = await transcriber(samples, {
      sampling_rate: voiceSampleRate,
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });
    if (request !== voiceRequest) return;

    const transcript = typeof transcription.text === "string" ? transcription.text.trim() : "";
    if (!transcript) {
      voiceProgressBar.hidden = true;
      voiceProgress.textContent = "No speech detected";
      setVoiceStatus("We couldn’t identify any spoken English. Try a clearer recording with audible speech.", "error");
      return;
    }

    const wasTruncated = transcript.length > maximumExtractedTextLength;
    messageInput.value = transcript.slice(0, maximumExtractedTextLength);
    messageInput.dispatchEvent(new Event("input", { bubbles: true }));
    voiceProgressBar.value = 1;
    voiceProgress.textContent = `Transcription complete · ${Math.round(audioBuffer.duration)} sec`;
    setVoiceStatus(
      wasTruncated
        ? "Transcript ready. The first 10,000 characters were analyzed; review or edit them below."
        : "Transcript ready. Review or edit the text below; scam indicators have been analyzed.",
      wasTruncated ? "working" : "",
    );
    renderResult(messageInput.value);
  } catch (error) {
    if (request !== voiceRequest) return;
    voiceProgressBar.hidden = true;
    voiceProgress.textContent = "Transcription failed";
    const message = error instanceof Error ? error.message : "";
    setVoiceStatus(
      message.includes("import") || message.includes("fetch") || message.includes("network")
        ? "The speech engine or model could not be downloaded. Check your internet connection and try again."
        : message || "This recording could not be transcribed in this browser. Try another audio format or Chrome/Edge.",
      "error",
    );
  } finally {
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
  }
}

voiceInput.addEventListener("change", () => {
  const [file] = voiceInput.files;
  if (file) void analyzeVoiceRecording(file);
});

voiceDropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    voiceInput.click();
  }
});

for (const eventName of ["dragenter", "dragover"]) {
  voiceDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    voiceDropzone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  voiceDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    voiceDropzone.classList.remove("is-dragging");
  });
}

voiceDropzone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) void analyzeVoiceRecording(file);
});

removeVoiceButton.addEventListener("click", clearVoiceRecording);

const checks = [
  {
    label: "Suspicious wording",
    patterns: [
      /\b(?:verify|suspend(?:ed)?|locked|compromised|unusual activity|unauthorized|unrecognised|unrecognized)\b/i,
      /\b(?:claim(?: your)?|click here|open the attachment|confirm your account)\b/i,
    ],
  },
  {
    label: "Urgent or pressuring language",
    patterns: [
      /\b(?:act now|immediately|urgent(?:ly)?|final notice|expires? today|within \d+ hours?|right away|last chance|don't delay|do not delay)\b/i,
    ],
  },
  {
    label: "Threats of arrest, legal action, or punishment",
    patterns: [
      /\b(?:arrest(?:ed)?|jail|prison|prosecut(?:e|ion)|legal action|lawsuit|deport(?:ed|ation)|court action|police at your door|service disconnected|account will be closed|face a fine)\b/i,
    ],
  },
  {
    label: "Request to send money or pay a fee",
    patterns: [
      /\b(?:pay|send|transfer|wire|deposit|purchase|buy)\b.{0,45}\b(?:money|funds|cash|payment|fee|fine|tax|gift card|bitcoin|crypto(?:currency)?|dollars?|euros?|pounds?)\b|\b(?:money|funds|cash|payment|fee|fine|tax|gift card|bitcoin|crypto(?:currency)?|dollars?|euros?|pounds?)\b.{0,45}\b(?:pay|send|transfer|wire|deposit|purchase|buy)\b/i,
    ],
  },
  {
    label: "Prize, reward, or easy-money offer",
    patterns: [
      /\b(?:you(?:'|’)ve|you have) won\b/i,
      /\b(?:winner|prize|reward|giveaway|gift card|cash bonus|free money|lottery|claim your (?:gift|bonus|reward))\b/i,
    ],
  },
  {
    label: "Request for personal or financial information",
    patterns: [
      /\b(?:password|passcode|one[- ]time code|verification code|social security|ssn|bank account|credit card|debit card|card number|routing number|pin number|cvv|wire transfer|crypto(?:currency)? wallet)\b/i,
      /\b(?:send|provide|share|enter|confirm|update)\b.{0,45}\b(?:password|passcode|code|personal (?:details|information)|bank|card|payment|account details)\b/i,
    ],
  },
];

const scamTypes = [
  {
    id: "phishing",
    label: "Phishing",
    clues: [
      { weight: 35, pattern: /\b(?:password|passcode|one[- ]time code|verification code|social security|ssn|bank account|credit card|debit card|card number|routing number|pin number|cvv)\b/i },
      { weight: 25, pattern: /\b(?:verify|confirm|update|restore|unlock|secure)\b.{0,45}\b(?:account|identity|password|details|payment)\b|\b(?:account|identity|password|details|payment)\b.{0,45}\b(?:verify|confirm|update|restore|unlock|secure)\b/i },
      { weight: 15, test: ({ urlReasons }) => urlReasons.size > 0 },
      { weight: 5, test: ({ reasons }) => reasons.includes("Urgent or pressuring language") },
    ],
  },
  {
    id: "fake-prize",
    label: "Fake Prize",
    clues: [
      { weight: 60, pattern: /\b(?:you(?:'|’)ve|you have) won\b|\b(?:winner|prize|reward|giveaway|gift card|cash bonus|free money|lottery|claim your (?:gift|bonus|reward))\b/i },
      { weight: 25, pattern: /\b(?:fee|tax|shipping|processing charge)\b.{0,40}\b(?:claim|prize|reward|winnings|gift)\b|\b(?:claim|prize|reward|winnings|gift)\b.{0,40}\b(?:fee|tax|shipping|processing charge)\b/i },
    ],
  },
  {
    id: "impersonation",
    label: "Impersonation",
    clues: [
      { weight: 30, pattern: /\b(?:from|on behalf of|we are|your)\b.{0,35}\b(?:bank|credit union|government|irs|hmrc|police|court|tax office|support team|security team|paypal|amazon|microsoft|apple|netflix)\b/i },
      { weight: 25, pattern: /\b(?:bank|government|irs|hmrc|police|court|tax office|support team|security team|paypal|amazon|microsoft|apple|netflix)\b.{0,45}\b(?:verify|suspend|refund|payment|password|account|urgent|locked)\b/i },
    ],
  },
  {
    id: "investment",
    label: "Investment Scam",
    clues: [
      { weight: 20, pattern: /\b(?:invest(?:ment)?|crypto(?:currency)?|bitcoin|forex|trading platform|stock tips?)\b/i },
      { weight: 40, pattern: /\b(?:guaranteed|risk[- ]free|no risk|fixed)\b.{0,35}\b(?:returns?|profits?|income|gains?)\b|\b(?:returns?|profits?|income|gains?)\b.{0,35}\b(?:guaranteed|risk[- ]free|no risk|fixed)\b/i },
      { weight: 30, pattern: /\b(?:double your money|high[- ]yield|passive income|limited investment opportunity|exclusive investment)\b/i },
    ],
  },
];

const suspiciousTlds = new Set(["zip", "mov", "top", "xyz", "click", "work", "country", "gq", "tk", "ml", "cf"]);
const urlRegex = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?/gi;

const iconMarkup = {
  low: '<svg viewBox="0 0 20 20" fill="none"><path d="m5 10.2 3.2 3.2L15.5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  suspicious: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 3v7m0 3.5v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 1.8 18.2 17H1.8L10 1.8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  high: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 5v5m0 3.3v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="10" r="8.2" stroke="currentColor" stroke-width="1.5"/></svg>',
};

function cleanUrlCandidate(candidate) {
  return candidate.replace(/[.,!?;:)]+$/g, "");
}

function parseUrl(candidate) {
  const raw = cleanUrlCandidate(candidate);
  try {
    return new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

function inspectUrl(candidate) {
  const parsed = parseUrl(candidate);
  if (!parsed) return [];

  const raw = cleanUrlCandidate(candidate);
  const host = parsed.hostname.toLowerCase();
  const reasons = [];
  if (parsed.username || parsed.password || raw.includes("@")) {
    reasons.push("A link contains an @ sign or embedded sign-in details");
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    reasons.push("A link uses a raw IP address instead of a familiar domain name");
  }
  if (host.startsWith("xn--") || host.split(".").some((part) => part.startsWith("xn--"))) {
    reasons.push("A link uses an encoded domain name that can disguise lookalike characters");
  }
  if (/(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|cutt\.ly)$/i.test(host)) {
    reasons.push("A link uses a URL shortener, which hides its destination");
  }
  const tld = host.split(".").pop();
  if (suspiciousTlds.has(tld)) {
    reasons.push(`A link uses the less familiar .${tld} domain ending`);
  }
  if (host.split(".").length >= 5) {
    reasons.push("A link has an unusually long chain of subdomains");
  }
  if (parsed.protocol === "http:") {
    reasons.push("A link does not use an encrypted HTTPS connection");
  }
  return reasons;
}

function analyze(text) {
  const reasons = [];
  for (const check of checks) {
    if (check.patterns.some((pattern) => pattern.test(text))) reasons.push(check.label);
  }

  const urls = text.match(urlRegex) || [];
  const urlReasons = new Set(urls.flatMap(inspectUrl));
  reasons.push(...urlReasons);

  const scamTypeScores = scamTypes.map((type) => ({
    ...type,
    score: Math.min(100, type.clues.reduce((score, clue) => {
      const matches = clue.pattern ? clue.pattern.test(text) : clue.test({ reasons, urlReasons });
      return score + (matches ? clue.weight : 0);
    }, 0)),
  }));

  let risk;
  if (
    reasons.length >= 3
    || (reasons.length >= 2 && reasons.includes("Request for personal or financial information"))
    || (reasons.includes("Threats of arrest, legal action, or punishment") && reasons.includes("Request to send money or pay a fee"))
  ) {
    risk = "high";
  } else if (reasons.length > 0) {
    risk = "suspicious";
  } else {
    risk = "low";
  }
  return { risk, reasons, urlCount: urls.length, scamTypeScores };
}

function buildWebsiteReports(urls) {
  return urls.map((candidate) => {
    const parsed = parseUrl(candidate);
    if (!parsed) return null;
    const reasons = inspectUrl(candidate);
    const risk = reasons.length >= 2 ? "high" : reasons.length === 1 ? "suspicious" : "low";
    return {
      domain: parsed.hostname,
      https: parsed.protocol === "https:",
      reasons,
      risk,
    };
  }).filter(Boolean);
}

function appendWebsiteDetail(container, label, value, statusClass = "") {
  const detail = document.createElement("div");
  detail.className = "website-detail";
  const detailLabel = document.createElement("span");
  detailLabel.className = "website-detail-label";
  detailLabel.textContent = label;
  const detailValue = document.createElement("span");
  detailValue.className = `website-detail-value${statusClass ? ` ${statusClass}` : ""}`;
  detailValue.textContent = value;
  detail.append(detailLabel, detailValue);
  container.append(detail);
}

function renderWebsiteReports(urls) {
  const websiteList = document.querySelector("#website-list");
  websiteList.replaceChildren();
  const reports = buildWebsiteReports(urls);

  if (!reports.length) {
    const empty = document.createElement("p");
    empty.className = "website-empty";
    empty.textContent = "No website link was detected in this message.";
    websiteList.append(empty);
    return;
  }

  for (const report of reports) {
    const card = document.createElement("article");
    card.className = "website-card";
    card.dataset.risk = report.risk;

    const heading = document.createElement("div");
    heading.className = "website-card-heading";
    const domain = document.createElement("span");
    domain.className = "website-domain";
    domain.textContent = report.domain;
    const risk = document.createElement("span");
    risk.className = "website-risk";
    risk.textContent = report.risk === "high" ? "HIGH RISK" : report.risk === "suspicious" ? "SUSPICIOUS" : "LOW RISK";
    heading.append(domain, risk);

    const details = document.createElement("div");
    details.className = "website-details";
    appendWebsiteDetail(details, "HTTPS", report.https ? "Yes" : "No", report.https ? "is-positive" : "is-negative");
    appendWebsiteDetail(details, "Domain age", "Unknown");
    appendWebsiteDetail(details, "Reputation", "Not checked");
    appendWebsiteDetail(details, "Redirects", "Not followed");

    card.append(heading, details);
    if (report.reasons.length) {
      const explanation = document.createElement("p");
      explanation.className = "website-card-reasons";
      explanation.textContent = `URL warning signs: ${report.reasons.join("; ")}.`;
      card.append(explanation);
    }
    websiteList.append(card);
  }
}

function animateScamTypeScores(container) {
  const rows = [...container.querySelectorAll(".scam-type-row")];
  const duration = 850;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function update(progress) {
    for (const row of rows) {
      const target = Number(row.dataset.score);
      const displayed = Math.round(target * progress);
      row.querySelector(".scam-type-fill").style.setProperty("--score-width", `${displayed}%`);
      row.querySelector(".scam-type-value").textContent = `${displayed}%`;
    }
  }

  if (prefersReducedMotion) {
    update(1);
    return;
  }

  const start = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - start) / duration);
    update(1 - (1 - progress) ** 3);
    if (progress < 1) window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);
}

function buildAdvice(risk) {
  if (risk === "high") {
    return "Don’t click links, reply, or share codes, passwords, or payment details. Contact the organization using a phone number or website you find independently.";
  }
  if (risk === "suspicious") {
    return "Pause before responding. Verify the sender and any link independently, and never share passwords or verification codes.";
  }
  return "No common warning signs were found, but that doesn’t prove it’s safe. If unexpected, verify with the sender through a trusted channel.";
}

function renderResult(text) {
  const { risk, reasons, urlCount, scamTypeScores } = analyze(text);
  const urls = text.match(urlRegex) || [];
  const title = risk === "high" ? "High Risk" : risk === "suspicious" ? "Suspicious" : "Low Risk";
  const summary = reasons.length
    ? `We found ${reasons.length} ${reasons.length === 1 ? "warning sign" : "warning signs"} in this text${urlCount ? ` and checked ${urlCount} ${urlCount === 1 ? "link" : "links"}` : ""}.`
    : "We didn’t spot the patterns this tool checks for. This is not a safety guarantee.";

  resultPanel.dataset.risk = risk;
  document.querySelector("#result-icon").innerHTML = iconMarkup[risk];
  document.querySelector("#result-kicker").textContent = "ON-DEVICE CHECK COMPLETE";
  document.querySelector("#result-title").textContent = title;
  document.querySelector("#risk-score").textContent = `${reasons.length} ${reasons.length === 1 ? "signal" : "signals"}`;
  document.querySelector("#result-summary").textContent = summary;
  document.querySelector("#result-advice").textContent = buildAdvice(risk);

  const reasonContainer = document.querySelector("#result-reasons");
  reasonContainer.replaceChildren();
  if (reasons.length) {
    for (const reason of reasons) {
      const item = document.createElement("div");
      item.className = "reason-item";
      const mark = document.createElement("span");
      mark.className = "reason-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "!";
      const label = document.createElement("span");
      label.textContent = reason;
      item.append(mark, label);
      reasonContainer.append(item);
    }
  } else {
    const item = document.createElement("div");
    item.className = "reason-item";
    const mark = document.createElement("span");
    mark.className = "reason-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "·";
    const label = document.createElement("span");
    label.textContent = "No checked patterns were found";
    item.append(mark, label);
    reasonContainer.append(item);
  }

  const scamTypeList = document.querySelector("#scam-type-list");
  scamTypeList.replaceChildren();
  for (const type of scamTypeScores) {
    const row = document.createElement("div");
    row.className = "scam-type-row";
    row.dataset.type = type.id;
    row.dataset.score = String(type.score);

    const label = document.createElement("span");
    label.className = "scam-type-name";
    label.textContent = type.label;

    const meter = document.createElement("div");
    meter.className = "scam-type-track";
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-label", `${type.label} heuristic match score`);
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "100");
    meter.setAttribute("aria-valuenow", String(type.score));

    const fill = document.createElement("div");
    fill.className = "scam-type-fill";
    meter.append(fill);

    const value = document.createElement("span");
    value.className = "scam-type-value";
    value.textContent = "0%";
    row.append(label, meter, value);
    scamTypeList.append(row);
  }
  renderWebsiteReports(urls);

  resultPanel.hidden = false;
  animateScamTypeScores(scamTypeList);
  resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

messageInput.addEventListener("input", () => {
  characterCount.textContent = `${messageInput.value.length.toLocaleString()} / 10,000`;
  if (messageInput.value.trim()) formError.hidden = true;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) {
    formError.hidden = false;
    messageInput.focus();
    return;
  }
  formError.hidden = true;
  renderResult(text);
});

exampleButton.addEventListener("click", () => {
  messageInput.value = "URGENT: Your account will be suspended today! Verify your password now to claim your $500 gift card: http://bit.ly/account-verify";
  messageInput.dispatchEvent(new Event("input", { bubbles: true }));
  messageInput.focus();
});

checkAnotherButton.addEventListener("click", () => {
  resultPanel.hidden = true;
  messageInput.value = "";
  messageInput.dispatchEvent(new Event("input", { bubbles: true }));
  messageInput.focus();
});
