# ScamShield

A small, responsive scam-awareness checker built with plain HTML, CSS, and JavaScript. It analyzes pasted text locally in your browser and highlights common warning signs, including suspicious wording, urgency, prize or easy-money offers, requests for sensitive information, and unusual URL patterns.

ScamShield is an educational heuristic tool—not a guarantee, security scanner, or server-backed service. It can miss scams or flag legitimate messages. Your input is not sent anywhere or stored by the app.

## Run locally

Open `index.html` directly in a modern browser, or serve this folder with any static file server. For example, if Python is installed:

```sh
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Public website

Once the GitHub Pages deployment finishes, visit <https://kushwahadivyansh33-debug.github.io/scamshield/>.

Use the theme button in the header to switch between light and dark modes. The app follows your device's theme preference until you make a selection, and saves that selection in your browser.

**ScamShield VoiceGuard** accepts audio recordings up to 25 MB and 5 minutes. It decodes the file in the browser, resamples the audio locally, and transcribes English with the pinned, quantized `Xenova/whisper-tiny.en` model in Transformers.js. The speech engine and model are downloaded from jsDelivr and Hugging Face on first use and cached by the browser. This first download can take a few minutes. The audio itself is never uploaded. Review the transcript in the message box before relying on its scam analysis. Speech recognition requires a compatible browser and an internet connection for the initial download.

Upload a PNG, JPG, WEBP, GIF, or BMP screenshot (up to 10 MB) to extract its text and automatically check it with the same scam indicators. You can review or edit the extracted text in the message box. OCR runs locally in your browser using Tesseract.js. On the first screenshot scan, the app downloads its pinned OCR engine and English language data from their CDNs; those requests do not include your screenshot or extracted text. Screenshot scanning requires an internet connection the first time the OCR engine and language data are downloaded.

Analysis results include animated heuristic match scores for phishing, fake prizes, impersonation, and investment scams. Scores show which text patterns matched; they are not probabilities or a guarantee.

When a message includes a URL, the results also show its host, HTTPS status, and a color-coded on-device URL risk check. Domain age is unknown, and reputation and redirects are not checked: ScamShield never visits URLs or sends them to a remote service.

Messages, screenshots, recordings, transcripts, OCR, and scam analysis stay on your device; user content is never uploaded to a server or stored by the app. Only the speech/OCR software and models are downloaded when those features are first used. The only user preference saved by ScamShield is your chosen display theme; the browser may cache the downloaded model files.
